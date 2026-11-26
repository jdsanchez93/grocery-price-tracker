import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => { await next(); },
  getAuthUser: () => ({ userId: 'admin:test', email: 'admin@test.com', permissions: ['scraper:run'] }),
  hasPermission: () => true,
}));

vi.mock('../../src/jobs/previewScrapePlanner', () => ({
  runPlanner: vi.fn(),
}));

vi.mock('../../src/jobs/liveCircularCheck', () => ({
  runLiveCircularCheck: vi.fn(),
}));

import { createApp } from '../../src/app';
import { runPlanner } from '../../src/jobs/previewScrapePlanner';
import { runLiveCircularCheck } from '../../src/jobs/liveCircularCheck';

const app = createApp();

beforeEach(() => {
  vi.mocked(runPlanner).mockReset().mockResolvedValue({ dryRun: true, scheduled: [], skipped: [] });
  vi.mocked(runLiveCircularCheck).mockReset().mockResolvedValue({ dryRun: true, results: [] });
});

describe('POST /admin/scheduler/live-check-now', () => {
  it('defaults to dryRun=true, matching plan-now', async () => {
    const live = await app.request('/api/admin/scheduler/live-check-now', { method: 'POST' });
    const plan = await app.request('/api/admin/scheduler/plan-now', { method: 'POST' });

    expect(live.status).toBe(200);
    expect(plan.status).toBe(200);
    expect(runLiveCircularCheck).toHaveBeenCalledWith({ dryRun: true, instanceId: undefined });
    expect(runPlanner).toHaveBeenCalledWith({ dryRun: true });
  });

  it('runs for real with ?dryRun=false and passes ?instanceId through', async () => {
    vi.mocked(runLiveCircularCheck).mockResolvedValue({
      dryRun: false,
      results: [{ instanceId: 'safeway:xyz', result: 'scraped', circularId: '200', weekId: '2026-W48', dealCount: 5, persisted: true }],
    });

    const res = await app.request('/api/admin/scheduler/live-check-now?dryRun=false&instanceId=safeway:xyz', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(runLiveCircularCheck).toHaveBeenCalledWith({ dryRun: false, instanceId: 'safeway:xyz' });
    expect(await res.json()).toMatchObject({ dryRun: false, results: [{ result: 'scraped', weekId: '2026-W48' }] });
  });

  it('returns 500 with the error message when the check itself throws', async () => {
    vi.mocked(runLiveCircularCheck).mockRejectedValue(new Error('ddb unavailable'));

    const res = await app.request('/api/admin/scheduler/live-check-now', { method: 'POST' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ddb unavailable' });
  });
});
