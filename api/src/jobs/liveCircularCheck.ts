import type { Handler } from 'aws-lambda';
import { logger } from '../logger';
import { getAllStores, getStoreInstance, getCircular } from '../db/client';
import { circularWeekId, todayInStoreTz, type StoreInstanceItem } from '../types/database';
import { NoCircularError } from '../scraper/errors';
import {
  fetchCircularsList,
  pickLiveCircular,
  fetchAndPersistWeeklyDeals as fetchAndPersistKingSoopersWeeklyDeals,
} from '../scraper/kingsoopers';
import {
  fetchPublications as fetchSafewayPublications,
  extractWeeklyAds as extractSafewayWeeklyAds,
  selectWeeklyAd as selectSafewayWeeklyAd,
  fetchAndPersistWeeklyDeals as fetchAndPersistSafewayWeeklyDeals,
} from '../scraper/safeway';

export interface LiveCheckOptions {
  dryRun?: boolean;
  /** Check only this store instead of every store. */
  instanceId?: string;
}

export type LiveCheckResult =
  // The ad covering today is already stored. No deal fetch happened.
  | { instanceId: string; result: 'already_scraped'; circularId: string; weekId: string }
  // dryRun: the ad covering today is missing and a real run would scrape it.
  | { instanceId: string; result: 'would_scrape'; circularId: string; weekId: string; startDate: string; endDate: string }
  | { instanceId: string; result: 'scraped'; circularId: string; weekId: string; dealCount: number; persisted: boolean }
  // Nothing upstream covers today (ad not published yet, or a gap between ads).
  | { instanceId: string; result: 'no_live_ad'; message: string }
  // The live ad's partition already holds a different circular. A non-force
  // scrape would mix both ads' deals in one partition, so leave it for a human.
  | { instanceId: string; result: 'partition_conflict'; circularId: string; weekId: string; storedCircularId: string }
  | { instanceId: string; result: 'skipped'; reason: 'disabled' | 'sprouts' | 'store_not_found' }
  | { instanceId: string; result: 'error'; message: string };

export interface LiveCheckReport {
  dryRun: boolean;
  results: LiveCheckResult[];
}

type PersistResult = Awaited<ReturnType<typeof fetchAndPersistKingSoopersWeeklyDeals>>;

interface LiveAdPeek {
  circularId: string;
  startDate: string; // store-local YYYY-MM-DD
  endDate: string;   // store-local YYYY-MM-DD
  weekId: string;    // partition the scrape below writes to
  scrape: () => Promise<PersistResult>;
}

/**
 * Find the upstream ad whose dates cover today, using each chain's cheap
 * metadata call only (Kroger circulars list via the scraper-worker, Flipp
 * publications). No deals are fetched here.
 */
async function peekLiveAd(store: StoreInstanceItem): Promise<LiveAdPeek | null> {
  const today = todayInStoreTz(store.timezone);
  const { identifiers, instanceId, timezone } = store;

  switch (identifiers.type) {
    case 'kingsoopers': {
      const live = pickLiveCircular(await fetchCircularsList(identifiers), today);
      if (!live) return null;
      return {
        circularId: live.circularId,
        startDate: live.startDate,
        endDate: live.endDate,
        weekId: live.weekId,
        // The scraper-worker picks a circular by its preview flag. Passing the
        // live ad's own flag targets this ad whether Kroger lists it as the
        // current circular or still as the preview.
        scrape: () => fetchAndPersistKingSoopersWeeklyDeals(identifiers, instanceId, { preview: live.previewCircular }),
      };
    }
    case 'safeway': {
      const { publications } = await fetchSafewayPublications(identifiers);
      const live = selectSafewayWeeklyAd(extractSafewayWeeklyAds(publications), today, false);
      if (!live) return null;
      return {
        circularId: live.circularId,
        startDate: live.startDate,
        endDate: live.endDate,
        weekId: circularWeekId(live.startDate),
        // No preview flag: fetchAndPersistWeeklyDeals selects this same ad
        // through selectWeeklyAd.
        scrape: () => fetchAndPersistSafewayWeeklyDeals(identifiers, instanceId, timezone),
      };
    }
    case 'sprouts':
      return null; // filtered out before peeking; kept for exhaustiveness
  }
}

async function checkStore(store: StoreInstanceItem, dryRun: boolean): Promise<LiveCheckResult> {
  const { instanceId } = store;
  if (!store.enabled) return { instanceId, result: 'skipped', reason: 'disabled' };
  if (store.identifiers.type === 'sprouts') return { instanceId, result: 'skipped', reason: 'sprouts' };

  try {
    const live = await peekLiveAd(store);
    if (!live) {
      logger.info({ instanceId }, 'live check: no ad covering today upstream');
      return { instanceId, result: 'no_live_ad', message: 'No ad covering today upstream' };
    }

    const { circularId, weekId, startDate, endDate } = live;
    const stored = await getCircular(instanceId, weekId);
    if (stored?.circularId === circularId) {
      logger.info({ instanceId, weekId, circularId }, 'live check: already scraped');
      return { instanceId, result: 'already_scraped', circularId, weekId };
    }
    if (stored) {
      logger.warn(
        { instanceId, weekId, circularId, storedCircularId: stored.circularId, startDate, endDate },
        'live check: partition holds a different circular; not scraping (use /admin/scrape/auto?force=true to replace it)',
      );
      return { instanceId, result: 'partition_conflict', circularId, weekId, storedCircularId: stored.circularId };
    }

    if (dryRun) {
      logger.info({ instanceId, weekId, circularId, startDate, endDate, dryRun }, 'live check: would scrape');
      return { instanceId, result: 'would_scrape', circularId, weekId, startDate, endDate };
    }

    const res = await live.scrape();
    if (res.alreadyScraped) {
      // Someone else stored it between the peek and the scrape.
      return { instanceId, result: 'already_scraped', circularId: res.circularId, weekId: res.weekId };
    }
    if (res.circularId !== circularId) {
      logger.warn(
        { instanceId, expectedCircularId: circularId, scrapedCircularId: res.circularId, weekId: res.weekId },
        'live check: scrape returned a different circular than the one covering today',
      );
    }
    logger.info(
      { instanceId, weekId: res.weekId, circularId: res.circularId, dealCount: res.deals.length, persisted: res.persisted },
      'live circular scraped',
    );
    return {
      instanceId,
      result: 'scraped',
      circularId: res.circularId,
      weekId: res.weekId,
      dealCount: res.deals.length,
      persisted: res.persisted,
    };
  } catch (err) {
    if (err instanceof NoCircularError) {
      // The ad vanished between the peek and the scrape.
      logger.info({ instanceId, reason: err.message }, 'live check: no ad covering today upstream');
      return { instanceId, result: 'no_live_ad', message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ instanceId, err: message }, 'live check: failed');
    return { instanceId, result: 'error', message };
  }
}

/**
 * For each enabled store, make sure the ad covering today (store-local date)
 * is stored, and scrape it if it isn't. Catches ads the Tuesday preview scrape
 * missed because they weren't published yet (e.g. Safeway's post-Thanksgiving
 * 2026 ad starting Fri Nov 27).
 *
 * The "already stored?" check uses metadata only and looks in the partition the
 * scrape would write to, so a store whose live ad is stored costs one upstream
 * metadata call and one DDB read. Stores run sequentially: a full scrape is the
 * expensive case, and one at a time keeps the load on the scraper-worker and
 * upstream APIs the same as a manual scrape.
 *
 * Per-store failures are reported in the results and don't stop the other
 * stores. In dryRun mode nothing is written (upstream metadata is still read).
 */
export async function runLiveCircularCheck(opts: LiveCheckOptions = {}): Promise<LiveCheckReport> {
  const dryRun = opts.dryRun ?? false;

  let stores: StoreInstanceItem[];
  if (opts.instanceId) {
    const store = await getStoreInstance(opts.instanceId);
    if (!store) {
      return { dryRun, results: [{ instanceId: opts.instanceId, result: 'skipped', reason: 'store_not_found' }] };
    }
    stores = [store];
  } else {
    stores = await getAllStores();
  }

  const results: LiveCheckResult[] = [];
  for (const store of stores) {
    results.push(await checkStore(store, dryRun));
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
  logger.info({ dryRun, counts }, 'live check done');

  return { dryRun, results };
}

export const handler: Handler<unknown, LiveCheckReport> = async () => {
  const report = await runLiveCircularCheck({ dryRun: false });
  const failed = report.results.filter((r) => r.result === 'error');
  if (failed.length > 0) {
    // Fail the invocation so it shows in the Lambda Errors metric. Lambda's
    // async retries re-run the whole check, which is cheap for the stores that
    // already succeeded (they short-circuit as already_scraped).
    throw new Error(`live circular check failed for: ${failed.map((r) => r.instanceId).join(', ')}`);
  }
  return report;
};
