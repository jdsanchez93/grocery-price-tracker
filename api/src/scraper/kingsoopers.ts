import { writeDeals, writeCircular } from '../db/client';
import { getCurrentWeekId } from '../types/database';
import { findCanonicalProductId } from './products';

interface KingSoopersAd {
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

interface LafObject {
  modality: { type: string };
  sources: { storeId: string; facilityId: string }[];
}

// export const DEFAULT_CIRCULAR_ID = "3dd6895e-b069-4ec9-af91-18799639bac9";
export const DEFAULT_CIRCULAR_ID = "4dd83448-40a7-4886-8810-c6eed434b2d2"
const DEALS_URL =
  "https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals";

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
    },
  ];
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
    ad.salePrice !== undefined ? ad.salePrice.toString() : ad.retailPrice;

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

interface KingSoopersApiResponse {
  data?: {
    shoppableWeeklyDeals?: {
      ads?: KingSoopersAd[];
    };
  };
}

export async function fetchWeeklyDeals(
  circularId: string,
  storeId: string,
  facilityId: string
): Promise<StandardDeal[]> {
  const lafObject = buildLafObject(storeId, facilityId);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-kroger-channel": "WEB",
    "x-facility-id": storeId,
    "x-modality-type": DEFAULT_MODALITY_TYPE,
    "x-modality": JSON.stringify({ type: DEFAULT_MODALITY_TYPE, locationId: storeId }),
    "x-laf-object": JSON.stringify(lafObject),
  };

  const url = new URL(DEALS_URL);
  url.searchParams.set("filter.circularId", circularId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deals: ${response.status}`);
  }

  const json: KingSoopersApiResponse = await response.json();
  const ads = json.data?.shoppableWeeklyDeals?.ads || [];

  return ads.map(standardizeKingSoopersAd);
}

/**
 * Fetch weekly deals and persist to DynamoDB
 * @param circularId - The circular/flyer ID
 * @param storeId - The King Soopers store ID (API parameter)
 * @param facilityId - The King Soopers facility ID (API parameter)
 * @param storeInstanceId - The store instance ID for DynamoDB (e.g., "kingsoopers:a1b2c3d4")
 * @param weekId - The week ID (ISO format)
 */
export async function fetchAndPersistWeeklyDeals(
  circularId: string,
  storeId: string,
  facilityId: string,
  storeInstanceId: string,
  weekId: string = getCurrentWeekId()
): Promise<{ deals: StandardDeal[]; persisted: boolean }> {
  const deals = await fetchWeeklyDeals(circularId, storeId, facilityId);

  if (deals.length === 0) {
    return { deals, persisted: false };
  }

  // Write deals to DynamoDB with canonical product matching
  await writeDeals(storeInstanceId, weekId, deals, (deal) =>
    findCanonicalProductId(deal.name, deal.details)
  );

  // Write circular metadata
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  // Assume weekly ads run for 7 days
  const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

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
