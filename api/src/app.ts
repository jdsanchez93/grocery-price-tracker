import { Hono } from 'hono';
import {
  fetchWeeklyDeals,
  fetchAndPersistWeeklyDeals,
  fetchCirculars,
  extractWeeklyAdMetadata,
  DEFAULT_CIRCULAR_ID,
} from './scraper/kingsoopers';
import { authMiddleware, getAuthUser, isAuthenticated } from './middleware/auth';
import {
  getDealsForUserStores,
  getUserStores,
  addUserStore,
  removeUserStore,
  getUser,
  createUser,
  getPriceHistory,
  getAllStoreTypes,
  getStoreType,
  getStoreInstancesByType,
  getStoreInstance,
  getOrCreateStoreInstance,
  writeStoreType,
  writeStoreInstance,
  getCircular,
} from './db/client';
import {
  getCurrentWeekId,
  StoreType,
  StoreIdentifiers,
  generateStoreInstanceId,
} from './types/database';
import { searchDeals } from './scraper/products';

export function createApp() {
  const app = new Hono();

  app.get('/', (c) => c.text('Grocery Price Tracker API'));

  // ===================
  // Public Endpoints
  // ===================

  // List available store types (e.g., kingsoopers, safeway, sprouts)
  app.get('/store-types', async (c) => {
    const storeTypes = await getAllStoreTypes();
    return c.json({ storeTypes });
  });

  // List store instances for a specific type
  app.get('/store-types/:type/stores', async (c) => {
    const storeType = c.req.param('type') as StoreType;

    // Validate store type exists
    const typeInfo = await getStoreType(storeType);
    if (!typeInfo) {
      return c.json({ error: 'Store type not found' }, 404);
    }

    const instances = await getStoreInstancesByType(storeType);
    return c.json({
      storeType: typeInfo,
      stores: instances,
    });
  });

  // ===================
  // Admin Endpoints (/admin/*)
  // ===================

  // Apply auth middleware to all /admin/* routes
  app.use('/admin/*', authMiddleware({ required: true, scopes: ['admin'] }));

  // Create a store instance
  app.post('/admin/stores', async (c) => {
    const body = await c.req.json<{
      type: StoreType;
      name: string;
      storeId: string;
      facilityId?: string;
    }>();

    if (!body.type || !body.name || !body.storeId) {
      return c.json({ error: 'type, name, and storeId are required' }, 400);
    }

    let identifiers: StoreIdentifiers;

    switch (body.type) {
      case 'kingsoopers':
        if (!body.facilityId) {
          return c.json({ error: 'facilityId is required for kingsoopers' }, 400);
        }
        identifiers = { type: 'kingsoopers', storeId: body.storeId, facilityId: body.facilityId };
        break;
      case 'safeway':
        identifiers = { type: 'safeway', storeId: body.storeId };
        break;
      case 'sprouts':
        identifiers = { type: 'sprouts', storeId: body.storeId };
        break;
      default:
        return c.json({ error: 'Invalid store type' }, 400);
    }

    const instance = await writeStoreInstance(identifiers, body.name);

    return c.json({
      success: true,
      store: instance,
    });
  });

  // Fetch available circulars from Kroger API
  app.get('/admin/kingsoopers/circulars', async (c) => {
    const storeId = c.req.query('storeId');
    const facilityId = c.req.query('facilityId');

    if (!storeId || !facilityId) {
      return c.json({ error: 'storeId and facilityId are required' }, 400);
    }

    try {
      const result = await fetchCirculars(storeId, facilityId);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Preview deals from King Soopers API (no persist)
  app.get('/admin/kingsoopers/deals', async (c) => {
    const circularId = c.req.query('circularId') ?? DEFAULT_CIRCULAR_ID;
    const storeId = c.req.query('storeId');
    const facilityId = c.req.query('facilityId');

    if (!storeId || !facilityId) {
      return c.json({ error: 'storeId and facilityId are required' }, 400);
    }

    const deals = await fetchWeeklyDeals(circularId, storeId, facilityId);
    return c.json({ deals, count: deals.length });
  });

  // Manual scrape: fetch and persist deals to DynamoDB
  app.post('/admin/kingsoopers/scrape', async (c) => {
    const circularId = c.req.query('circularId') ?? DEFAULT_CIRCULAR_ID;
    const storeId = c.req.query('storeId');
    const facilityId = c.req.query('facilityId');
    const storeName = c.req.query('storeName');

    if (!storeId || !facilityId) {
      return c.json({ error: 'storeId and facilityId are required' }, 400);
    }

    const weekId = c.req.query('weekId') ?? getCurrentWeekId();

    // Get or create the store instance
    const identifiers: StoreIdentifiers = {
      type: 'kingsoopers',
      storeId,
      facilityId,
    };

    const storeInstance = await getOrCreateStoreInstance(
      identifiers,
      storeName || `King Soopers (${storeId})`
    );

    const result = await fetchAndPersistWeeklyDeals(
      circularId,
      storeId,
      facilityId,
      storeInstance.instanceId,
      weekId
    );

    return c.json({
      success: true,
      weekId,
      storeInstanceId: storeInstance.instanceId,
      dealCount: result.deals.length,
      persisted: result.persisted,
    });
  });

  // Auto-scrape: fetch circularId + scrape with deduplication
  app.post('/admin/kingsoopers/scrape/auto', async (c) => {
    const storeId = c.req.query('storeId');
    const facilityId = c.req.query('facilityId');
    const storeName = c.req.query('storeName');

    if (!storeId || !facilityId) {
      return c.json({ error: 'storeId and facilityId are required' }, 400);
    }

    // 1. Fetch circulars and extract weeklyAd metadata
    const { circulars } = await fetchCirculars(storeId, facilityId);
    const weeklyAdMeta = extractWeeklyAdMetadata(circulars);

    if (!weeklyAdMeta) {
      return c.json({ error: 'No weeklyAd circular found' }, 404);
    }

    const weekId = getCurrentWeekId();

    // 2. Get or create store instance
    const identifiers: StoreIdentifiers = {
      type: 'kingsoopers',
      storeId,
      facilityId,
    };

    const storeInstance = await getOrCreateStoreInstance(
      identifiers,
      storeName || `King Soopers (${storeId})`
    );

    // 3. Check for existing circular (deduplication)
    const existingCircular = await getCircular(storeInstance.instanceId, weekId);

    if (existingCircular && existingCircular.circularId === weeklyAdMeta.circularId) {
      return c.json({
        success: true,
        alreadyScraped: true,
        weekId,
        circularId: weeklyAdMeta.circularId,
        storeInstanceId: storeInstance.instanceId,
        existingDealCount: existingCircular.dealCount,
      });
    }

    // 4. Scrape and persist deals
    const result = await fetchAndPersistWeeklyDeals(
      weeklyAdMeta.circularId,
      storeId,
      facilityId,
      storeInstance.instanceId,
      weekId,
      { startDate: weeklyAdMeta.startDate, endDate: weeklyAdMeta.endDate }
    );

    return c.json({
      success: true,
      alreadyScraped: false,
      weekId,
      circularId: weeklyAdMeta.circularId,
      storeInstanceId: storeInstance.instanceId,
      dealCount: result.deals.length,
      persisted: result.persisted,
      dates: {
        startDate: weeklyAdMeta.startDate,
        endDate: weeklyAdMeta.endDate,
      },
    });
  });

  // ===================
  // User Endpoints (/me/*)
  // ===================

  // Apply auth middleware to all /me/* routes
  app.use('/me/*', authMiddleware({ required: true, scopes: ['user'] }));

  // Get user's selected stores (now returns store instances)
  app.get('/me/stores', async (c) => {
    const user = getAuthUser(c);
    const userStores = await getUserStores(user.userId);

    // Enrich with store instance metadata
    const storesWithDetails = await Promise.all(
      userStores.map(async (us) => {
        const storeInstance = await getStoreInstance(us.storeInstanceId);
        const storeType = storeInstance
          ? await getStoreType(storeInstance.storeType)
          : null;

        return {
          instanceId: us.storeInstanceId,
          name: storeInstance?.name || us.storeInstanceId,
          storeType: storeInstance?.storeType,
          chain: storeType?.chain,
          identifiers: storeInstance?.identifiers,
          addedAt: us.addedAt,
        };
      })
    );

    return c.json({ stores: storesWithDetails });
  });

  // Add store instance to user's selection
  app.post('/me/stores/:instanceId', async (c) => {
    const user = getAuthUser(c);
    const instanceId = c.req.param('instanceId');

    // Validate store instance exists
    const storeInstance = await getStoreInstance(instanceId);
    if (!storeInstance) {
      return c.json({ error: 'Store instance not found' }, 404);
    }

    // Ensure user exists in DB
    const existingUser = await getUser(user.userId);
    if (!existingUser) {
      await createUser(user.userId, user.email || '', undefined);
    }

    const userStore = await addUserStore(user.userId, instanceId);
    const storeType = await getStoreType(storeInstance.storeType);

    return c.json({
      success: true,
      store: {
        instanceId: userStore.storeInstanceId,
        name: storeInstance.name,
        storeType: storeInstance.storeType,
        chain: storeType?.chain,
        identifiers: storeInstance.identifiers,
        addedAt: userStore.addedAt,
      },
    });
  });

  // Remove store instance from user's selection
  app.delete('/me/stores/:instanceId', async (c) => {
    const user = getAuthUser(c);
    const instanceId = c.req.param('instanceId');

    await removeUserStore(user.userId, instanceId);

    return c.json({ success: true });
  });

  // Get deals from user's selected stores
  app.get('/me/deals', async (c) => {
    const user = getAuthUser(c);
    const weekId = c.req.query('week') ?? getCurrentWeekId();

    const deals = await getDealsForUserStores(user.userId, weekId);

    return c.json({
      weekId,
      deals,
      count: deals.length,
    });
  });

  // Search deals from user's selected stores
  app.get('/me/search', async (c) => {
    const user = getAuthUser(c);
    const query = c.req.query('q');

    if (!query) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    const weekId = c.req.query('week') ?? getCurrentWeekId();
    const allDeals = await getDealsForUserStores(user.userId, weekId);

    // Client-side filtering
    const filteredDeals = searchDeals(allDeals, query);

    return c.json({
      query,
      weekId,
      deals: filteredDeals,
      count: filteredDeals.length,
    });
  });

  // Get price history for a product
  app.get('/me/products/:id/history', async (c) => {
    const user = getAuthUser(c);
    const canonicalProductId = c.req.param('id');

    // Get user's store instances to filter history
    const userStores = await getUserStores(user.userId);
    const storeInstanceIds = userStores.map((us) => us.storeInstanceId);

    if (storeInstanceIds.length === 0) {
      return c.json({
        productId: canonicalProductId,
        history: [],
        message: 'Add stores to your selection to see price history',
      });
    }

    const history = await getPriceHistory(canonicalProductId, storeInstanceIds);

    return c.json({
      productId: canonicalProductId,
      history,
      count: history.length,
    });
  });

  return app;
}