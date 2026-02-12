// DynamoDB Single-Table Design Types
// Table: GroceryDeals

// Key patterns:
// Deal:          PK = STORE#<instanceId>#WEEK#<week>   SK = DEAL#<id>
// StoreType:     PK = STORETYPE#<type>                 SK = METADATA
// StoreInstance: PK = STOREINSTANCE#<instanceId>       SK = METADATA
// Circular:      PK = STORE#<instanceId>#WEEK#<week>   SK = METADATA
// Product:       PK = PRODUCT#<canonical_id>           SK = METADATA
// User:          PK = USER#<userId>                    SK = PROFILE
// UserStore:     PK = USER#<userId>                    SK = STOREINSTANCE#<instanceId>

// GSI1 (Price History): GSI1PK = PRODUCT#<id>  GSI1SK = <date>#<instanceId>
// GSI2 (Browse):        GSI2PK = WEEK#<week>   GSI2SK = STORE#<instanceId>#DEPT#<dept>

// Store instance ID format: {storeType}:{hash}
// Example: kingsoopers:a1b2c3d4

import * as crypto from 'crypto';

// ===================
// Store Identifiers (Discriminated Union)
// ===================

export type StoreIdentifiers =
  | { type: 'kingsoopers'; storeId: string; facilityId: string }
  | { type: 'safeway'; storeId: string }
  | { type: 'sprouts'; storeId: string };

export type StoreType = StoreIdentifiers['type'];

// Generate a unique store instance ID from identifiers
export function generateStoreInstanceId(identifiers: StoreIdentifiers): string {
  let dataToHash: string;

  switch (identifiers.type) {
    case 'kingsoopers':
      dataToHash = `${identifiers.storeId}:${identifiers.facilityId}`;
      break;
    case 'safeway':
    case 'sprouts':
      dataToHash = identifiers.storeId;
      break;
  }

  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex').substring(0, 8);
  return `${identifiers.type}:${hash}`;
}

export interface BaseItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealItem extends BaseItem {
  entityType: 'DEAL';
  dealId: string;
  storeInstanceId: string; // e.g., "kingsoopers:a1b2c3d4"
  weekId: string; // ISO week format: 2026-W04
  name: string | undefined;
  details: string | undefined;
  dept: string;
  priceDisplay: string;
  priceNumber: number | null;
  quantity: number;
  loyalty: string | undefined;
  image: string | undefined;
  canonicalProductId?: string;
}

// Store type (e.g., "kingsoopers", "safeway", "sprouts")
export interface StoreTypeItem extends BaseItem {
  entityType: 'STORE_TYPE';
  storeType: StoreType;
  name: string; // Display name, e.g., "King Soopers"
  chain: string; // Parent chain, e.g., "kroger"
  enabled: boolean;
}

// New: Store instance (specific physical location)
export interface StoreInstanceItem extends BaseItem {
  entityType: 'STORE_INSTANCE';
  instanceId: string; // e.g., "kingsoopers:a1b2c3d4"
  storeType: StoreType;
  name: string; // Display name, e.g., "King Soopers - Boulder"
  identifiers: StoreIdentifiers;
  enabled: boolean;
}

export interface CircularItem extends BaseItem {
  entityType: 'CIRCULAR';
  storeInstanceId: string; // e.g., "kingsoopers:a1b2c3d4"
  weekId: string;
  circularId: string;
  startDate: string;
  endDate: string;
  dealCount: number;
}

export interface ProductItem extends BaseItem {
  entityType: 'PRODUCT';
  canonicalId: string;
  displayName: string;
  category: string;
  aliases: string[]; // Alternative names that map to this product
}

export interface UserItem extends BaseItem {
  entityType: 'USER';
  userId: string;
  email: string;
  name?: string;
}

export interface UserStoreItem extends BaseItem {
  entityType: 'USER_STORE';
  userId: string;
  storeInstanceId: string; // e.g., "kingsoopers:a1b2c3d4"
  addedAt: string;
}

// Union type for all item types
export type DynamoDBItem =
  | DealItem
  | StoreTypeItem
  | StoreInstanceItem
  | CircularItem
  | ProductItem
  | UserItem
  | UserStoreItem;

// Key builders
export const Keys = {
  deal: {
    // Now uses storeInstanceId
    pk: (storeInstanceId: string, weekId: string) => `STORE#${storeInstanceId}#WEEK#${weekId}`,
    sk: (dealId: string) => `DEAL#${dealId}`,
  },
  // Store type keys
  storeType: {
    pk: (storeType: StoreType) => `STORETYPE#${storeType}`,
    sk: () => 'METADATA',
  },
  // New: Store instance keys
  storeInstance: {
    pk: (instanceId: string) => `STOREINSTANCE#${instanceId}`,
    sk: () => 'METADATA',
  },
  circular: {
    // Now uses storeInstanceId
    pk: (storeInstanceId: string, weekId: string) => `STORE#${storeInstanceId}#WEEK#${weekId}`,
    sk: () => 'METADATA',
  },
  product: {
    pk: (canonicalId: string) => `PRODUCT#${canonicalId}`,
    sk: () => 'METADATA',
  },
  user: {
    pk: (userId: string) => `USER#${userId}`,
    sk: () => 'PROFILE',
  },
  userStore: {
    pk: (userId: string) => `USER#${userId}`,
    sk: (storeInstanceId: string) => `STOREINSTANCE#${storeInstanceId}`,
  },
  // GSI keys
  gsi1: {
    // Price history: query by product across stores/dates
    pk: (canonicalProductId: string) => `PRODUCT#${canonicalProductId}`,
    sk: (date: string, storeInstanceId: string) => `${date}#${storeInstanceId}`,
  },
  gsi2: {
    // Browse: query by week, filter by store/dept
    pk: (weekId: string) => `WEEK#${weekId}`,
    sk: (storeInstanceId: string, dept: string) => `STORE#${storeInstanceId}#DEPT#${dept}`,
  },
};

// Helper to extract store type from instance ID
export function getStoreTypeFromInstanceId(instanceId: string): StoreType {
  const [type] = instanceId.split(':');
  return type as StoreType;
}

// Helper to get current grocery week ID (weeks start on Wednesday when new ads release)
export function getCurrentWeekId(): string {
  const now = new Date();
  // Shift date back 3 days so Wednesday becomes the start of a new week
  const adjusted = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startOfYear = new Date(adjusted.getFullYear(), 0, 1);
  const days = Math.floor((adjusted.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${adjusted.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Helper to get ISO date string
export function getISODate(): string {
  return new Date().toISOString().split('T')[0];
}
