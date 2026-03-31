import { writeDeals, writeCircular } from '../db/client';
import { getCurrentWeekId, SafewayIdentifiers } from '../types/database';
import { findCanonicalProductId } from './products';
import { StandardDeal } from './kingsoopers';

export interface WeeklyAdMetadata {
  circularId: string;
  startDate: string;
  endDate: string;
}

// Flipp API types
interface FlippPublication {
  id: number;
  external_display_name: string;
  valid_from: string;
  valid_to: string;
  storefront_id: number;
}

interface FlippProduct {
  id: number;
  name: string;
  item_type?: number;
  description?: string;
  categories?: string[];
  pre_price_text?: string;
  price_text?: string;
  post_price_text?: string;
  disclaimer_text?: string;
  image_url?: string;
  sale_story?: string;
  brand?: string;
  // Flipp's ML-generated category hierarchy (up to 7 levels). More precise than `categories`
  // (e.g. l4 = "Ice Cream & Frozen Yogurt" while `categories` = ["Dairy, Eggs & Cheese"]).
  // Could be used as a higher-fidelity input to normalizeDept in place of or alongside `categories`.
  item_categories?: {
    l1?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l2?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l3?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l4?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l5?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l6?: { category_name: string; google_category_id: number; confidence: number | null } | null;
    l7?: { category_name: string; google_category_id: number; confidence: number | null } | null;
  };
}

// Default Flipp access token (public token from web)
const DEFAULT_FLIPP_TOKEN = '7749fa974b9869e8f57606ac9477decf';

function getFlippAccessToken(): string {
  return process.env.FLIPP_ACCESS_TOKEN || DEFAULT_FLIPP_TOKEN;
}

/**
 * Fetch available publications (circulars/flyers) from Flipp API
 */
export async function fetchPublications(
  identifiers: SafewayIdentifiers
): Promise<{ weeklyAdPublicationId: number | null; publications: FlippPublication[] }> {
  const { storeId, postalCode } = identifiers;
  const accessToken = getFlippAccessToken();

  const url = new URL('https://api.flipp.com/flyerkit/v4.0/publications/safeway');
  url.searchParams.set('postal_code', postalCode);
  url.searchParams.set('store_code', storeId);
  url.searchParams.set('locale', 'en-US');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Flipp API error: ${response.status} - ${errorBody}`);
  }

  const json: FlippPublication[] = await response.json();

  // Find the "Weekly Ad" publication
  const weeklyAd = json.find(
    (pub) => pub.external_display_name === 'Weekly Ad'
  );

  return {
    weeklyAdPublicationId: weeklyAd?.id || null,
    publications: json,
  };
}

/**
 * Extract weekly ad metadata from publications list
 */
export function extractWeeklyAdMetadata(
  publications: FlippPublication[]
): WeeklyAdMetadata | null {
  const weeklyAd = publications.find(
    (pub) => pub.external_display_name === 'Weekly Ad'
  );

  if (!weeklyAd) {
    return null;
  }

  return {
    circularId: weeklyAd.id.toString(),
    startDate: weeklyAd.valid_from.split('T')[0],
    endDate: weeklyAd.valid_to.split('T')[0],
  };
}

/**
 * Fetch products for a specific publication from Flipp API
 */
export async function fetchProducts(
  publicationId: string | number
): Promise<FlippProduct[]> {
  const accessToken = getFlippAccessToken();

  const url = new URL(
    `https://dam.flippenterprise.net/flyerkit/publication/${publicationId}/products`
  );
  url.searchParams.set('display_type', 'all');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Flipp API error: ${response.status} - ${errorBody}`);
  }

  const json: FlippProduct[] = await response.json();
  return json || [];
}

/**
 * Parse bulk pricing from pre_price_text (e.g., "3 for")
 * Returns quantity if bulk pricing detected, otherwise 1
 */
function parseBulkQuantity(prePriceText?: string): number {
  if (!prePriceText) return 1;

  // Match patterns like "3 for", "2 for", "4/"
  const match = prePriceText.match(/(\d+)\s*(?:for|\/)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  return 1;
}

/**
 * Extract discount patterns from sale_story, stripping "Member Price"
 */
function parseSaleStoryDiscount(saleStory?: string): string | null {
  if (!saleStory) return null;

  const cleaned = saleStory.replace(/\bmember\s*price\b/gi, '').trim();
  if (!cleaned) return null;

  // Match: "20% off", "$3 off", "$3.00 off"
  const discountMatch = cleaned.match(/\$?\d+(?:\.\d+)?%?\s*off/i);
  if (discountMatch) return discountMatch[0];

  // Match: "BUY 2 | GET 1 FREE" (with optional *, pipes, etc.)
  const bogoMatch = cleaned.match(/buy\s+\d+\s*\|?\s*get\s+\d+\s*free\*?/i);
  if (bogoMatch) return bogoMatch[0].replace(/[|*]/g, '').replace(/\s+/g, ' ').trim();

  // Match: "SAVE $3.50", "BUY 2 SAVE $3.50"
  const saveMatch = cleaned.match(/(?:buy\s+\d+\s*\*?\s*)?save\s+\$\d+(?:\.\d+)?/i);
  if (saveMatch) return saveMatch[0].replace(/\*/g, '').replace(/\s+/g, ' ').trim();

  return null;
}

/**
 * Detect loyalty requirement from post_price_text
 * Safeway uses "member" and "card" keywords
 */
function detectLoyalty(postPriceText?: string, disclaimerText?: string, saleStory?: string): string | undefined {
  const text = `${postPriceText || ''} ${disclaimerText || ''} ${saleStory || ''}`.toLowerCase();

  if (text.includes('member') || text.includes('card') || text.includes('club')) {
    return 'CARD_REQUIRED';
  }

  return undefined;
}

/**
 * Parse price from price_text (e.g., "$2.99", "2.99", "$5")
 */
function parsePrice(priceText?: string): number | null {
  if (!priceText) return null;

  // Remove currency symbols and extract number
  const match = priceText.match(/\$?\s*(\d+\.?\d*)/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Build display price from Flipp price components
 */
function buildPriceDisplay(
  prePriceText?: string,
  priceText?: string,
  postPriceText?: string
): string {
  const parts: string[] = [];

  if (prePriceText?.trim()) {
    parts.push(prePriceText.trim());
  }

  if (priceText?.trim()) {
    // Ensure price has $ if it's just a number
    let price = priceText.trim();
    if (/^\d/.test(price)) {
      price = `$${price}`;
    }
    parts.push(price);
  }

  if (postPriceText?.trim()) {
    const cleaned = postPriceText.trim().replace(/\bmember\s*price\b/gi, '').trim();
    if (cleaned) {
      parts.push(cleaned);
    }
  }

  return parts.length > 0 ? parts.join(' ') : 'See store for details';
}

/**
 * Standardize a Flipp product to StandardDeal format
 */
export function standardizeSafewayProduct(product: FlippProduct): StandardDeal {
  const name = product.name;
  const details = product.description || product.sale_story;
  const dept = (product.categories || []).join(', ') || 'Uncategorized';

  // Parse pricing
  const prePriceText = product.pre_price_text;
  const priceText = product.price_text;
  const postPriceText = product.post_price_text;

  const quantity = parseBulkQuantity(prePriceText);
  const totalPrice = parsePrice(priceText);

  // Calculate per-unit price for bulk items
  let priceNumber: number | null = null;
  if (totalPrice !== null) {
    priceNumber = quantity > 1 ? totalPrice / quantity : totalPrice;
  }

  let priceDisplay = buildPriceDisplay(prePriceText, priceText, postPriceText);
  if (priceDisplay === 'See store for details') {
    const saleDiscount = parseSaleStoryDiscount(product.sale_story);
    if (saleDiscount) {
      priceDisplay = saleDiscount;
    }
  }
  const loyalty = detectLoyalty(postPriceText, product.disclaimer_text, product.sale_story);

  return {
    store: 'Safeway',
    name,
    details,
    dept,
    priceDisplay,
    priceNumber,
    quantity,
    loyalty,
    image: product.image_url,
  };
}

/**
 * Fetch and standardize weekly deals
 */
export async function fetchWeeklyDeals(
  publicationId: string | number
): Promise<StandardDeal[]> {
  const products = await fetchProducts(publicationId);
  return products
    .filter((p) => p.item_type !== 5)
    .filter((p) => {
      const hasPrice = p.price_text?.trim();
      const hasDiscount = parseSaleStoryDiscount(p.sale_story);
      return hasPrice || hasDiscount;
    })
    .map(standardizeSafewayProduct);
}

/**
 * Fetch weekly deals and persist to DynamoDB
 */
export async function fetchAndPersistWeeklyDeals(
  publicationId: string | number,
  storeInstanceId: string,
  weekId: string = getCurrentWeekId(),
  circularDates?: { startDate: string; endDate: string }
): Promise<{ deals: StandardDeal[]; persisted: boolean }> {
  const deals = await fetchWeeklyDeals(publicationId);

  if (deals.length === 0) {
    return { deals, persisted: false };
  }

  // Write deals to DynamoDB with canonical product matching
  await writeDeals(storeInstanceId, weekId, deals, (deal) =>
    findCanonicalProductId(deal.name, deal.details, deal.dept)
  );

  // Write circular metadata - use provided dates or calculate from today
  let startDate: string;
  let endDate: string;

  if (circularDates) {
    startDate = circularDates.startDate;
    endDate = circularDates.endDate;
  } else {
    const today = new Date();
    startDate = today.toISOString().split('T')[0];
    // Assume weekly ads run for 7 days
    endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
  }

  await writeCircular(
    storeInstanceId,
    weekId,
    publicationId.toString(),
    startDate,
    endDate,
    deals.length
  );

  return { deals, persisted: true };
}
