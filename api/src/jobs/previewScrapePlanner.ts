import type { Handler } from 'aws-lambda';
import {
  SchedulerClient,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
} from '@aws-sdk/client-scheduler';
import { logger } from '../logger';
import { getAllStores } from '../db/client';
import { todayInStoreTz } from '../types/database';

export interface PlannerOptions {
  dryRun?: boolean;
}

export interface ScheduledEntry {
  instanceId: string;
  fireAtUtc: string;
  scheduleName: string;
  created: boolean;          // false when dryRun, or when ConflictException (already existed)
}

export interface SkippedEntry {
  instanceId: string;
  reason: 'disabled' | 'sprouts' | 'window_passed' | 'create_failed';
  message?: string;
}

export interface PlannerReport {
  dryRun: boolean;
  scheduled: ScheduledEntry[];
  skipped: SkippedEntry[];
}

// Lazy-initialized so dryRun callers in local dev don't need AWS creds resolved.
let _schedulerClient: SchedulerClient | null = null;
function getSchedulerClient(): SchedulerClient {
  if (!_schedulerClient) _schedulerClient = new SchedulerClient({});
  return _schedulerClient;
}

/**
 * Fan out per-store one-time EventBridge schedules across a random window in
 * each store's local timezone. Idempotent on re-run via deterministic schedule
 * names (ConflictException = skip silently). In dryRun mode, computes the plan
 * but creates nothing — used by the admin route for local-dev verification.
 */
export async function runPlanner(opts: PlannerOptions = {}): Promise<PlannerReport> {
  const dryRun = opts.dryRun ?? false;

  // Read env vars per-call so tests can override; cheap.
  const WORKER_ARN = process.env.WORKER_FUNCTION_ARN;
  const INVOKE_ROLE = process.env.SCHEDULER_INVOKE_ROLE_ARN;
  const GROUP = process.env.SCHEDULE_GROUP_NAME ?? 'preview-scrape';
  const WIN_START = Number(process.env.SCHEDULE_WINDOW_START_HOUR ?? '12');
  const WIN_END = Number(process.env.SCHEDULE_WINDOW_END_HOUR ?? '23');

  if (!dryRun) {
    if (!WORKER_ARN) throw new Error('WORKER_FUNCTION_ARN env var is required');
    if (!INVOKE_ROLE) throw new Error('SCHEDULER_INVOKE_ROLE_ARN env var is required');
  }

  const allStores = await getAllStores();
  const scheduled: ScheduledEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const store of allStores) {
    if (!store.enabled) {
      skipped.push({ instanceId: store.instanceId, reason: 'disabled' });
      continue;
    }
    if (store.identifiers.type === 'sprouts') {
      skipped.push({ instanceId: store.instanceId, reason: 'sprouts' });
      continue;
    }

    const fireAtUtc = pickRandomFireTime(store.timezone, WIN_START, WIN_END);
    if (!fireAtUtc) {
      skipped.push({ instanceId: store.instanceId, reason: 'window_passed' });
      logger.info({ instanceId: store.instanceId }, 'planner: window already passed today; skipping');
      continue;
    }

    const scheduleName = buildScheduleName(store.instanceId, fireAtUtc);

    if (dryRun) {
      scheduled.push({ instanceId: store.instanceId, fireAtUtc: fireAtUtc.toISOString(), scheduleName, created: false });
      logger.info({ instanceId: store.instanceId, fireAt: fireAtUtc.toISOString(), scheduleName, dryRun: true }, 'planner: would schedule');
      continue;
    }

    try {
      await getSchedulerClient().send(new CreateScheduleCommand({
        Name: scheduleName,
        GroupName: GROUP,
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        // "at(YYYY-MM-DDTHH:MM:SS)" without milliseconds, in UTC.
        ScheduleExpression: `at(${fireAtUtc.toISOString().split('.')[0]})`,
        Target: {
          Arn: WORKER_ARN!,
          RoleArn: INVOKE_ROLE!,
          Input: JSON.stringify({ instanceId: store.instanceId }),
        },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
      }));
      scheduled.push({ instanceId: store.instanceId, fireAtUtc: fireAtUtc.toISOString(), scheduleName, created: true });
      logger.info({ instanceId: store.instanceId, fireAt: fireAtUtc.toISOString(), scheduleName }, 'planner: scheduled');
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'ConflictException') {
        // Idempotent re-run within the same minute resolution — already created.
        scheduled.push({ instanceId: store.instanceId, fireAtUtc: fireAtUtc.toISOString(), scheduleName, created: false });
        logger.info({ scheduleName }, 'planner: schedule already exists; skipping create');
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      skipped.push({ instanceId: store.instanceId, reason: 'create_failed', message });
      logger.error({ instanceId: store.instanceId, err: message }, 'planner: failed to create schedule');
    }
  }

  return { dryRun, scheduled, skipped };
}

/**
 * Build a schedule name that's deterministic per (store, day-of-fire) so
 * re-running the planner the same day collides cleanly via ConflictException.
 * EventBridge schedule names must match [0-9A-Za-z_.-]+, so we strip the colon
 * in the store instance id ("kingsoopers:abc" → "kingsoopers-abc").
 */
function buildScheduleName(instanceId: string, fireAtUtc: Date): string {
  const safeId = instanceId.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const dayUtc = fireAtUtc.toISOString().slice(0, 10); // YYYY-MM-DD
  return `preview-${safeId}-${dayUtc}`;
}

/**
 * Pick a uniformly random UTC instant in [startHour, endHour] today (in the
 * given IANA timezone), clamped to be at least `now + 60s`. Returns null if
 * the window has already passed today.
 */
export function pickRandomFireTime(
  timezone: string,
  startHour: number,
  endHour: number,
  now: Date = new Date(),
): Date | null {
  const today = todayInStoreTz(timezone, now); // "YYYY-MM-DD" in store local at `now`
  const startUtc = localHourToUtc(today, startHour, timezone);
  const endUtc = localHourToUtc(today, endHour, timezone);

  const earliest = new Date(Math.max(now.getTime() + 60_000, startUtc.getTime()));
  if (earliest.getTime() >= endUtc.getTime()) return null;

  const spanMs = endUtc.getTime() - earliest.getTime();
  return new Date(earliest.getTime() + Math.floor(Math.random() * spanMs));
}

/**
 * Convert "YYYY-MM-DDTHH:00:00 in <timezone>" to the equivalent UTC Date.
 *
 * Strategy: take the wall-clock as if it were UTC (candidate), then ask what
 * wall-clock that UTC instant *actually* shows in the target timezone; the
 * difference is the tz offset at that instant, which we add back.
 *
 * DST transitions inside our 9–23 window don't happen in the US (DST shifts at
 * 02:00), so a single-pass correction is exact for this use case.
 */
function localHourToUtc(yyyymmdd: string, hour: number, timezone: string): Date {
  const hh = String(hour).padStart(2, '0');
  const candidate = new Date(`${yyyymmdd}T${hh}:00:00Z`);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(candidate);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // "2-digit" hour can produce "24" for midnight on some ICU versions; normalize.
  const h = get('hour') === '24' ? '00' : get('hour');
  const wallInTz = new Date(`${get('year')}-${get('month')}-${get('day')}T${h}:${get('minute')}:${get('second')}Z`);

  const offsetMs = candidate.getTime() - wallInTz.getTime();
  return new Date(candidate.getTime() + offsetMs);
}

export const handler: Handler<unknown, PlannerReport> = async () => {
  return runPlanner({ dryRun: false });
};
