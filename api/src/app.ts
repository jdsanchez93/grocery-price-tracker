import { Hono } from 'hono';
import {
  fetchWeeklyDeals,
  fetchAndPersistWeeklyDeals,
  fetchCirculars,
  extractWeeklyAdMetadata,
  DEFAULT_CIRCULAR_ID,
} from './scraper/kingsoopers';
import {
  fetchPublications as fetchSafewayPublications,
  extractWeeklyAdMetadata as extractSafewayWeeklyAdMetadata,
  fetchWeeklyDeals as fetchSafewayWeeklyDeals,
  fetchAndPersistWeeklyDeals as fetchAndPersistSafewayWeeklyDeals,
} from './scraper/safeway';
import { authMiddleware, getAuthUser, isAuthenticated } from './middleware/auth';
import {
  getDealsForUserStores,
  getUserStores,
  addUserStore,
  removeUserStore,
  getUser,
  createUser,
  getPriceHistory,
  getStoreInstancesByType,
  getStoreInstance,
  getOrCreateStoreInstance,
  writeStoreInstance,
  getCircular,
  deleteCircularAndDeals,
} from './db/client';
import {
  getCurrentWeekId,
  StoreType,
  StoreIdentifiers,
  generateStoreInstanceId,
  STORE_TYPE_METADATA,
} from './types/database';
import { searchDeals } from './scraper/products';

export function createApp() {
  const app = new Hono().basePath('/api');

  app.get('/', (c) => c.text('Grocery Price Tracker API'));

  // ===================
  // Public Endpoints
  // ===================

  // List available store types (e.g., kingsoopers, safeway, sprouts)
  app.get('/store-types', (c) => {
    const storeTypes = Object.entries(STORE_TYPE_METADATA).map(([type, meta]) => ({
      storeType: type,
      name: meta.name,
      chain: meta.chain,
    }));
    return c.json({ storeTypes });
  });

  // List store instances for a specific type
  app.get('/store-types/:type/stores', async (c) => {
    const storeType = c.req.param('type') as StoreType;

    // Validate store type exists
    const typeInfo = STORE_TYPE_METADATA[storeType];
    if (!typeInfo) {
      return c.json({ error: 'Store type not found' }, 404);
    }

    const instances = await getStoreInstancesByType(storeType);
    return c.json({
      storeType: {
        storeType,
        name: typeInfo.name,
        chain: typeInfo.chain,
      },
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
      postalCode?: string;
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
        if (!body.postalCode) {
          return c.json({ error: 'postalCode is required for safeway' }, 400);
        }
        identifiers = { type: 'safeway', storeId: body.storeId, postalCode: body.postalCode };
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
  // Use ?force=true to clear existing data and re-scrape
  app.post('/admin/kingsoopers/scrape/auto', async (c) => {
    const storeId = c.req.query('storeId');
    const facilityId = c.req.query('facilityId');
    const storeName = c.req.query('storeName');
    const force = c.req.query('force') === 'true';

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

    // 3. Check for existing circular (deduplication) - skip if force=true
    const existingCircular = await getCircular(storeInstance.instanceId, weekId);

    if (!force && existingCircular && existingCircular.circularId === weeklyAdMeta.circularId) {
      return c.json({
        success: true,
        alreadyScraped: true,
        weekId,
        circularId: weeklyAdMeta.circularId,
        storeInstanceId: storeInstance.instanceId,
        existingDealCount: existingCircular.dealCount,
      });
    }

    // 4. If force=true, delete existing circular and deals first
    let deletedCount = 0;
    if (force && existingCircular) {
      const deleteResult = await deleteCircularAndDeals(storeInstance.instanceId, weekId);
      deletedCount = deleteResult.deletedCount;
    }

    // 5. Scrape and persist deals
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
      forced: force,
      ...(force && deletedCount > 0 && { deletedCount }),
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
  // Safeway Admin Endpoints
  // ===================

  // Fetch available publications (circulars) from Flipp API
  app.get('/admin/safeway/circulars', async (c) => {
    const storeId = c.req.query('storeId');
    const postalCode = c.req.query('postalCode');

    if (!storeId || !postalCode) {
      return c.json({ error: 'storeId and postalCode are required' }, 400);
    }

    try {
      const result = await fetchSafewayPublications(storeId, postalCode);
      return c.json({
        weeklyAdCircularId: result.weeklyAdPublicationId?.toString() || null,
        circulars: result.publications.map((pub) => ({
          id: pub.id.toString(),
          name: pub.external_display_name,
          startDate: pub.valid_from,
          endDate: pub.valid_to,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Preview deals from Safeway/Flipp API (no persist)
  app.get('/admin/safeway/deals', async (c) => {
    const storeId = c.req.query('storeId');
    const postalCode = c.req.query('postalCode');
    const circularId = c.req.query('circularId');

    if (!storeId || !postalCode) {
      return c.json({ error: 'storeId and postalCode are required' }, 400);
    }

    try {
      let publicationId: string;

      if (circularId) {
        publicationId = circularId;
      } else {
        // Auto-detect weekly ad publication
        const { weeklyAdPublicationId } = await fetchSafewayPublications(storeId, postalCode);
        if (!weeklyAdPublicationId) {
          return c.json({ error: 'No Weekly Ad publication found' }, 404);
        }
        publicationId = weeklyAdPublicationId.toString();
      }

      const deals = await fetchSafewayWeeklyDeals(publicationId);
      return c.json({ deals, count: deals.length, circularId: publicationId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Manual scrape: fetch and persist deals to DynamoDB
  app.post('/admin/safeway/scrape', async (c) => {
    const storeId = c.req.query('storeId');
    const postalCode = c.req.query('postalCode');
    const circularId = c.req.query('circularId');
    const storeName = c.req.query('storeName');

    if (!storeId || !postalCode || !circularId) {
      return c.json({ error: 'storeId, postalCode, and circularId are required' }, 400);
    }

    const weekId = c.req.query('weekId') ?? getCurrentWeekId();

    // Get or create the store instance
    const identifiers: StoreIdentifiers = {
      type: 'safeway',
      storeId,
      postalCode,
    };

    const storeInstance = await getOrCreateStoreInstance(
      identifiers,
      storeName || `Safeway (${storeId})`
    );

    const result = await fetchAndPersistSafewayWeeklyDeals(
      circularId,
      storeInstance.instanceId,
      weekId
    );

    return c.json({
      success: true,
      weekId,
      storeInstanceId: storeInstance.instanceId,
      circularId,
      dealCount: result.deals.length,
      persisted: result.persisted,
    });
  });

  // Auto-scrape: fetch circularId + scrape with deduplication
  // Use ?force=true to clear existing data and re-scrape
  app.post('/admin/safeway/scrape/auto', async (c) => {
    const storeId = c.req.query('storeId');
    const postalCode = c.req.query('postalCode');
    const storeName = c.req.query('storeName');
    const force = c.req.query('force') === 'true';

    if (!storeId || !postalCode) {
      return c.json({ error: 'storeId and postalCode are required' }, 400);
    }

    // 1. Fetch publications and extract weeklyAd metadata
    const { publications } = await fetchSafewayPublications(storeId, postalCode);
    const weeklyAdMeta = extractSafewayWeeklyAdMetadata(publications);

    if (!weeklyAdMeta) {
      return c.json({ error: 'No Weekly Ad publication found' }, 404);
    }

    const weekId = getCurrentWeekId();

    // 2. Get or create store instance
    const identifiers: StoreIdentifiers = {
      type: 'safeway',
      storeId,
      postalCode,
    };

    const storeInstance = await getOrCreateStoreInstance(
      identifiers,
      storeName || `Safeway (${storeId})`
    );

    // 3. Check for existing circular (deduplication) - skip if force=true
    const existingCircular = await getCircular(storeInstance.instanceId, weekId);

    if (!force && existingCircular && existingCircular.circularId === weeklyAdMeta.circularId) {
      return c.json({
        success: true,
        alreadyScraped: true,
        weekId,
        circularId: weeklyAdMeta.circularId,
        storeInstanceId: storeInstance.instanceId,
        existingDealCount: existingCircular.dealCount,
      });
    }

    // 4. If force=true, delete existing circular and deals first
    let deletedCount = 0;
    if (force && existingCircular) {
      const deleteResult = await deleteCircularAndDeals(storeInstance.instanceId, weekId);
      deletedCount = deleteResult.deletedCount;
    }

    // 5. Scrape and persist deals
    const result = await fetchAndPersistSafewayWeeklyDeals(
      weeklyAdMeta.circularId,
      storeInstance.instanceId,
      weekId,
      { startDate: weeklyAdMeta.startDate, endDate: weeklyAdMeta.endDate }
    );

    return c.json({
      success: true,
      alreadyScraped: false,
      forced: force,
      ...(force && deletedCount > 0 && { deletedCount }),
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
        const storeTypeMeta = storeInstance
          ? STORE_TYPE_METADATA[storeInstance.storeType]
          : null;

        return {
          instanceId: us.storeInstanceId,
          name: storeInstance?.name || us.storeInstanceId,
          storeType: storeInstance?.storeType,
          chain: storeTypeMeta?.chain,
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
    const storeTypeMeta = STORE_TYPE_METADATA[storeInstance.storeType];

    return c.json({
      success: true,
      store: {
        instanceId: userStore.storeInstanceId,
        name: storeInstance.name,
        storeType: storeInstance.storeType,
        chain: storeTypeMeta?.chain,
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