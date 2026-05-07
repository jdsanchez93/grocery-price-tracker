import { PriceVariant } from '../types/database';

// Common shape produced by all scrapers (kingsoopers, safeway, etc.)
// before being persisted as a DynamoDB DealItem.
export interface StandardDeal {
  store: string;
  name: string | undefined;
  details: string | undefined;
  dept: string;
  priceDisplay: string;
  priceNumber: number | null;
  quantity: number;
  loyalty: string | undefined;
  image: string | undefined;
  upcs?: string[];
  priceVariants?: PriceVariant[];
}
