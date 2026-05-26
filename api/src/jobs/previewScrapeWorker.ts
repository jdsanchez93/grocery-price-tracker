import type { Handler } from 'aws-lambda';
import { logger } from '../logger';
import { getStoreInstance } from '../db/client';
import { NoCircularError } from '../scraper/errors';
import { fetchAndPersistWeeklyDeals as fetchAndPersistKingSoopersWeeklyDeals } from '../scraper/kingsoopers';
import { fetchAndPersistWeeklyDeals as fetchAndPersistSafewayWeeklyDeals } from '../scraper/safeway';

export interface WorkerEvent {
  instanceId: string;
}

export type WorkerOutcome =
  | { result: 'scraped'; weekId: string; alreadyScraped?: boolean; dealCount?: number }
  | { result: 'no_preview_available' }
  | { result: 'store_not_found' }
  | { result: 'not_implemented' };

/**
 * Scrape one store's "next week" preview circular. Idempotent — the underlying
 * fetchAndPersistWeeklyDeals path returns `alreadyScraped: true` on circularId
 * match, so EventBridge Scheduler retries are safe.
 *
 * Throws on unexpected errors so EventBridge's built-in retry policy can kick
 * in. `NoCircularError` (preview not yet published upstream) is swallowed — we
 * lose this week's scrape for that store; the next weekly planner run picks it
 * up.
 */
export async function runWorker(instanceId: string): Promise<WorkerOutcome> {
  const store = await getStoreInstance(instanceId);
  if (!store) {
    logger.warn({ instanceId }, 'worker: store not found');
    return { result: 'store_not_found' };
  }

  try {
    switch (store.identifiers.type) {
      case 'kingsoopers': {
        const res = await fetchAndPersistKingSoopersWeeklyDeals(
          store.identifiers,
          store.instanceId,
          { preview: true },
        );
        logger.info(
          { instanceId, weekId: res.weekId, dealCount: res.deals.length, alreadyScraped: res.alreadyScraped },
          'preview scrape done',
        );
        return {
          result: 'scraped',
          weekId: res.weekId,
          alreadyScraped: res.alreadyScraped,
          dealCount: res.deals.length,
        };
      }
      case 'safeway': {
        const res = await fetchAndPersistSafewayWeeklyDeals(
          store.identifiers,
          store.instanceId,
          store.timezone,
          { preview: true },
        );
        logger.info(
          { instanceId, weekId: res.weekId, dealCount: res.deals.length, alreadyScraped: res.alreadyScraped },
          'preview scrape done',
        );
        return {
          result: 'scraped',
          weekId: res.weekId,
          alreadyScraped: res.alreadyScraped,
          dealCount: res.deals.length,
        };
      }
      case 'sprouts':
        logger.warn({ instanceId }, 'sprouts not implemented; skipping');
        return { result: 'not_implemented' };
    }
  } catch (err) {
    if (err instanceof NoCircularError) {
      logger.info({ instanceId, msg: err.message }, 'kroger: no preview available yet');
      return { result: 'no_preview_available' };
    }
    // Genuine error — let EventBridge Scheduler retry per its policy.
    throw err;
  }
}

export const handler: Handler<WorkerEvent, WorkerOutcome> = async (event) => {
  return runWorker(event.instanceId);
};
