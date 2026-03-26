const CIRCULARS_URL = "https://api.kroger.com/digitalads/v1/circulars?filter.tags=SHOPPABLE&filter.tags=CLASSIC_VIEW";
const DEALS_URL = "https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals";
const DEAL_DETAIL_URL = "https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals";

const DEFAULT_MODALITY_TYPE = "IN_STORE";
const FETCH_TIMEOUT_MS = 30_000;

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

export interface BogoItem {
  dealIndex: number;
  ad: KingSoopersAd;
  upcs: string[];
  dealDetails: ShoppableWeeklyDealDetailsResponse;
}

interface Circular {
  id: string;
  circularType: string;
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
}

export interface ScraperResponse {
  deals: StandardDeal[];
  bogoData: BogoItem[];
  circularId: string;
  circularDates: { startDate: string; endDate: string };
}

interface LafObject {
  modality: { type: string };
  sources: { storeId: string; facilityId: string }[];
  listingKeys: string[];
}

interface KingSoopersApiResponse {
  data?: {
    shoppableWeeklyDeals?: {
      ads?: KingSoopersAd[];
    };
  };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`fetch timed out: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

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
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.kingsoopers.com/weekly-ad",
    "x-kroger-channel": "WEB",
    "x-facility-id": storeId,
    "x-modality-type": DEFAULT_MODALITY_TYPE,
    "x-modality": JSON.stringify({ type: DEFAULT_MODALITY_TYPE, locationId: storeId }),
    "x-laf-object": JSON.stringify(lafObject),
  };
}

async function fetchCirculars(
  storeId: string,
  facilityId: string
): Promise<{ circularId: string; circularDates: { startDate: string; endDate: string } }> {
  const headers = buildKrogerHeaders(storeId, facilityId);
  const response = await fetchWithTimeout(CIRCULARS_URL, { headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Kroger circulars API error: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  const circulars: Circular[] = json.data || [];
  const weeklyAd = circulars.find((circ) => circ.circularType === 'weeklyAd');

  if (!weeklyAd) {
    throw new Error('No weekly ad circular found');
  }

  return {
    circularId: weeklyAd.id,
    circularDates: { startDate: weeklyAd.eventStartDate, endDate: weeklyAd.eventEndDate },
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

  let effectiveRetailPrice: string | undefined =
    ad.salePrice != null ? ad.salePrice.toString() : ad.retailPrice;

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

async function fetchDealDetails(
  dealId: string,
  circularId: string,
  headers: Record<string, string>
): Promise<ShoppableWeeklyDealDetailsResponse> {
  const url = new URL(`${DEAL_DETAIL_URL}/${dealId}`);
  url.searchParams.set("filter.circularId", circularId);

  const response = await fetchWithTimeout(url.toString(), { headers });
  if (!response.ok) throw new Error(`Unable to fetch deal details: ${response.status} - ${response.statusText}`);
  return (await response.json()) as ShoppableWeeklyDealDetailsResponse;
}

export async function scrapeKingSoopers(
  storeId: string,
  facilityId: string
): Promise<ScraperResponse> {
  const { circularId, circularDates } = await fetchCirculars(storeId, facilityId);
  const headers = buildKrogerHeaders(storeId, facilityId);

  const url = new URL(DEALS_URL);
  url.searchParams.set("filter.circularId", circularId);

  const response = await fetchWithTimeout(url.toString(), { headers });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch deals: ${response.status} - ${errorBody}`);
  }

  const json: KingSoopersApiResponse = await response.json();
  const ads = json.data?.shoppableWeeklyDeals?.ads || [];
  const deals = ads.map(standardizeKingSoopersAd);

  const bogoData: BogoItem[] = [];

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];
    const isBogo = ad.pricingTemplate === "_KRGR_BOGO" || ad.pricingTemplate === "_KRGR_BOGO %";
    if (!isBogo || deals[i].priceNumber !== null || !ad.id) continue;

    try {
      const dealDetails = await fetchDealDetails(ad.id, circularId, headers);
      const upcs = dealDetails.data?.shoppableWeeklyDealDetails?.upcs?.map(u => u.upc) ?? [];
      bogoData.push({ dealIndex: i, ad, upcs, dealDetails });
    } catch (err) {
      console.error(`Failed to fetch deal details for ${ad.id}:`, err);
      // Include with empty upcs so Lambda knows this deal needs resolution but has no UPCs
      bogoData.push({ dealIndex: i, ad, upcs: [], dealDetails: {} });
    }
  }

  return { deals, bogoData, circularId, circularDates };
}
