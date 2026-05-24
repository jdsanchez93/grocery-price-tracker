export interface PriceVariant {
  price: number;
  example: string;
  perLb?: number;
  avgWeight?: number;
}

export interface DealRating {
  label: 'best' | 'good' | 'typical' | 'high';
  percentVsAvg: number;
  historicalAvg: number;
  historicalMin: number;
  sampleSize: number;
}

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
  canonicalProductId?: string;
  priceVariants?: PriceVariant[];
  rating?: DealRating;
}

/**
 * One store's currently-active circular, or a null marker explaining why none
 * was found. Returned by GET /me/deals in "current" mode.
 */
export type ActiveCircular =
  | { storeInstanceId: string; weekId: string; startDate: string; endDate: string; dealCount: number }
  | { storeInstanceId: string; circular: null; reason: 'not_yet_scraped' | 'store_not_found' };

export interface DealsResponse {
  mode: 'current' | 'historical';
  weekId?: string;          // present in historical mode
  circulars?: ActiveCircular[]; // present in current mode
  deals: Deal[];
  count: number;
}

export const LABEL_RANK: Record<DealRating['label'], number> = {
  best: 0,
  good: 1,
  typical: 2,
  high: 3,
};