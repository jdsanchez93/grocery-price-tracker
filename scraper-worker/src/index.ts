import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { scrapeKingSoopers, fetchKingSoopersCirculars } from './kingsoopers.js';

const app = new Hono();
const API_KEY = process.env.API_KEY;
const PORT = parseInt(process.env.PORT || '3010');

if (!API_KEY) {
  console.error('API_KEY environment variable is required');
  process.exit(1);
}

app.use('*', async (c, next) => {
  if (c.req.header('X-Api-Key') !== API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.post('/scrape/kingsoopers', async (c) => {
  const body = await c.req.json<{ storeId: string; facilityId: string; preview?: boolean }>();
  const { storeId, facilityId, preview } = body;

  if (!storeId || !facilityId) {
    return c.json({ error: 'storeId and facilityId are required' }, 400);
  }

  console.log(`[scrape] storeId=${storeId} facilityId=${facilityId} preview=${Boolean(preview)}`);
  const t = Date.now();

  try {
    const result = await scrapeKingSoopers(storeId, facilityId, Boolean(preview));
    console.log(`[scrape] done in ${Date.now() - t}ms — circularId=${result.circularId} ${result.deals.length} deals, ${result.bogoData.length} BOGO items`);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No preview weekly ad circular found') ||
        msg.includes('No weekly ad circular found')) {
      console.log(`[scrape] no circular available — ${msg}`);
      return c.json({ error: msg }, 404);
    }
    throw err;
  }
});

// Return the list of weeklyAd circulars (current + preview) for a store.
// Metadata only — no deal fetching, no BOGO resolution, no DDB writes.
// Used by /admin/scrape/preview-availability to peek at upstream cheaply.
app.post('/scrape/kingsoopers/circulars', async (c) => {
  const body = await c.req.json<{ storeId: string; facilityId: string }>();
  const { storeId, facilityId } = body;

  if (!storeId || !facilityId) {
    return c.json({ error: 'storeId and facilityId are required' }, 400);
  }

  console.log(`[circulars] storeId=${storeId} facilityId=${facilityId}`);
  const circulars = await fetchKingSoopersCirculars(storeId, facilityId);
  console.log(`[circulars] returned ${circulars.length} weeklyAd entries`);
  return c.json({ circulars });
});

app.get('/health', (c) => c.json({ ok: true }));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`scraper-worker listening on port ${PORT}`);
});
