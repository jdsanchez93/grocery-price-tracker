import { Hono } from 'hono';
import {
  fetchWeeklyDeals,
  fetchAndPersistWeeklyDeals,
  fetchCirculars,
  extractWeeklyAdMetadata,
} from './scraper/kingsoopers';
import {
  fetchPublications as fetchSafewayPublications,
  extractWeeklyAdMetadata as extractSafewayWeeklyAdMetadata,
  fetchWeeklyDeals as fetchSafewayWeeklyDeals,
  fetchAndPersistWeeklyDeals as fetchAndPersistSafewayWeeklyDeals,
} from './scraper/safeway';
import { authMiddleware, requirePermission, getAuthUser, hasPermission } from './middleware/auth';
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
  writeStoreInstance,
  getCircular,
  deleteCircularAndDeals,
  getAllStores,
} from './db/client';
import {
  getCurrentWeekId,
  StoreType,
  StoreIdentifiers,
  StoreAddress,
  STORE_TYPE_METADATA,
  getWeekIdForDate,
} from './types/database';


export function createApp() {
  const app = new Hono().basePath('/api');

  app.use('/*', authMiddleware({ required: true }));

  // ===================
  // Store Endpoints (/stores/*)
  // ===================

  // List store instances for a specific type
  app.get('/stores/:type', requirePermission('stores:read'), async (c) => {
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

  // Get all stores
  // TODO re-work -- either move from /admin to /stores or merge with /admin/scrape/status
  app.get('/admin/stores', requirePermission('scraper:run'), async (c) => {
    const stores = await getAllStores();
    if (!stores) {
      return c.json({ error: 'No stores found' }, 404);
    }
    return c.json(stores);
  });

  // Create a store instance
  app.post('/admin/stores', requirePermission('stores:write'), async (c) => {
    const body = await c.req.json<{
      type: StoreType;
      name: string;
      storeId: string;
      facilityId?: string;
      postalCode?: string;
      address?: { addressLine1?: string; city?: string; state?: string; zipCode?: string };
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

    const address = body.address as StoreAddress | undefined;
    const instance = await writeStoreInstance(identifiers, body.name, true, address);

    return c.json({
      success: true,
      store: instance,
    });
  });

  // Get scrape status for store(s)
  app.get('/admin/scrape/status', requirePermission('scraper:run'), async (c) => {
    const instanceIds = c.req.query('instanceIds');
    if (!instanceIds) {
      return c.json({ error: 'instanceIds is required' }, 400);
    }

    const currentWeekId = getCurrentWeekId();
    const instanceIdArray: string[] = instanceIds.split(',');

    const entries = await Promise.all(
      instanceIdArray.map(async (id) => {
        const circular = await getCircular(id, currentWeekId);
        return [id, circular
          ? { scraped: true, dealCount: circular.dealCount, circularId: circular.circularId }
          : { scraped: false }
        ] as const;
      })
    );
    const status = Object.fromEntries(entries);
    return c.json(status);
  });

  // Fetch available circulars for a store instance
  app.get('/admin/scrape/circulars', requirePermission('scraper:run'), async (c) => {
    const instanceId = c.req.query('instanceId');
    if (!instanceId) {
      return c.json({ error: 'instanceId is required' }, 400);
    }

    const storeInstance = await getStoreInstance(instanceId);
    if (!storeInstance) {
      return c.json({ error: 'Store instance not found' }, 404);
    }

    try {
      switch (storeInstance.identifiers.type) {
        case 'kingsoopers': {
          const result = await fetchCirculars(storeInstance.identifiers);
          return c.json({
            weeklyAdCircularId: result.weeklyAdCircularId,
            circulars: result.circulars.map((circ) => ({
              id: circ.id,
              name: circ.eventName,
              startDate: circ.eventStartDate,
              endDate: circ.eventEndDate,
            })),
          });
        }
        case 'safeway': {
          const result = await fetchSafewayPublications(storeInstance.identifiers);
          return c.json({
            weeklyAdCircularId: result.weeklyAdPublicationId?.toString() || null,
            circulars: result.publications.map((pub) => ({
              id: pub.id.toString(),
              name: pub.external_display_name,
              startDate: pub.valid_from,
              endDate: pub.valid_to,
            })),
          });
        }
        case 'sprouts':
          return c.json({ error: 'Sprouts scraping not yet implemented' }, 501);
        default: {
          const _exhaustive: never = storeInstance.identifiers;
          return c.json({ error: 'Unknown store type' }, 400);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Preview deals for a store instance (no persist)
  app.get('/admin/scrape/deals', requirePermission('scraper:run'), async (c) => {
    const instanceId = c.req.query('instanceId');
    const circularId = c.req.query('circularId');

    if (!instanceId) {
      return c.json({ error: 'instanceId is required' }, 400);
    }

    const storeInstance = await getStoreInstance(instanceId);
    if (!storeInstance) {
      return c.json({ error: 'Store instance not found' }, 404);
    }

    try {
      switch (storeInstance.identifiers.type) {
        case 'kingsoopers': {
          if (!circularId) {
            return c.json({ error: 'circularId is required for King Soopers' }, 400);
          }
          const deals = await fetchWeeklyDeals(circularId, storeInstance.identifiers);
          return c.json({ deals, count: deals.length });
        }
        case 'safeway': {
          let publicationId: string;
          if (circularId) {
            publicationId = circularId;
          } else {
            const { weeklyAdPublicationId } = await fetchSafewayPublications(storeInstance.identifiers);
            if (!weeklyAdPublicationId) {
              return c.json({ error: 'No Weekly Ad publication found' }, 404);
            }
            publicationId = weeklyAdPublicationId.toString();
          }
          const deals = await fetchSafewayWeeklyDeals(publicationId);
          return c.json({ deals, count: deals.length, circularId: publicationId });
        }
        case 'sprouts':
          return c.json({ error: 'Sprouts scraping not yet implemented' }, 501);
        default: {
          const _exhaustive: never = storeInstance.identifiers;
          return c.json({ error: 'Unknown store type' }, 400);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });


  // Auto-scrape: fetch circularId + scrape with deduplication
  // Use ?force=true to clear existing data and re-scrape
  app.post('/admin/scrape/auto', requirePermission('scraper:run'), async (c) => {
    const instanceId = c.req.query('instanceId');
    const force = c.req.query('force') === 'true';

    if (!instanceId) {
      return c.json({ error: 'instanceId is required' }, 400);
    }

    const storeInstance = await getStoreInstance(instanceId);
    if (!storeInstance) {
      return c.json({ error: 'Store instance not found' }, 404);
    }

    // Fetch circulars and extract weekly ad metadata (chain-specific)
    let weeklyAdMeta;
    switch (storeInstance.identifiers.type) {
      case 'kingsoopers': {
        const { circulars } = await fetchCirculars(storeInstance.identifiers);
        weeklyAdMeta = extractWeeklyAdMetadata(circulars);
        break;
      }
      case 'safeway': {
        const { publications } = await fetchSafewayPublications(storeInstance.identifiers);
        weeklyAdMeta = extractSafewayWeeklyAdMetadata(publications);
        break;
      }
      case 'sprouts':
        return c.json({ error: 'Sprouts scraping not yet implemented' }, 501);
      default: {
        const _exhaustive: never = storeInstance.identifiers;
        return c.json({ error: 'Unknown store type' }, 400);
      }
    }

    if (!weeklyAdMeta) {
      return c.json({ error: 'No weekly ad circular found' }, 404);
    }

    const localDate = new Date(weeklyAdMeta.startDate.split('T')[0] + 'T12:00:00');
    const weekId = getWeekIdForDate(localDate);

    // Check for existing circular (deduplication)
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

    // If force=true, delete existing circular and deals first
    let deletedCount = 0;
    if (force && existingCircular) {
      const deleteResult = await deleteCircularAndDeals(storeInstance.instanceId, weekId);
      deletedCount = deleteResult.deletedCount;
    }

    // Scrape and persist deals (chain-specific)
    let result;
    switch (storeInstance.identifiers.type) {
      case 'kingsoopers':
        result = await fetchAndPersistWeeklyDeals(
          weeklyAdMeta.circularId, storeInstance.identifiers, storeInstance.instanceId,
          weekId, { startDate: weeklyAdMeta.startDate, endDate: weeklyAdMeta.endDate }
        );
        break;
      case 'safeway':
        result = await fetchAndPersistSafewayWeeklyDeals(
          weeklyAdMeta.circularId, storeInstance.instanceId,
          weekId, { startDate: weeklyAdMeta.startDate, endDate: weeklyAdMeta.endDate }
        );
        break;
    }

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

  // Get current week ID
  app.get('/me/week', requirePermission('deals:read'), (c) => {
    return c.json({ weekId: getCurrentWeekId() });
  });

  // Get user's selected stores (now returns store instances)
  app.get('/me/stores', requirePermission('user-stores:read'), async (c) => {
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
          address: storeInstance?.address,
          addedAt: us.addedAt,
        };
      })
    );

    return c.json({ stores: storesWithDetails });
  });

  // Add store instance to user's selection
  app.post('/me/stores/:instanceId', requirePermission('user-stores:write'), async (c) => {
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
        address: storeInstance.address,
        addedAt: userStore.addedAt,
      },
    });
  });

  // Remove store instance from user's selection
  app.delete('/me/stores/:instanceId', requirePermission('user-stores:write'), async (c) => {
    const user = getAuthUser(c);
    const instanceId = c.req.param('instanceId');

    await removeUserStore(user.userId, instanceId);

    return c.json({ success: true });
  });

  // Get deals from user's selected stores
  app.get('/me/deals', requirePermission('deals:read'), async (c) => {
    const user = getAuthUser(c);
    const currentWeekId = getCurrentWeekId();
    const weekId = c.req.query('week') ?? currentWeekId;

    if (weekId !== currentWeekId && !hasPermission(c, 'history:read')) {
      return c.json({ error: 'history:read permission required for historical week access' }, 403);
    }

    const deals = await getDealsForUserStores(user.userId, weekId);

    return c.json({
      weekId,
      deals,
      count: deals.length,
    });
  });

  // Get price history for a product (requires deals:read + history:read permissions)
  app.get('/me/products/:id/history', requirePermission('deals:read', 'history:read'), async (c) => {
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