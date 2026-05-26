import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn(),
}));

const { mockSchedulerSend } = vi.hoisted(() => ({ mockSchedulerSend: vi.fn() }));

vi.mock('@aws-sdk/client-scheduler', () => ({
  SchedulerClient: vi.fn(() => ({ send: mockSchedulerSend })),
  CreateScheduleCommand: vi.fn((input: unknown) => ({ _type: 'CreateSchedule', input })),
  FlexibleTimeWindowMode: { OFF: 'OFF' },
  ActionAfterCompletion: { DELETE: 'DELETE' },
}));

import { runPlanner, pickRandomFireTime } from '../../src/jobs/previewScrapePlanner';
import { getAllStores } from '../../src/db/client';
import type { StoreInstanceItem } from '../../src/types/database';

function makeStore(overrides: Partial<StoreInstanceItem> = {}): StoreInstanceItem {
  return {
    PK: 'STOREINSTANCE#kingsoopers:abc',
    SK: 'METADATA',
    entityType: 'STORE_INSTANCE',
    instanceId: 'kingsoopers:abc',
    storeType: 'kingsoopers',
    name: 'King Soopers Test',
    identifiers: { type: 'kingsoopers', storeId: '12345', facilityId: '67890' },
    enabled: true,
    timezone: 'America/Denver',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getAllStores).mockReset();
  mockSchedulerSend.mockReset();
  // Use prod env vars so runPlanner is happy in non-dry-run tests.
  process.env.WORKER_FUNCTION_ARN = 'arn:aws:lambda:us-east-1:111111111111:function:worker';
  process.env.SCHEDULER_INVOKE_ROLE_ARN = 'arn:aws:iam::111111111111:role/SchedulerInvokeRole';
  process.env.SCHEDULE_GROUP_NAME = 'preview-scrape';
  process.env.SCHEDULE_WINDOW_START_HOUR = '9';
  process.env.SCHEDULE_WINDOW_END_HOUR = '23';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runPlanner', () => {
  it('creates one schedule per enabled non-sprouts store and skips disabled/sprouts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:00:00Z')); // Tue 9:00 MDT in Denver
    vi.mocked(getAllStores).mockResolvedValue([
      makeStore({ instanceId: 'kingsoopers:abc' }),
      makeStore({ instanceId: 'safeway:xyz', identifiers: { type: 'safeway', storeId: '1', postalCode: '80230' } }),
      makeStore({ instanceId: 'kingsoopers:dis', enabled: false }),
      makeStore({ instanceId: 'sprouts:nope', identifiers: { type: 'sprouts', storeId: '999' } }),
    ]);
    mockSchedulerSend.mockResolvedValue({});

    const report = await runPlanner({ dryRun: false });

    expect(report.dryRun).toBe(false);
    expect(report.scheduled.map(s => s.instanceId).sort()).toEqual(['kingsoopers:abc', 'safeway:xyz']);
    expect(report.scheduled.every(s => s.created)).toBe(true);
    expect(report.skipped.map(s => ({ id: s.instanceId, r: s.reason })).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'kingsoopers:dis', r: 'disabled' },
      { id: 'sprouts:nope', r: 'sprouts' },
    ]);
    expect(mockSchedulerSend).toHaveBeenCalledTimes(2);
  });

  it('does not call SchedulerClient at all when dryRun is true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:00:00Z'));
    vi.mocked(getAllStores).mockResolvedValue([makeStore()]);

    const report = await runPlanner({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.scheduled).toHaveLength(1);
    expect(report.scheduled[0].created).toBe(false); // dryRun never creates
    expect(mockSchedulerSend).not.toHaveBeenCalled();
  });

  it('treats ConflictException as idempotent skip (created: false, still in scheduled[])', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:00:00Z'));
    vi.mocked(getAllStores).mockResolvedValue([makeStore()]);
    mockSchedulerSend.mockRejectedValue(Object.assign(new Error('Conflict'), { name: 'ConflictException' }));

    const report = await runPlanner({ dryRun: false });
    expect(report.scheduled).toHaveLength(1);
    expect(report.scheduled[0].created).toBe(false);
    expect(report.skipped).toHaveLength(0);
  });

  it('captures other SchedulerClient errors in skipped[create_failed]', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:00:00Z'));
    vi.mocked(getAllStores).mockResolvedValue([makeStore()]);
    mockSchedulerSend.mockRejectedValue(new Error('AccessDeniedException: boom'));

    const report = await runPlanner({ dryRun: false });
    expect(report.scheduled).toHaveLength(0);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0].reason).toBe('create_failed');
    expect(report.skipped[0].message).toContain('boom');
  });

  it('skips with window_passed when the window has already ended', async () => {
    vi.useFakeTimers();
    // 2026-05-20T06:30:00Z = 2026-05-20T00:30 MDT (Wednesday) — Tuesday's window is long gone.
    // Actually: today-in-Denver is 2026-05-20, so the window is for 2026-05-20 9pm-11pm MDT (15:00 UTC to 05:00 UTC next day).
    // To force window_passed, fire AFTER the end hour of today.
    vi.setSystemTime(new Date('2026-05-21T07:00:00Z')); // 01:00 MDT Wednesday — today is 2026-05-21, but it's 1am and start is 9am, so window is *future*, NOT passed
    // Better: fire at 23:30 MDT, which is past end-of-window 23:00.
    vi.setSystemTime(new Date('2026-05-20T05:30:00Z')); // 2026-05-19 23:30 MDT — past today's end of 23:00
    vi.mocked(getAllStores).mockResolvedValue([makeStore()]);

    const report = await runPlanner({ dryRun: false });
    expect(report.scheduled).toHaveLength(0);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0].reason).toBe('window_passed');
  });

  it('throws if WORKER_FUNCTION_ARN env var is missing in non-dryRun mode', async () => {
    delete process.env.WORKER_FUNCTION_ARN;
    vi.mocked(getAllStores).mockResolvedValue([makeStore()]);
    await expect(runPlanner({ dryRun: false })).rejects.toThrow(/WORKER_FUNCTION_ARN/);
  });

  it('builds schedule names that are valid for EventBridge Scheduler', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:00:00Z'));
    vi.mocked(getAllStores).mockResolvedValue([
      makeStore({ instanceId: 'kingsoopers:abc:weird' }),
    ]);

    const report = await runPlanner({ dryRun: true });
    expect(report.scheduled[0].scheduleName).toMatch(/^preview-kingsoopers-abc-weird-\d{4}-\d{2}-\d{2}$/);
    expect(report.scheduled[0].scheduleName).not.toContain(':');
  });
});

describe('pickRandomFireTime', () => {
  it('returns null when the window has already passed', () => {
    // Now = 2026-05-19 23:30 MDT. Window end = 23:00 MDT today. Already past.
    const now = new Date('2026-05-20T05:30:00Z');
    const result = pickRandomFireTime('America/Denver', 9, 23, now);
    expect(result).toBeNull();
  });

  it('clamps the lower bound to now + 60s when window has already started', () => {
    // 11:00 MDT — well inside window. Random fire time must be >= 11:01 MDT.
    const now = new Date('2026-05-19T17:00:00Z'); // 11:00 MDT
    const result = pickRandomFireTime('America/Denver', 9, 23, now);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThanOrEqual(now.getTime() + 60_000);
    // and < 23:00 MDT = 05:00 UTC next day
    expect(result!.getTime()).toBeLessThan(new Date('2026-05-20T05:00:00Z').getTime());
  });

  it('returns a time inside the window when called before the window starts', () => {
    // 03:00 UTC = 21:00 MDT previous day; today in Denver = 2026-05-18 still
    // Use a clearer case: 14:00 UTC = 08:00 MDT, before window start of 09:00.
    const now = new Date('2026-05-19T14:00:00Z'); // 08:00 MDT Tue
    const result = pickRandomFireTime('America/Denver', 9, 23, now);
    expect(result).not.toBeNull();
    const startUtc = new Date('2026-05-19T15:00:00Z'); // 09:00 MDT
    const endUtc = new Date('2026-05-20T05:00:00Z');   // 23:00 MDT
    expect(result!.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(result!.getTime()).toBeLessThan(endUtc.getTime());
  });
});
