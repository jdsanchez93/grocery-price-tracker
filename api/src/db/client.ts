import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';
import {
  Keys,
  DealItem,
  StoreInstanceItem,
  UserItem,
  UserStoreItem,
  CircularItem,
  getCurrentWeekId,
  StoreType,
  StoreIdentifiers,
  StoreAddress,
  generateStoreInstanceId,
} from '../types/database';
import { StandardDeal } from '../scraper/kingsoopers';
import { normalizeDept } from '../scraper/products';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'GroceryDeals';

const STORES_CACHE_TTL_MS = 5 * 60 * 1000;
let storesCacheData: StoreInstanceItem[] | null = null;
let storesCacheTime = 0;
function invalidateStoresCache(): void { storesCacheData = null; storesCacheTime = 0; }

const CIRCULARS_CACHE_TTL_MS = 5 * 60 * 1000;
let circularsCacheData: CircularItem[] | null = null;
let circularsCacheTime = 0;
function invalidateCircularsCache(): void { circularsCacheData = null; circularsCacheTime = 0; }

// Generate a unique deal ID from deal content using SHA-256 (truncated)
function generateDealId(deal: StandardDeal): string {
  const normalized = `${deal.name || ''}-${deal.priceDisplay}-${deal.dept}-${deal.details || ''}-${deal.image || ''}`.toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 12);
}

// Deals
export async function writeDeal(
  storeInstanceId: string,
  weekId: string,
  deal: StandardDeal,
  canonicalProductId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const dealId = generateDealId(deal);

  const item: DealItem = {
    PK: Keys.deal.pk(storeInstanceId, weekId),
    SK: Keys.deal.sk(dealId),
    entityType: 'DEAL',
    dealId,
    storeInstanceId,
    weekId,
    name: deal.name,
    details: deal.details,
    dept: deal.dept ? normalizeDept(deal.dept, deal.name) : deal.dept,
    priceDisplay: deal.priceDisplay,
    priceNumber: deal.priceNumber,
    quantity: deal.quantity,
    loyalty: deal.loyalty,
    image: deal.image,
    canonicalProductId,
    ...(deal.upcs && deal.upcs.length > 0 && { upcs: deal.upcs }),
    ...(deal.priceVariants && deal.priceVariants.length > 0 && {
      priceVariants: deal.priceVariants,
    }),
    createdAt: now,
    updatedAt: now,
    // GSI1 for price history (only if we have a canonical product)
    ...(canonicalProductId && {
      GSI1PK: Keys.gsi1.pk(canonicalProductId),
      GSI1SK: Keys.gsi1.sk(weekId, storeInstanceId),
    }),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

export async function writeDeals(
  storeInstanceId: string,
  weekId: string,
  deals: StandardDeal[],
  getCanonicalId?: (deal: StandardDeal) => string | undefined
): Promise<void> {
  // DynamoDB BatchWrite supports max 25 items
  const BATCH_SIZE = 25;
  const now = new Date().toISOString();

  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = deals.slice(i, i + BATCH_SIZE);
    const requests = batch.map((deal) => {
      const dealId = generateDealId(deal);
      const canonicalProductId = getCanonicalId?.(deal);

      const item: DealItem = {
        PK: Keys.deal.pk(storeInstanceId, weekId),
        SK: Keys.deal.sk(dealId),
        entityType: 'DEAL',
        dealId,
        storeInstanceId,
        weekId,
        name: deal.name,
        details: deal.details,
        dept: deal.dept ? normalizeDept(deal.dept, deal.name) : deal.dept,
        priceDisplay: deal.priceDisplay,
        priceNumber: deal.priceNumber,
        quantity: deal.quantity,
        loyalty: deal.loyalty,
        image: deal.image,
        canonicalProductId,
        ...(deal.upcs && deal.upcs.length > 0 && { upcs: deal.upcs }),
        ...(deal.priceVariants && deal.priceVariants.length > 0 && {
          priceVariants: deal.priceVariants,
        }),
        createdAt: now,
        updatedAt: now,
        ...(canonicalProductId && {
          GSI1PK: Keys.gsi1.pk(canonicalProductId),
          GSI1SK: Keys.gsi1.sk(weekId, storeInstanceId),
        }),
      };

      return { PutRequest: { Item: item } };
    });

    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: requests,
      },
    }));
  }
}

export async function getDealsForStoreWeek(
  storeInstanceId: string,
  weekId: string = getCurrentWeekId()
): Promise<DealItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': Keys.deal.pk(storeInstanceId, weekId),
      ':skPrefix': 'DEAL#',
    },
  }));

  return (result.Items || []) as DealItem[];
}

// ===================
// Store Instances
// ===================
export async function getAllStores(): Promise<StoreInstanceItem[]> {
  const now = Date.now();
  if (storesCacheData !== null && now - storesCacheTime < STORES_CACHE_TTL_MS) {
    return storesCacheData;
  }

  // Stores are queried via scan rather than GSI2 because StoreInstanceItem has no
  // weekId attribute (the GSI2 sort key), so store items are not indexed in GSI2.
  // With ~5 stores this scan is negligible and is cached for 5 minutes.
  const items: StoreInstanceItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'STORE_INSTANCE' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...((result.Items || []) as StoreInstanceItem[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  storesCacheData = items;
  storesCacheTime = Date.now();
  return storesCacheData;
}

export async function getAllCirculars(): Promise<CircularItem[]> {
  const now = Date.now();
  if (circularsCacheData !== null && now - circularsCacheTime < CIRCULARS_CACHE_TTL_MS) {
    return circularsCacheData;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI2',
    KeyConditionExpression: 'entityType = :et',
    ExpressionAttributeValues: { ':et': 'CIRCULAR' },
  }));

  circularsCacheData = (result.Items || []) as CircularItem[];
  circularsCacheTime = Date.now();
  return circularsCacheData;
}

export async function getStoreInstance(instanceId: string): Promise<StoreInstanceItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: Keys.storeInstance.pk(instanceId),
      SK: Keys.storeInstance.sk(),
    },
  }));

  return (result.Item as StoreInstanceItem) || null;
}


export async function writeStoreInstance(
  identifiers: StoreIdentifiers,
  name: string,
  enabled: boolean = true,
  address?: StoreAddress
): Promise<StoreInstanceItem> {
  const now = new Date().toISOString();
  const instanceId = generateStoreInstanceId(identifiers);

  const item: StoreInstanceItem = {
    PK: Keys.storeInstance.pk(instanceId),
    SK: Keys.storeInstance.sk(),
    entityType: 'STORE_INSTANCE',
    instanceId,
    storeType: identifiers.type,
    name,
    identifiers,
    enabled,
    ...(address && { address }),
    createdAt: now,
    updatedAt: now,
  };

  invalidateStoresCache();
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function updateStoreInstance(
  instanceId: string,
  updates: { name: string; address?: StoreAddress }
): Promise<StoreInstanceItem | null> {
  const now = new Date().toISOString();

  const hasAddress = !!updates.address;
  const updateExpression = hasAddress
    ? 'SET #name = :name, updatedAt = :now, address = :addr'
    : 'SET #name = :name, updatedAt = :now REMOVE address';

  const expressionAttributeValues: Record<string, unknown> = {
    ':name': updates.name,
    ':now': now,
    ...(hasAddress && { ':addr': updates.address }),
  };

  try {
    invalidateStoresCache();
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: Keys.storeInstance.pk(instanceId),
        SK: Keys.storeInstance.sk(),
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes as StoreInstanceItem;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return null;
    }
    throw err;
  }
}

export async function getOrCreateStoreInstance(
  identifiers: StoreIdentifiers,
  name: string
): Promise<StoreInstanceItem> {
  const instanceId = generateStoreInstanceId(identifiers);
  const existing = await getStoreInstance(instanceId);

  if (existing) {
    return existing;
  }

  return writeStoreInstance(identifiers, name);
}

// Users
export async function getUser(userId: string): Promise<UserItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: Keys.user.pk(userId),
      SK: Keys.user.sk(),
    },
  }));

  return (result.Item as UserItem) || null;
}

export async function createUser(userId: string, email: string, name?: string, onboarded?: boolean): Promise<UserItem> {
  const now = new Date().toISOString();

  const item: UserItem = {
    PK: Keys.user.pk(userId),
    SK: Keys.user.sk(),
    entityType: 'USER',
    userId,
    email,
    name,
    ...(onboarded !== undefined && { onboarded }),
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function updateUserOnboarded(userId: string): Promise<void> {
  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: Keys.user.pk(userId),
      SK: Keys.user.sk(),
    },
    UpdateExpression: 'SET onboarded = :onboarded, updatedAt = :now',
    ExpressionAttributeValues: {
      ':onboarded': true,
      ':now': now,
    },
  }));
}


// User Stores
export async function getUserStores(userId: string): Promise<UserStoreItem[]> {
  // Query for new format (STOREINSTANCE#)
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': Keys.user.pk(userId),
      ':skPrefix': 'STOREINSTANCE#',
    },
  }));

  return (result.Items || []) as UserStoreItem[];
}

export async function addUserStore(userId: string, storeInstanceId: string): Promise<UserStoreItem> {
  const now = new Date().toISOString();

  const item: UserStoreItem = {
    PK: Keys.userStore.pk(userId),
    SK: Keys.userStore.sk(storeInstanceId),
    entityType: 'USER_STORE',
    userId,
    storeInstanceId,
    addedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function removeUserStore(userId: string, storeInstanceId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: Keys.userStore.pk(userId),
      SK: Keys.userStore.sk(storeInstanceId),
    },
  }));
}

export async function getDealsForUserStores(
  userId: string,
  weekId: string = getCurrentWeekId()
): Promise<DealItem[]> {
  // 1. Get user's store instances
  const userStores = await getUserStores(userId);

  if (userStores.length === 0) {
    return [];
  }

  // 2. Query deals for each store instance (in parallel)
  const dealPromises = userStores.map((us) =>
    getDealsForStoreWeek(us.storeInstanceId, weekId)
  );

  const results = await Promise.all(dealPromises);

  // 3. Merge and return
  return results.flat();
}

// Price History
export async function getPriceHistory(
  canonicalProductId: string,
  storeInstanceIds?: string[],
  limit?: number
): Promise<DealItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': Keys.gsi1.pk(canonicalProductId),
    },
    ScanIndexForward: false, // Most recent first
    ...(limit != null && { Limit: limit }),
  }));

  let items = (result.Items || []) as DealItem[];

  // Filter by store instances if specified
  if (storeInstanceIds && storeInstanceIds.length > 0) {
    items = items.filter((item) => storeInstanceIds.includes(item.storeInstanceId));
  }

  return items;
}

// Circular metadata
export async function getCircular(
  storeInstanceId: string,
  weekId: string
): Promise<CircularItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: Keys.circular.pk(storeInstanceId, weekId),
      SK: Keys.circular.sk(),
    },
  }));
  return (result.Item as CircularItem) || null;
}

export async function writeCircular(
  storeInstanceId: string,
  weekId: string,
  circularId: string,
  startDate: string,
  endDate: string,
  dealCount: number
): Promise<void> {
  invalidateCircularsCache();
  const now = new Date().toISOString();

  const item: CircularItem = {
    PK: Keys.circular.pk(storeInstanceId, weekId),
    SK: Keys.circular.sk(),
    entityType: 'CIRCULAR',
    storeInstanceId,
    weekId,
    circularId,
    startDate,
    endDate,
    dealCount,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

// Delete circular and all deals for a store/week
export async function deleteCircularAndDeals(
  storeInstanceId: string,
  weekId: string
): Promise<{ deletedCount: number }> {
  const pk = Keys.circular.pk(storeInstanceId, weekId);

  // Query all items with this PK (circular metadata + all deals)
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': pk,
    },
    ProjectionExpression: 'PK, SK',
  }));

  const items = result.Items || [];
  if (items.length === 0) {
    return { deletedCount: 0 };
  }

  // Batch delete (max 25 items per batch)
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const deleteRequests = batch.map((item) => ({
      DeleteRequest: {
        Key: { PK: item.PK, SK: item.SK },
      },
    }));

    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: deleteRequests,
      },
    }));
  }

  return { deletedCount: items.length };
}
