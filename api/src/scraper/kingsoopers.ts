import { writeDeals, writeCircular } from '../db/client';
import { getCurrentWeekId, KingSoopersIdentifiers, PriceVariant } from '../types/database';
import { findCanonicalProductId } from './products';

export type { PriceVariant } from '../types/database';

interface KingSoopersAd {
  id?: string;
  mainlineCopy?: string;
  underlineCopy?: string;
  description?: string;
  departments?: { department: string }[];
  pricingTemplate?: string;
  salePrice?: number;
  retailPrice?: string;
  percentOff?: number;
  quantity?: number;
  buyQuantity?: number;
  getQuantity?: number;
  disclaimer?: string;
  loyaltyIndicator?: string;
  images?: { url: string }[];
}

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
  priceVariants?: PriceVariant[];
}

interface LafObject {
  modality: { type: string };
  sources: { storeId: string; facilityId: string }[];
  listingKeys: string[];
}

const DEALS_URL = "https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals";
const DEAL_DETAIL_URL = "https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals";
const PRODUCT_URL = "https://api.kroger.com/v1/products";
const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";

const DEFAULT_MODALITY_TYPE = "IN_STORE";

function buildLafObject(
  storeId: string,
  facilityId: string,
  modalityType: string = DEFAULT_MODALITY_TYPE
): LafObject[] {
  return [
    {
      modality: { type: modalityType },
      sources: [{ storeId, facilityId }],
      listingKeys: [storeId],
    },
  ];
}

function buildKrogerHeaders(storeId: string, facilityId: string): Record<string, string> {
  const lafObject = buildLafObject(storeId, facilityId);
  return {
    Accept: "application/json",
    "x-kroger-channel": "WEB",
    "x-facility-id": storeId,
    "x-modality-type": DEFAULT_MODALITY_TYPE,
    "x-modality": JSON.stringify({ type: DEFAULT_MODALITY_TYPE, locationId: storeId }),
    "x-laf-object": JSON.stringify(lafObject),
  };
}

interface Circular {
  id: string;
  circularType: string;
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
  divisionName: string;
  week: string;
}

export interface WeeklyAdMetadata {
  circularId: string;
  startDate: string;
  endDate: string;
}

export function extractWeeklyAdMetadata(circulars: Circular[]): WeeklyAdMetadata | null {
  const weeklyAd = circulars.find((circ) => circ.circularType === 'weeklyAd');
  if (!weeklyAd) {
    return null;
  }
  return {
    circularId: weeklyAd.id,
    startDate: weeklyAd.eventStartDate,
    endDate: weeklyAd.eventEndDate,
  };
}

export async function fetchCirculars(
  identifiers: KingSoopersIdentifiers
): Promise<{ weeklyAdCircularId: string | null; circulars: Circular[] }> {
  const { storeId, facilityId } = identifiers;
  const headers = buildKrogerHeaders(storeId, facilityId);

  const response = await fetch(
    'https://api.kroger.com/digitalads/v1/circulars?filter.tags=SHOPPABLE&filter.tags=CLASSIC_VIEW',
    { headers }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Kroger API error: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  const circulars: Circular[] = json.data || [];
  const weeklyAd = circulars.find((circ) => circ.circularType === 'weeklyAd');

  return {
    weeklyAdCircularId: weeklyAd?.id || null,
    circulars,
  };
}

export function standardizeKingSoopersAd(ad: KingSoopersAd): StandardDeal {
  const name = ad.mainlineCopy;
  const details = ad.underlineCopy || ad.description;
  const dept = (ad.departments || []).map((d) => d.department).join(", ");
  const pricingTemplate = ad.pricingTemplate;

  let priceDisplay: string | null = null;
  let priceNumber: number | null = null;
  const percentOff = ad.percentOff;
  let quantity = ad.quantity || 1;

  // Priority: salePrice > retailPrice > disclaimer extraction
  let effectiveRetailPrice: string | undefined =
    ad.salePrice != null ? ad.salePrice.toString() : ad.retailPrice;

  // Try to extract price from disclaimer only if no salePrice and no retailPrice
  // Format: "Regular retail is up to $7.49 each with Card."
  if (!effectiveRetailPrice && ad.disclaimer) {
    const match = ad.disclaimer.match(/\$(\d+\.?\d*)/);
    if (match) {
      effectiveRetailPrice = match[1];
    }
  }

  if (pricingTemplate?.includes("2FOR") && effectiveRetailPrice) {
    const qty = ad.quantity || 2;
    priceDisplay = `${qty} for $${effectiveRetailPrice}`;
    priceNumber = parseFloat(effectiveRetailPrice) / qty;
    quantity = qty;
  } else if (pricingTemplate === "_KRGR_BOGO") {
    const buyQty = ad.buyQuantity || 1;
    const getQty = ad.getQuantity || 1;
    const totalQty = buyQty + getQty;

    if (effectiveRetailPrice) {
      priceDisplay = `Buy ${buyQty} Get ${getQty} Free ($${effectiveRetailPrice} each)`;
      priceNumber = (parseFloat(effectiveRetailPrice) * buyQty) / totalQty;
      quantity = totalQty;
    } else {
      priceDisplay = `Buy ${buyQty} Get ${getQty} Free`;
      quantity = totalQty;
    }
  } else if (pricingTemplate === "_KRGR_BOGO %" && percentOff) {
    const buyQty = ad.buyQuantity || 1;
    const getQty = ad.getQuantity || 1;
    const totalQty = buyQty + getQty;

    if (effectiveRetailPrice) {
      priceDisplay = `Buy ${buyQty} Get ${getQty} ${percentOff}% Off ($${effectiveRetailPrice} each)`;
      const effectiveTotal =
        parseFloat(effectiveRetailPrice) * (buyQty + getQty * (1 - percentOff / 100));
      priceNumber = effectiveTotal / totalQty;
      quantity = totalQty;
    } else {
      priceDisplay = `Buy ${buyQty} Get ${getQty} ${percentOff}% Off`;
      quantity = totalQty;
    }
  } else if (effectiveRetailPrice && quantity > 1) {
    priceDisplay = `${quantity} for $${effectiveRetailPrice}`;
    priceNumber = parseFloat(effectiveRetailPrice) / quantity;
  } else if (effectiveRetailPrice) {
    priceDisplay = `$${effectiveRetailPrice}`;
    priceNumber = parseFloat(effectiveRetailPrice);
    quantity = 1;
  }

  const loyalty = ad.loyaltyIndicator;
  const images = ad.images || [];
  const image = images.length > 0 ? images[0].url : undefined;

  return {
    store: "King Soopers",
    name,
    details,
    dept,
    priceDisplay: priceDisplay || "See store for details",
    priceNumber,
    quantity,
    loyalty,
    image,
  };
}

interface ShoppableWeeklyDealDetailsResponse {
  data?: {
    shoppableWeeklyDealDetails?: {
      mainlineCopy?: string;
      underlineCopy?: string;
      upcs?: { upc: string }[];
    };
  };
}

async function fetchDealDetails(
  dealId: string,
  circularId: string,
  headers: Record<string, string>
): Promise<ShoppableWeeklyDealDetailsResponse> {
  const url = new URL(`${DEAL_DETAIL_URL}/${dealId}`);
  url.searchParams.set("filter.circularId", circularId);

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) throw new Error(`Unable to fetch deal details: ${response.status} - ${response.statusText}`);
  return (await response.json()) as ShoppableWeeklyDealDetailsResponse;
}

interface ProductPriceResponse {
  data?: {
    upc?: string;
    description?: string;
    items?: {
      price?: {
        regular?: number;
        promo?: number;
      };
      soldBy?: string;
    }[];
    itemInformation?: {
      averageWeightPerUnit?: string;
    };
  }[];
  meta?: {
    pagination?: {
      start: number;
      limit: number;
      total: number;
    }
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** @internal Reset cached OAuth token (for testing) */
export function _resetTokenCache() {
  cachedToken = null;
}

async function getKrogerToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch(KROGER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: `grant_type=client_credentials&scope=${process.env.KROGER_SCOPES || "product.compact"}`,
  });

  if (!response.ok) return null;

  const json = await response.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000, // refresh 60s early
  };
  return cachedToken.token;
}

/** @internal Exported for testing */
export async function _getKrogerPriceVariants(
  queryParams: Record<string, string>,
): Promise<Record<string, PriceVariant>> {
  const url = new URL(PRODUCT_URL);
  for (const p of Object.keys(queryParams)) {
    url.searchParams.set(p, queryParams[p]);
  }
  if (url.searchParams.get('filter.limit') == null) {
    url.searchParams.set('filter.limit', '50');
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${await getKrogerToken()}`,
    },
  });
  if (!response.ok) {
    console.error(`[Kroger API] Error response: ${response.status} - ${response.statusText} - ${url.toString()}`);
    return {};
  };

  const json: ProductPriceResponse = await response.json();
  const pricesByUpc: Record<string, PriceVariant> = {};

  for (const product of json.data || []) {
    if (!product.upc) continue;

    const name = product.description || 'Unknown';
    const avgWeightStr = product.itemInformation?.averageWeightPerUnit;
    const avgWeight = avgWeightStr ? parseFloat(avgWeightStr) : undefined;

    for (const item of product.items || []) {
      if (item.price?.regular == null) continue;

      const perLb = item.price.regular;
      const isByWeight = item.soldBy === 'WEIGHT' && avgWeight;
      const effectivePrice = isByWeight
        ? Math.round(perLb * avgWeight! * 100) / 100
        : perLb;

      const variant: PriceVariant = { price: effectivePrice, example: name };
      if (isByWeight) {
        variant.perLb = perLb;
        variant.avgWeight = avgWeight;
      }
      pricesByUpc[product.upc] = variant;
    }
  }

  // use json.meta?.pagination?.start + json.meta?.pagination?.limit to get next page if applicable
  const start = json.meta?.pagination?.start || 0;
  const limit = json.meta?.pagination?.limit || 50;
  if (json.meta?.pagination?.total === undefined) {
    console.warn(`[Kroger API] Pagination has no total: ${url.toString()}`)
  }
  const total = json.meta?.pagination?.total || 0;

  // recursion                                                                                                                                                                                                       
  if ((start + limit) < total) {
    const result = await _getKrogerPriceVariants({
      ...queryParams,
      'filter.start': (start + limit).toString(),
    });
    Object.assign(pricesByUpc, result);
  }

  return pricesByUpc;
}

/** @internal Exported for testing */
export async function _fetchProductPrices(
  upcs: string[],
  locationId: string
): Promise<Record<string, PriceVariant>> {
  if (upcs.length === 0) return {};

  const pricesByUpc: Record<string, PriceVariant> = {};

  // Batch UPC lookups in groups of 10
  const PRODUCT_BATCH_SIZE = 10;
  for (let i = 0; i < upcs.length; i += PRODUCT_BATCH_SIZE) {
    const batch = upcs.slice(i, i + PRODUCT_BATCH_SIZE);

    const queryParams = {
      'filter.productId': batch.join(','),
      'filter.locationId': locationId
    }
    const ret = await _getKrogerPriceVariants(queryParams);
    Object.assign(pricesByUpc, ret);
  }

  return pricesByUpc;
}

/** @internal Exported for testing */
export async function _fetchProductPricesByTerm(
  dealDetails: ShoppableWeeklyDealDetailsResponse,
  locationId: string
): Promise<Record<string, PriceVariant>> {
  const details = dealDetails.data?.shoppableWeeklyDealDetails;
  const upcs = (details?.upcs || []).map(u => u.upc);
  const upcSet = new Set(upcs);

  const mainline = details?.mainlineCopy ?? '';
  const underline = details?.underlineCopy ?? '';
  const combinedTerm = [mainline, underline].filter(Boolean).join(', ');

  const searchTerms = underline.includes(' or ')
    ? combinedTerm.split(' or ').map(s => s.split(',')[0].trim()).filter(Boolean)
    : [mainline].filter(Boolean);

  const baseParams = {
    'filter.locationId': locationId,
    'filter.fulfillment': 'ais',
  };

  const pricesByUpc: Record<string, PriceVariant> = {};
  for (const term of searchTerms) {
    const ret = await _getKrogerPriceVariants({ ...baseParams, 'filter.term': term });
    Object.assign(pricesByUpc, ret);
  }

  return Object.fromEntries(
    Object.entries(pricesByUpc).filter(([upc]) => upcSet.has(upc))
  );
}

async function resolveBogoPrices(
  ads: KingSoopersAd[],
  deals: StandardDeal[],
  circularId: string,
  headers: Record<string, string>
): Promise<void> {
  const bogoIndices: number[] = [];
  for (let i = 0; i < ads.length; i++) {
    const isBogo = ads[i].pricingTemplate === "_KRGR_BOGO"
      || ads[i].pricingTemplate === "_KRGR_BOGO %";
    if (isBogo && deals[i].priceNumber === null && ads[i].id) {
      bogoIndices.push(i);
    }
  }
  if (bogoIndices.length === 0) return;

  const BATCH_SIZE = 5;
  for (let i = 0; i < bogoIndices.length; i += BATCH_SIZE) {
    const batch = bogoIndices.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (idx) => {
      const ad = ads[idx];
      const name = ad.mainlineCopy || 'unknown';
      if (!ad.id) {
        console.warn(`[BOGO] Deal "${name}" has no id, skipping price resolution`);
        return;
      }
      try {
        const dealDetails = await fetchDealDetails(ad.id, circularId, headers);
        const upcs = dealDetails.data?.shoppableWeeklyDealDetails?.upcs?.map(u => u.upc) ?? [];

        if (upcs.length === 0) {
          console.warn(`[BOGO] Deal "${name}" (${ad.id}): no UPCs returned from detail endpoint`);
          return;
        }
        let pricesByUpc = await _fetchProductPrices(upcs, headers["x-facility-id"]);

        if (Object.keys(pricesByUpc).length !== upcs.length) {
          const morePricesByUpc = await _fetchProductPricesByTerm(dealDetails, headers["x-facility-id"]);
          pricesByUpc = { ...pricesByUpc, ...morePricesByUpc };
        }

        // Dedupe by price
        const seen = new Set<number>();
        const variants = Object.values(pricesByUpc).filter(v => {
          if (seen.has(v.price)) return false;
          seen.add(v.price);
          return true;
        }).sort((a, b) => a.price - b.price);

        console.log(`[BOGO] Deal "${name}" (${ad.id}): resolved ${variants.length} price variants`);

        if (variants.length === 0) {
          console.warn(`[BOGO] Deal "${name}" (${ad.id}): no prices found`);
          return;
        }
        variants.sort((a, b) => a.price - b.price);
        const minPrice = variants[0].price; // sorted ascending
        const deal = standardizeKingSoopersAd({ ...ad, retailPrice: minPrice.toString() });
        if (variants.length > 1) {
          const maxPrice = variants[variants.length - 1].price;
          deal.priceDisplay = deal.priceDisplay.replace(
            `$${minPrice}`,
            `$${minPrice} - $${maxPrice}`
          );
        }
        deal.priceVariants = variants;
        deals[idx] = deal;
      } catch (err) {
        console.warn(`[BOGO] Deal "${name}" (${ad.id}): price resolution failed`, err);
      }
    }));
  }
}

interface KingSoopersApiResponse {
  data?: {
    shoppableWeeklyDeals?: {
      ads?: KingSoopersAd[];
    };
  };
}

export async function fetchWeeklyDeals(
  circularId: string,
  identifiers: KingSoopersIdentifiers
): Promise<StandardDeal[]> {
  const { storeId, facilityId } = identifiers;
  const headers = buildKrogerHeaders(storeId, facilityId);

  const url = new URL(DEALS_URL);
  url.searchParams.set("filter.circularId", circularId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch deals: ${response.status} - ${errorBody}`);
  }

  const json: KingSoopersApiResponse = await response.json();
  const ads = json.data?.shoppableWeeklyDeals?.ads || [];
  const deals = ads.map(standardizeKingSoopersAd);

  // Resolve prices for BOGO deals missing price data
  await resolveBogoPrices(ads, deals, circularId, headers);

  return deals;
}

export async function fetchAndPersistWeeklyDeals(
  circularId: string,
  identifiers: KingSoopersIdentifiers,
  storeInstanceId: string,
  weekId: string = getCurrentWeekId(),
  circularDates?: { startDate: string; endDate: string }
): Promise<{ deals: StandardDeal[]; persisted: boolean }> {
  const deals = await fetchWeeklyDeals(circularId, identifiers);

  if (deals.length === 0) {
    return { deals, persisted: false };
  }

  // Write deals to DynamoDB with canonical product matching
  await writeDeals(storeInstanceId, weekId, deals, (deal) =>
    findCanonicalProductId(deal.name, deal.details)
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
    circularId,
    startDate,
    endDate,
    deals.length
  );

  return { deals, persisted: true };
}
