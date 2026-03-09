import { Deal } from './deal.model';

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    dealId: 'deal-1',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W04',
    name: 'Test Deal',
    details: undefined,
    dept: 'Produce',
    priceDisplay: '$1.99',
    priceNumber: 1.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined,
    ...overrides,
  };
}
