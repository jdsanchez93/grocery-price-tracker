// Canonical Product Matching Logic
// Tiered approach:
// 1. Text normalization (lowercase, remove noise, collapse whitespace)
// 2. Canonical product mapping via regex patterns
// 3. Client-side fuzzy search for MVP (DynamoDB can't do text search)

interface CanonicalProduct {
  id: string;
  displayName: string;
  category: string;
  patterns: RegExp[];
}

// Canonical product definitions
// Each product has patterns that match various ways it might appear in ads
const CANONICAL_PRODUCTS: CanonicalProduct[] = [
  // Proteins
  {
    id: 'chicken-breast',
    displayName: 'Chicken Breast',
    category: 'meat',
    patterns: [
      /chicken\s+breast/i,
      /boneless\s+skinless\s+chicken/i,
      /chicken\s+tender/i,
    ],
  },
  {
    id: 'ground-beef',
    displayName: 'Ground Beef',
    category: 'meat',
    patterns: [
      /ground\s+beef/i,
      /hamburger/i,
      /lean\s+ground/i,
    ],
  },
  {
    id: 'bacon',
    displayName: 'Bacon',
    category: 'meat',
    patterns: [
      /\bbacon\b/i,
      /thick\s+cut\s+bacon/i,
    ],
  },
  {
    id: 'pork-chops',
    displayName: 'Pork Chops',
    category: 'meat',
    patterns: [
      /pork\s+chop/i,
      /bone-?in\s+pork/i,
    ],
  },
  {
    id: 'salmon',
    displayName: 'Salmon',
    category: 'seafood',
    patterns: [
      /\bsalmon\b/i,
      /atlantic\s+salmon/i,
      /sockeye/i,
    ],
  },

  // Dairy
  {
    id: 'milk',
    displayName: 'Milk',
    category: 'dairy',
    patterns: [
      /\bmilk\b/i,
      /whole\s+milk/i,
      /2%\s+milk/i,
      /skim\s+milk/i,
    ],
  },
  {
    id: 'eggs',
    displayName: 'Eggs',
    category: 'dairy',
    patterns: [
      /\beggs?\b/i,
      /large\s+eggs/i,
      /dozen\s+eggs/i,
    ],
  },
  {
    id: 'butter',
    displayName: 'Butter',
    category: 'dairy',
    patterns: [
      /\bbutter\b/i,
      /salted\s+butter/i,
      /unsalted\s+butter/i,
    ],
  },
  {
    id: 'cheese',
    displayName: 'Cheese',
    category: 'dairy',
    patterns: [
      /\bcheese\b/i,
      /cheddar/i,
      /mozzarella/i,
      /parmesan/i,
    ],
  },
  {
    id: 'yogurt',
    displayName: 'Yogurt',
    category: 'dairy',
    patterns: [
      /yogurt/i,
      /greek\s+yogurt/i,
    ],
  },

  // Produce
  {
    id: 'bananas',
    displayName: 'Bananas',
    category: 'produce',
    patterns: [
      /\bbanana/i,
    ],
  },
  {
    id: 'apples',
    displayName: 'Apples',
    category: 'produce',
    patterns: [
      /\bapple/i,
      /gala/i,
      /honeycrisp/i,
      /fuji/i,
      /granny\s+smith/i,
    ],
  },
  {
    id: 'avocados',
    displayName: 'Avocados',
    category: 'produce',
    patterns: [
      /avocado/i,
      /hass\s+avocado/i,
    ],
  },
  {
    id: 'strawberries',
    displayName: 'Strawberries',
    category: 'produce',
    patterns: [
      /strawberr/i,
    ],
  },
  {
    id: 'lettuce',
    displayName: 'Lettuce',
    category: 'produce',
    patterns: [
      /lettuce/i,
      /romaine/i,
      /iceberg/i,
    ],
  },
  {
    id: 'tomatoes',
    displayName: 'Tomatoes',
    category: 'produce',
    patterns: [
      /tomato/i,
      /cherry\s+tomato/i,
      /grape\s+tomato/i,
    ],
  },
  {
    id: 'potatoes',
    displayName: 'Potatoes',
    category: 'produce',
    patterns: [
      /potato/i,
      /russet/i,
      /yukon\s+gold/i,
    ],
  },
  {
    id: 'onions',
    displayName: 'Onions',
    category: 'produce',
    patterns: [
      /\bonion/i,
      /yellow\s+onion/i,
      /red\s+onion/i,
    ],
  },

  // Pantry
  {
    id: 'bread',
    displayName: 'Bread',
    category: 'bakery',
    patterns: [
      /\bbread\b/i,
      /wheat\s+bread/i,
      /white\s+bread/i,
      /sourdough/i,
    ],
  },
  {
    id: 'cereal',
    displayName: 'Cereal',
    category: 'pantry',
    patterns: [
      /cereal/i,
      /cheerios/i,
      /frosted\s+flakes/i,
      /corn\s+flakes/i,
    ],
  },
  {
    id: 'pasta',
    displayName: 'Pasta',
    category: 'pantry',
    patterns: [
      /pasta/i,
      /spaghetti/i,
      /penne/i,
      /macaroni/i,
    ],
  },
  {
    id: 'rice',
    displayName: 'Rice',
    category: 'pantry',
    patterns: [
      /\brice\b/i,
      /white\s+rice/i,
      /brown\s+rice/i,
      /jasmine/i,
      /basmati/i,
    ],
  },

  // Beverages
  {
    id: 'coffee',
    displayName: 'Coffee',
    category: 'beverages',
    patterns: [
      /coffee/i,
      /folgers/i,
      /maxwell\s+house/i,
    ],
  },
  {
    id: 'soda',
    displayName: 'Soda',
    category: 'beverages',
    patterns: [
      /soda/i,
      /coca-?cola/i,
      /pepsi/i,
      /sprite/i,
      /dr\.?\s*pepper/i,
    ],
  },
  {
    id: 'orange-juice',
    displayName: 'Orange Juice',
    category: 'beverages',
    patterns: [
      /orange\s+juice/i,
      /\boj\b/i,
      /tropicana/i,
      /simply\s+orange/i,
    ],
  },
];

// Noise words to remove during normalization
const NOISE_WORDS = [
  'fresh',
  'premium',
  'select',
  'choice',
  'organic',
  'natural',
  'family',
  'pack',
  'value',
  'size',
  'brand',
  'quality',
];

/**
 * Normalize text for matching:
 * - Lowercase
 * - Remove noise words
 * - Collapse whitespace
 * - Remove special characters
 */
export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  // Remove noise words
  for (const word of NOISE_WORDS) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }

  // Remove special characters except spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Find the canonical product ID for a given deal name/details
 */
export function findCanonicalProductId(name?: string, details?: string): string | undefined {
  const searchText = `${name || ''} ${details || ''}`.toLowerCase();

  for (const product of CANONICAL_PRODUCTS) {
    for (const pattern of product.patterns) {
      if (pattern.test(searchText)) {
        return product.id;
      }
    }
  }

  return undefined;
}

/**
 * Get canonical product info by ID
 */
export function getCanonicalProduct(id: string): CanonicalProduct | undefined {
  return CANONICAL_PRODUCTS.find((p) => p.id === id);
}

/**
 * Get all canonical products
 */
export function getAllCanonicalProducts(): CanonicalProduct[] {
  return CANONICAL_PRODUCTS;
}

/**
 * Client-side search: filter deals by search query
 * Simple keyword matching for MVP
 */
export function searchDeals<T extends { name?: string; details?: string; dept?: string }>(
  deals: T[],
  query: string
): T[] {
  const normalizedQuery = normalizeText(query);
  const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 0);

  return deals.filter((deal) => {
    const dealText = normalizeText(`${deal.name || ''} ${deal.details || ''} ${deal.dept || ''}`);

    // All query words must appear in the deal text
    return queryWords.every((word) => dealText.includes(word));
  });
}
