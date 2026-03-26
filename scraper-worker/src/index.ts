import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { scrapeKingSoopers } from './kingsoopers.js';

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
  const body = await c.req.json<{ storeId: string; facilityId: string }>();
  const { storeId, facilityId } = body;

  if (!storeId || !facilityId) {
    return c.json({ error: 'storeId and facilityId are required' }, 400);
  }

  console.log(`[scrape] storeId=${storeId} facilityId=${facilityId}`);
  const t = Date.now();

  const result = await scrapeKingSoopers(storeId, facilityId);

  console.log(`[scrape] done in ${Date.now() - t}ms — circularId=${result.circularId} ${result.deals.length} deals, ${result.bogoData.length} BOGO items`);
  return c.json(result);
});

app.get('/health', (c) => c.json({ ok: true }));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`scraper-worker listening on port ${PORT}`);
});
