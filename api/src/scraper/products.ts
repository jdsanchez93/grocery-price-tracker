// Canonical Product Matching Logic
// Tiered approach:
// 1. Text normalization (lowercase, remove noise, collapse whitespace)
// 2. Dept normalization to a stable set of categories
// 3. Canonical product mapping via regex patterns, optionally filtered by dept

type NormalizedDept =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'snacks'
  | 'candy'
  | 'seasonal'
  | 'beverages'
  | 'pantry'
  | 'cereal'
  | 'frozen'
  | 'deli'
  | 'general'  // General merchandise / drug-store (GM, DRUG/GM) — intentionally non-food
  | 'other';

function normalizeDeptPart(d: string): NormalizedDept {
  d = d.toLowerCase();
  if (/produce|fruit|vegetable|fresh herb/.test(d)) return 'produce';
  if (/dairy|milk|cheese/.test(d)) return 'dairy';
  if (/meat|beef|pork|poultry|chicken/.test(d)) return 'meat';
  if (/seafood|fish/.test(d)) return 'seafood';
  if (/bakery|bread/.test(d)) return 'bakery';
  if (/snack|chip/.test(d)) return 'snacks';
  if (/candy|confection|chocolate/.test(d)) return 'candy';
  if (/seasonal|holiday/.test(d)) return 'seasonal';
  if (/beverage|drink|juice|soda|water/.test(d)) return 'beverages';
  if (/cereal|breakfast/.test(d)) return 'cereal';
  if (/frozen/.test(d)) return 'frozen';
  if (/deli|prepared/.test(d)) return 'deli';
  if (/\bgm\b/.test(d)) return 'general';  // matches "GM" and "DRUG/GM"
  if (/pantry|dry|grocery|grain|pasta|rice|baking|natural foods/.test(d)) return 'pantry';
  return 'other';
}

function refineDeptFromName(name: string): NormalizedDept | undefined {
  const n = name.toLowerCase();
  if (/ice cream|gelato|sorbet|frozen|popsicle|pizza|pot pie|steamer/.test(n)) return 'frozen';
  if (/\bmilk\b|cheese|yogurt|butter|cream cheese|creamer|\begg/.test(n)) return 'dairy';
  if (/\bchicken\b|beef|pork|salmon|steak|bacon|tuna/.test(n)) return 'meat';
  if (/\bsoda\b|juice|\bwater\b|coffee|tea|energy drink|sparkling|seltzer|powerade|gatorade|celsius|alani/.test(n)) return 'beverages';
  if (/cereal|granola/.test(n)) return 'cereal';
  if (/\bchip|cracker|pretzel|popcorn/.test(n)) return 'snacks';
  if (/candy|chocolate|gummy|jellybean|m&m|peep|cadbury|brach/.test(n)) return 'candy';
  if (/\bbread\b|bagel|muffin|\broll\b|biscuit|croissant/.test(n)) return 'bakery';
  return undefined;
}

/**
 * Normalize a raw department string (from any scraper) to a stable internal category.
 * Input may be a comma-joined list of departments (e.g., "DRUG/GM, GROCERY").
 *
 * Name-based fallback only fires when GROCERY is among the departments — GROCERY signals
 * "this is a food item but the taxonomy is too coarse". GM/DRUG/GM-only items return
 * 'general' without fallback to avoid misclassifying non-food items (e.g. Easter candy
 * with "egg" in the name being tagged as dairy).
 */
export function normalizeDept(dept: string, name?: string): NormalizedDept {
  const parts = dept.split(',').map(p => p.trim()).filter(Boolean);

  let hasGrocery = false;
  let hasGeneral = false;

  for (const part of parts) {
    const result = normalizeDeptPart(part);
    if (result !== 'pantry' && result !== 'general' && result !== 'other') return result;
    if (result === 'pantry') hasGrocery = true;
    if (result === 'general') hasGeneral = true;
  }

  if (hasGrocery) {
    return name ? (refineDeptFromName(name) ?? 'pantry') : 'pantry';
  }
  return hasGeneral ? 'general' : 'other';
}

interface CanonicalProduct {
  id: string;
  displayName: string;
  category: string;
  patterns: RegExp[];
  // If set, the deal's normalized dept MUST be one of these
  deptIn?: NormalizedDept[];
  // If set, the deal's normalized dept must NOT be any of these
  deptExclude?: NormalizedDept[];
}

// Canonical product definitions
// Each product has patterns that match various ways it might appear in ads.
// deptIn / deptExclude prevent cross-category false positives (e.g., "eggs" in Seasonal
// matching Easter candy, or "potato" in Snacks matching potato chips).
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
    deptIn: ['meat'],
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
    deptIn: ['meat'],
  },
  {
    id: 'bacon',
    displayName: 'Bacon',
    category: 'meat',
    patterns: [
      /\bbacon\b/i,
      /thick\s+cut\s+bacon/i,
    ],
    deptIn: ['meat', 'deli'],
  },
  {
    id: 'pork-chops',
    displayName: 'Pork Chops',
    category: 'meat',
    patterns: [
      /pork\s+chop/i,
      /bone-?in\s+pork/i,
    ],
    deptIn: ['meat'],
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
    deptIn: ['seafood', 'meat'],
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
    deptIn: ['dairy'],
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
    // Restrict to dairy so Easter egg candy (Seasonal/Candy dept) is excluded
    deptIn: ['dairy'],
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
    deptIn: ['dairy'],
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
    // Exclude snacks so "Cheez-Its" or "Cheese Crackers" don't match
    deptIn: ['dairy', 'deli'],
  },
  {
    id: 'yogurt',
    displayName: 'Yogurt',
    category: 'dairy',
    patterns: [
      /yogurt/i,
      /greek\s+yogurt/i,
    ],
    deptIn: ['dairy'],
  },

  // Produce
  {
    id: 'bananas',
    displayName: 'Bananas',
    category: 'produce',
    patterns: [
      /\bbanana/i,
    ],
    deptIn: ['produce'],
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
    // Restrict to produce so "Apple Juice", "Snapple" etc. don't match
    deptIn: ['produce'],
  },
  {
    id: 'avocados',
    displayName: 'Avocados',
    category: 'produce',
    patterns: [
      /avocado/i,
      /hass\s+avocado/i,
    ],
    deptIn: ['produce'],
  },
  {
    id: 'strawberries',
    displayName: 'Strawberries',
    category: 'produce',
    patterns: [
      /strawberr/i,
    ],
    deptIn: ['produce'],
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
    deptIn: ['produce'],
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
    deptIn: ['produce'],
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
    // Restrict to produce so potato chips (Snacks dept) are excluded
    deptIn: ['produce'],
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
    deptIn: ['produce'],
  },

  // Snacks
  {
    id: 'chips',
    displayName: 'Chips',
    category: 'snacks',
    patterns: [
      /potato\s+chip/i,
      /tortilla\s+chip/i,
      /\blay'?s\b/i,
      /\bdoritos\b/i,
      /\bruffles\b/i,
      /\btostitos\b/i,
      /kettle\s+brand/i,
      /kettle\s+cook/i,
      /miss\s+vickie/i,
      /late\s+july/i,
    ],
    // 'snacks' — direct match (Safeway "Cookies, Snacks & Candy"; KS GROCERY w/ "chip" in name)
    // 'pantry' — KS GROCERY items where name fallback can't find "chip" (e.g. "Ruffles")
    deptIn: ['snacks', 'pantry'],
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
    deptIn: ['bakery', 'pantry'],
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
    // Restrict to cereal/pantry so "Rice Krispie Treats" (Snacks) doesn't match
    deptIn: ['cereal', 'pantry'],
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
    deptIn: ['pantry'],
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
    // Restrict to pantry so "Rice Krispie Treats" (Snacks/Cereal) doesn't match
    deptIn: ['pantry'],
  },

  // Frozen
  {
    id: 'ice-cream',
    displayName: 'Ice Cream',
    category: 'frozen',
    patterns: [
      /ice\s+cream/i,
      /häagen-dazs/i,
      /haagen-dazs/i,
      /ben\s*&\s*jerry/i,
      /tillamook\s+ice/i,
      /\bgelato\b/i,
      /\bsorbet\b/i,
    ],
    deptIn: ['frozen', 'dairy', 'general', 'pantry'],
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
    deptIn: ['beverages', 'pantry'],
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
    deptIn: ['beverages'],
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
    deptIn: ['beverages', 'dairy', 'produce'],
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
 * Find the canonical product ID for a given deal name/details/dept.
 * Passing dept enables dept-aware filtering which prevents cross-category false positives.
 */
export function findCanonicalProductId(name?: string, details?: string, dept?: string): string | undefined {
  const searchText = `${name || ''} ${details || ''}`.toLowerCase();
  const normalizedDeptValue = dept ? normalizeDept(dept, name) : undefined;

  for (const product of CANONICAL_PRODUCTS) {
    if (normalizedDeptValue !== undefined) {
      if (product.deptIn && !product.deptIn.includes(normalizedDeptValue)) continue;
      if (product.deptExclude && product.deptExclude.includes(normalizedDeptValue)) continue;
    }

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
