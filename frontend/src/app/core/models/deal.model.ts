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

export interface DealsResponse {
  weekId: string;
  deals: Deal[];
  count: number;
}