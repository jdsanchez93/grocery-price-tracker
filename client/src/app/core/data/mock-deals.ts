import { Deal } from '../models/deal.model';

/**
 * Mock deal data for development.
 * This will be replaced with real API calls later.
 */
export const MOCK_DEALS: Deal[] = [
  {
    dealId: 'deal-001',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W07',
    name: 'Organic Bananas',
    details: 'Per lb, limit 5',
    dept: 'Produce',
    priceDisplay: '$0.69/lb',
    priceNumber: 0.69,
    quantity: 1,
    loyalty: 'Card Required',
    image: undefined
  },
  {
    dealId: 'deal-002',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W07',
    name: 'Kroger Large Eggs',
    details: '18 ct',
    dept: 'Dairy',
    priceDisplay: '$3.99',
    priceNumber: 3.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-003',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W07',
    name: 'Boneless Skinless Chicken Breast',
    details: 'Family Pack, per lb',
    dept: 'Meat',
    priceDisplay: '$2.49/lb',
    priceNumber: 2.49,
    quantity: 1,
    loyalty: 'Card Required',
    image: undefined
  },
  {
    dealId: 'deal-004',
    storeInstanceId: 'safeway:def456',
    weekId: '2026-W07',
    name: 'Lucerne Milk',
    details: 'Gallon, Select Varieties',
    dept: 'Dairy',
    priceDisplay: '$2.99',
    priceNumber: 2.99,
    quantity: 1,
    loyalty: 'Club Price',
    image: undefined
  },
  {
    dealId: 'deal-005',
    storeInstanceId: 'safeway:def456',
    weekId: '2026-W07',
    name: 'Signature Select Pasta',
    details: '12-16 oz, Select Varieties',
    dept: 'Grocery',
    priceDisplay: '4 for $5',
    priceNumber: 1.25,
    quantity: 4,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-006',
    storeInstanceId: 'safeway:def456',
    weekId: '2026-W07',
    name: 'Fresh Atlantic Salmon',
    details: 'Farm Raised, per lb',
    dept: 'Seafood',
    priceDisplay: '$8.99/lb',
    priceNumber: 8.99,
    quantity: 1,
    loyalty: 'Club Price',
    image: undefined
  },
  {
    dealId: 'deal-007',
    storeInstanceId: 'sprouts:ghi789',
    weekId: '2026-W07',
    name: 'Organic Avocados',
    details: 'Large Hass',
    dept: 'Produce',
    priceDisplay: '2 for $3',
    priceNumber: 1.5,
    quantity: 2,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-008',
    storeInstanceId: 'sprouts:ghi789',
    weekId: '2026-W07',
    name: 'Grass-Fed Ground Beef',
    details: '85% Lean, per lb',
    dept: 'Meat',
    priceDisplay: '$5.99/lb',
    priceNumber: 5.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-009',
    storeInstanceId: 'sprouts:ghi789',
    weekId: '2026-W07',
    name: 'Organic Baby Spinach',
    details: '5 oz Container',
    dept: 'Produce',
    priceDisplay: '$2.99',
    priceNumber: 2.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-010',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W07',
    name: 'Coca-Cola or Pepsi',
    details: '12 pk, 12 oz cans',
    dept: 'Beverages',
    priceDisplay: '3 for $12',
    priceNumber: 4.0,
    quantity: 3,
    loyalty: 'Card Required',
    image: undefined
  },
  {
    dealId: 'deal-011',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W07',
    name: 'Private Selection Ice Cream',
    details: '48 oz, Select Varieties',
    dept: 'Frozen',
    priceDisplay: '$4.99',
    priceNumber: 4.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined
  },
  {
    dealId: 'deal-012',
    storeInstanceId: 'safeway:def456',
    weekId: '2026-W07',
    name: 'Tide Laundry Detergent',
    details: '92 oz Liquid or 45 ct Pods',
    dept: 'Household',
    priceDisplay: '$11.99',
    priceNumber: 11.99,
    quantity: 1,
    loyalty: 'Club Price',
    image: undefined
  }
];
