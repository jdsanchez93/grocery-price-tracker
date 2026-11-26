// DynamoDB Single-Table Design Types
// Table: GroceryDeals

// Key patterns:
// Deal:          PK = STORE#<instanceId>#WEEK#<week>   SK = DEAL#<id>
// StoreInstance: PK = STOREINSTANCE#<instanceId>       SK = METADATA
// Circular:      PK = STORE#<instanceId>#WEEK#<week>   SK = METADATA
// Product:       PK = PRODUCT#<canonical_id>           SK = METADATA
// User:          PK = USER#<userId>                    SK = PROFILE
// UserStore:     PK = USER#<userId>                    SK = STOREINSTANCE#<instanceId>

// GSI1 (Price History): GSI1PK = PRODUCT#<id>  GSI1SK = <date>#<instanceId>
// GSI2 (Entity Type):   GSI2PK = entityType     GSI2SK = weekId

// Store instance ID format: {storeType}:{hash}
// Example: kingsoopers:a1b2c3d4

import * as crypto from 'crypto';

// ===================
// Store Identifiers (Discriminated Union)
// ===================

export type StoreIdentifiers =
  | { type: 'kingsoopers'; storeId: string; facilityId: string }
  | { type: 'safeway'; storeId: string; postalCode: string }
  | { type: 'sprouts'; storeId: string };

export type StoreType = StoreIdentifiers['type'];

export type KingSoopersIdentifiers = Extract<StoreIdentifiers, { type: 'kingsoopers' }>;
export type SafewayIdentifiers = Extract<StoreIdentifiers, { type: 'safeway' }>;
export type SproutsIdentifiers = Extract<StoreIdentifiers, { type: 'sprouts' }>;

export const STORE_TYPE_METADATA: Record<StoreType, { name: string; chain: string }> = {
  kingsoopers: { name: 'King Soopers', chain: 'kroger' },
  safeway: { name: 'Safeway', chain: 'albertsons' },
  sprouts: { name: 'Sprouts', chain: 'sprouts' },
};

// Generate a unique store instance ID from identifiers
export function generateStoreInstanceId(identifiers: StoreIdentifiers): string {
  let dataToHash: string;

  switch (identifiers.type) {
    case 'kingsoopers':
      dataToHash = `${identifiers.storeId}:${identifiers.facilityId}`;
      break;
    case 'safeway':
      dataToHash = `${identifiers.storeId}:${identifiers.postalCode}`;
      break;
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
  createdAt: string;
  updatedAt: string;
}

export interface PriceVariant {
  price: number;
  example: string;
  perLb?: number;
  avgWeight?: number;
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
  upcs?: string[];
  priceVariants?: PriceVariant[];
}

export interface StoreAddress {
  addressLine1: string;
  city: string;
  state: string;
  zipCode?: string;
}

// Store instance (specific physical location)
export interface StoreInstanceItem extends BaseItem {
  entityType: 'STORE_INSTANCE';
  instanceId: string; // e.g., "kingsoopers:a1b2c3d4"
  storeType: StoreType;
  name: string; // Display name, e.g., "King Soopers - Boulder"
  identifiers: StoreIdentifiers;
  enabled: boolean;
  address?: StoreAddress;
  timezone: string; // IANA timezone name, e.g., "America/Denver"
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
  onboarded?: boolean;
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
    sk: (weekId: string, storeInstanceId: string) => `${weekId}#${storeInstanceId}`,
  },
};

// Helper to extract store type from instance ID
export function getStoreTypeFromInstanceId(instanceId: string): StoreType {
  const [type] = instanceId.split(':');
  return type as StoreType;
}

// Helper to get current grocery week ID (weeks start on Wednesday when new ads release)
export function getWeekIdForDate(date: Date): string {
  // Shift date back 3 days so Wednesday becomes the start of a new week
  const adjusted = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startOfYear = new Date(adjusted.getFullYear(), 0, 1);
  const days = Math.floor((adjusted.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${adjusted.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Today's calendar date in a specific IANA timezone, as "YYYY-MM-DD"
export function todayInStoreTz(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
}

// Longest circular we expect, in days. Normal ads run 7 (Wed→Tue); holiday ads run
// longer (Thanksgiving 2026 ran 9: Wed Nov 18 → Thu Nov 26). Two weeks is headroom.
export const MAX_CIRCULAR_LENGTH_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

// The weekIds under which a circular covering `today` (store-local "YYYY-MM-DD") could
// be stored, newest first. Circulars are keyed by getWeekIdForDate(startDate), and one
// that covers today must have started within the last `lookbackDays` days, so the
// candidates are the distinct weekIds of those possible start dates.
//
// Deliberately does NOT assume "today's weekId == the live circular's weekId". That
// shortcut breaks for holiday ads that run past Tuesday (today's partition may hold a
// pre-scraped ad that hasn't started yet) and at year boundaries, where
// getWeekIdForDate changes year mid-window (Wed 2026-12-30 → 2026-W53, but
// Mon 2027-01-04 → 2027-W01).
export function candidateWeekIds(today: string, lookbackDays = MAX_CIRCULAR_LENGTH_DAYS): string[] {
  const base = new Date(today + 'T12:00:00Z').getTime();
  const ids = new Set<string>();
  for (let k = 0; k < lookbackDays; k++) {
    const day = new Date(base - k * DAY_MS).toISOString().slice(0, 10);
    // Same local-noon parse the scrapers use when they compute a circular's weekId.
    ids.add(getWeekIdForDate(new Date(day + 'T12:00:00')));
  }
  return [...ids];
}

// Helper to get ISO date string
export function getISODate(): string {
  return new Date().toISOString().split('T')[0];
}
