/**
 * Deal model for the client-side application.
 * Simplified version of the API's DealItem, without DynamoDB-specific fields.
 */
export interface Deal {
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
}

/**
 * Store type identifiers.
 */
export type StoreType = 'kingsoopers' | 'safeway' | 'sprouts';

/**
 * Store metadata for display purposes.
 */
export interface StoreMetadata {
  name: string;
  chain: string;
}

/**
 * Map of store types to their display metadata.
 */
export const STORE_TYPE_METADATA: Record<StoreType, StoreMetadata> = {
  kingsoopers: { name: 'King Soopers', chain: 'kroger' },
  safeway: { name: 'Safeway', chain: 'albertsons' },
  sprouts: { name: 'Sprouts', chain: 'sprouts' },
};

/**
 * Helper to get store type from instance ID.
 */
export function getStoreTypeFromInstanceId(instanceId: string): StoreType {
  const [type] = instanceId.split(':');
  return type as StoreType;
}

/**
 * Helper to get display name for a store instance ID.
 */
export function getStoreDisplayName(instanceId: string): string {
  const storeType = getStoreTypeFromInstanceId(instanceId);
  return STORE_TYPE_METADATA[storeType]?.name ?? instanceId;
}
