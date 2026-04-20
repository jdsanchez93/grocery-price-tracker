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
  abbr: string;
}

/**
 * Map of store types to their display metadata.
 */
export const STORE_TYPE_METADATA: Record<StoreType, StoreMetadata> = {
  kingsoopers: { name: 'King Soopers', chain: 'kroger',     abbr: 'KS' },
  safeway:     { name: 'Safeway',      chain: 'albertsons', abbr: 'SW' },
  sprouts:     { name: 'Sprouts',      chain: 'sprouts',    abbr: 'SP' },
};

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/**
 * Map of store types to <p-tag> color (severity)
 */
export const STORE_SEVERITY: Record<StoreType, TagSeverity> = {
  kingsoopers: 'info',
  safeway: 'danger',
  sprouts: 'success',
};

export interface FieldConfig {
  key: 'storeId' | 'facilityId' | 'postalCode';
  controlType: 'text' | 'select';
  label: string;
  placeholder: string;
  hint?: string;
}

export const STORE_FIELD_CONFIGS: Record<StoreType, FieldConfig[]> = {
  kingsoopers: [
    { key: 'storeId',    controlType: 'text', label: 'Store ID',    placeholder: 'e.g. 62000000', hint: 'Kroger API locationId' },
    { key: 'facilityId', controlType: 'text', label: 'Facility ID', placeholder: 'e.g. 12345', hint: 'facilityId' },
  ],
  safeway: [
    { key: 'storeId',    controlType: 'text', label: 'Store ID',    placeholder: 'e.g. 1234',  hint: 'Safeway store_code' },
    { key: 'postalCode', controlType: 'text', label: 'Postal Code', placeholder: 'e.g. 80000', hint: 'Safeway postal_code' },
  ],
  sprouts: [
    { key: 'storeId',    controlType: 'text', label: 'Store ID',    placeholder: 'e.g. 1234',  hint: 'Sprouts store number' },
  ],
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

/**
 * Helper to get short abbreviation for a store instance ID.
 */
export function getStoreAbbr(instanceId: string): string {
  const storeType = getStoreTypeFromInstanceId(instanceId);
  return STORE_TYPE_METADATA[storeType]?.abbr ?? instanceId;
}

/**
 * Helper to get severity (<p-tag> color) for a store instance ID.
 */
export function getStoreSeverity(instanceId: string): TagSeverity {
  const storeType = getStoreTypeFromInstanceId(instanceId);
  return STORE_SEVERITY[storeType] ?? 'secondary';
}

export interface StoreAddress {
  addressLine1: string;
  city: string;
  state: string;
  zipCode?: string;
}

/**
 * A store that the user has added to their account.
 */
export interface UserStore {
  instanceId: string;
  name: string;
  storeType: StoreType;
  chain: string;
  address?: StoreAddress;
  addedAt: string;
}

/**
 * A store available from the API.
 */
export interface AvailableStore {
  instanceId: string;
  name: string;
  storeType: StoreType;
  identifiers: Record<string, string>;
  enabled: boolean;
  address?: StoreAddress;
}

/**
 * API response for user's stores.
 */
export interface UserStoresResponse {
  stores: UserStore[];
}

/**
 * API response for available stores by type.
 */
export interface AvailableStoresResponse {
  stores: AvailableStore[];
}
