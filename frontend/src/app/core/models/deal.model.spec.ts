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

describe('deal.model', () => {
  it('should create a deal with defaults', () => {
    const deal = makeDeal();
    expect(deal.dealId).toBe('deal-1');
    expect(deal.storeInstanceId).toBe('kingsoopers:abc123');
  });

  it('should allow overrides', () => {
    const deal = makeDeal({ name: 'Custom', priceNumber: 5.99 });
    expect(deal.name).toBe('Custom');
    expect(deal.priceNumber).toBe(5.99);
  });
});
