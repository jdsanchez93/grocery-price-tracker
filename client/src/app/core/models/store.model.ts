import { StoreType } from './deal.model';

/**
 * A store that the user has added to their account.
 */
export interface UserStore {
  instanceId: string;
  name: string;
  storeType: StoreType;
  chain: string;
  addedAt: string;
}

/**
 * A store available from the public endpoint.
 */
export interface AvailableStore {
  instanceId: string;
  name: string;
  storeType: StoreType;
  identifiers: Record<string, string>;
  enabled: boolean;
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
