import { writeDeals, writeCircular, getCircular, deleteCircularAndDeals } from '../db/client';
import { KingSoopersIdentifiers, PriceVariant, getWeekIdForDate } from '../types/database';
import { findCanonicalProductId } from './products';
import { getKrogerCreds, getScraperWorkerConfig } from '../config';
import { logger } from '../logger';

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
  upcs?: string[];
  priceVariants?: PriceVariant[];
}

const PRODUCT_URL = "https://api.kroger.com/v1/products";
const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";

const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.error({ url }, 'fetch timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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
    logger.debug('Using cached Kroger OAuth token');
    return cachedToken.token;
  }

  const { clientId, clientSecret } = await getKrogerCreds();

  const response = await fetchWithTimeout(KROGER_TOKEN_URL, {
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
  logger.info({ expiresIn: json.expires_in }, 'Fetched fresh Kroger OAuth token');
  return cachedToken.token;
}

/** @internal Exported for testing */
export async function _getKrogerPriceVariants(
  queryParams: Record<string, string>,
): Promise<Record<string, PriceVariant>> {
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    searchParams.set(k, v);
  }
  if (searchParams.get('filter.limit') == null) {
    searchParams.set('filter.limit', '50');
  }
  // URLSearchParams encodes spaces as '+', but Kroger's API expects '%20'
  const url = `${PRODUCT_URL}?${searchParams.toString().replace(/\+/g, '%20')}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${await getKrogerToken()}`,
    },
  });
  if (!response.ok) {
    logger.error({ status: response.status, url }, 'Kroger API error response');
    return {};
  }

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
    logger.warn({ url }, 'Kroger API pagination missing total');
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

  // Batch UPC lookups in groups of 10, all batches in parallel
  const PRODUCT_BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < upcs.length; i += PRODUCT_BATCH_SIZE) {
    batches.push(upcs.slice(i, i + PRODUCT_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map(batch =>
    _getKrogerPriceVariants({ 'filter.productId': batch.join(','), 'filter.locationId': locationId })
  ));
  results.forEach(ret => Object.assign(pricesByUpc, ret));

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
  const termResults = await Promise.all(searchTerms.map(term =>
    _getKrogerPriceVariants({ ...baseParams, 'filter.term': term })
      .then(ret => { logger.debug({ term, count: Object.keys(ret).length }, 'term search result'); return ret; })
  ));
  termResults.forEach(ret => Object.assign(pricesByUpc, ret));

  return Object.fromEntries(
    Object.entries(pricesByUpc).filter(([upc]) => upcSet.has(upc))
  );
}

interface ScraperWorkerBogoItem {
  dealIndex: number;
  ad: KingSoopersAd;
  upcs: string[];
  dealDetails: ShoppableWeeklyDealDetailsResponse;
}

interface ScraperWorkerResponse {
  deals: StandardDeal[];
  bogoData: ScraperWorkerBogoItem[];
  circularId: string;
  circularDates: { startDate: string; endDate: string };
}

async function callScraperWorker(
  identifiers: KingSoopersIdentifiers
): Promise<ScraperWorkerResponse> {
  const { url, apiKey } = await getScraperWorkerConfig();
  const response = await fetchWithTimeout(`${url}/scrape/kingsoopers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      storeId: identifiers.storeId,
      facilityId: identifiers.facilityId,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Scraper worker error: ${response.status} - ${errorBody}`);
  }
  return response.json() as Promise<ScraperWorkerResponse>;
}

/** @internal Exported for testing */
export async function _resolveBogoFromWorkerData(
  deals: StandardDeal[],
  bogoData: ScraperWorkerBogoItem[],
  locationId: string
): Promise<void> {
  if (bogoData.length === 0) return;

  await getKrogerToken(); // warm cache before parallel requests

  logger.info({ bogoCount: bogoData.length }, 'Starting BOGO price resolution');
  const t = Date.now();

  await Promise.all(bogoData.map(async ({ dealIndex, ad, upcs, dealDetails }) => {
    const name = ad.mainlineCopy || 'unknown';
    try {
      if (upcs.length === 0) {
        logger.warn({ name, dealId: ad.id }, 'BOGO deal data has no UPCs');
        return;
      }

      let pricesByUpc = await _fetchProductPrices(upcs, locationId);

      if (Object.keys(pricesByUpc).length !== upcs.length) {
        const morePricesByUpc = await _fetchProductPricesByTerm(dealDetails, locationId);
        pricesByUpc = { ...pricesByUpc, ...morePricesByUpc };
      }

      // Dedupe by price
      const seen = new Set<number>();
      const variants = Object.values(pricesByUpc).filter(v => {
        if (seen.has(v.price)) return false;
        seen.add(v.price);
        return true;
      }).sort((a, b) => a.price - b.price);

      logger.info({ name, dealId: ad.id, variantCount: variants.length }, 'BOGO price variants resolved');

      if (variants.length === 0) {
        logger.warn({ name, dealId: ad.id }, 'BOGO no prices found');
        return;
      }

      const minPrice = variants[0].price;
      const deal = standardizeKingSoopersAd({ ...ad, retailPrice: minPrice.toString() });
      if (variants.length > 1) {
        const maxPrice = variants[variants.length - 1].price;
        deal.priceDisplay = deal.priceDisplay.replace(
          `$${minPrice}`,
          `$${minPrice} - $${maxPrice}`
        );
      }
      deal.priceVariants = variants;
      deal.upcs = upcs;
      deals[dealIndex] = deal;
    } catch (err) {
      logger.warn({ err, name, dealId: ad.id }, 'BOGO price resolution failed');
    }
  }));

  logger.info({ duration_ms: Date.now() - t }, 'BOGO Promise.all settled');
}

export async function fetchWeeklyDeals(
  identifiers: KingSoopersIdentifiers
): Promise<{ deals: StandardDeal[]; circularId: string; circularDates: { startDate: string; endDate: string } }> {
  const { deals, bogoData, circularId, circularDates } = await callScraperWorker(identifiers);
  await _resolveBogoFromWorkerData(deals, bogoData, identifiers.storeId);
  return { deals, circularId, circularDates };
}

export async function fetchAndPersistWeeklyDeals(
  identifiers: KingSoopersIdentifiers,
  storeInstanceId: string,
  options: { force?: boolean } = {}
): Promise<{
  deals: StandardDeal[];
  persisted: boolean;
  alreadyScraped: boolean;
  circularId: string;
  circularDates: { startDate: string; endDate: string };
  weekId: string;
  existingDealCount?: number;
  deletedCount?: number;
}> {
  const t = Date.now();
  const { deals, circularId, circularDates } = await fetchWeeklyDeals(identifiers);
  logger.info({ duration_ms: Date.now() - t, dealCount: deals.length, storeInstanceId }, 'fetchWeeklyDeals complete');

  const localDate = new Date(circularDates.startDate.split('T')[0] + 'T12:00:00');
  const weekId = getWeekIdForDate(localDate);

  // Deduplication check
  const existingCircular = await getCircular(storeInstanceId, weekId);
  if (!options.force && existingCircular && existingCircular.circularId === circularId) {
    return {
      deals: [],
      persisted: false,
      alreadyScraped: true,
      circularId,
      circularDates,
      weekId,
      existingDealCount: existingCircular.dealCount,
    };
  }

  // Force delete if requested
  let deletedCount: number | undefined;
  if (options.force && existingCircular) {
    const deleteResult = await deleteCircularAndDeals(storeInstanceId, weekId);
    deletedCount = deleteResult.deletedCount;
  }

  if (deals.length === 0) {
    return { deals, persisted: false, alreadyScraped: false, circularId, circularDates, weekId, deletedCount };
  }

  await writeDeals(storeInstanceId, weekId, deals, (deal) =>
    findCanonicalProductId(deal.name, deal.details, deal.dept)
  );

  await writeCircular(
    storeInstanceId,
    weekId,
    circularId,
    circularDates.startDate,
    circularDates.endDate,
    deals.length
  );

  return { deals, persisted: true, alreadyScraped: false, circularId, circularDates, weekId, deletedCount };
}
