import { describe, it, expect, vi, type MockInstance, beforeEach, afterEach } from 'vitest';
import { standardizeKingSoopersAd, StandardDeal, fetchWeeklyDeals, _resetTokenCache, _getKrogerPriceVariants, _fetchProductPrices, _fetchProductPricesByTerm } from '../../src/scraper/kingsoopers';

vi.mock('../../src/config', () => ({
  getKrogerCreds: vi.fn().mockResolvedValue({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  }),
}));

describe('standardizeKingSoopersAd', () => {
  describe('2FOR deals', () => {
    it('should parse _KRGR_FINAL COST WUB 2FOR with salePrice correctly', () => {
      // This is the bug case: "4 for $10" was incorrectly parsed as "4 for $5.79"
      const ad = {
        mainlineCopy: 'Coca-Cola Soft Drinks',
        pricingTemplate: '_KRGR_FINAL COST WUB 2FOR',
        salePrice: 10,
        quantity: 4,
        disclaimer: 'Regular retail is up to $5.79 each with Card.',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('4 for $10');
      expect(result.priceNumber).toBe(2.5);
      expect(result.quantity).toBe(4);
    });

    it('should parse _KRGR_2FOR with retailPrice correctly (no regression)', () => {
      const ad = {
        mainlineCopy: 'Cereal',
        pricingTemplate: '_KRGR_2FOR',
        retailPrice: '5',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $5');
      expect(result.priceNumber).toBe(2.5);
      expect(result.quantity).toBe(2);
    });

    it('should default to quantity 2 for 2FOR when quantity is not specified', () => {
      const ad = {
        mainlineCopy: 'Chips',
        pricingTemplate: '_KRGR_2FOR',
        salePrice: 6,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $6');
      expect(result.priceNumber).toBe(3);
      expect(result.quantity).toBe(2);
    });
  });

  describe('BOGO deals', () => {
    it('should parse _KRGR_BOGO with retailPrice correctly', () => {
      const ad = {
        mainlineCopy: 'Ice Cream',
        pricingTemplate: '_KRGR_BOGO',
        retailPrice: '5.99',
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 Free ($5.99 each)');
      expect(result.priceNumber).toBeCloseTo(2.995);
      expect(result.quantity).toBe(2);
    });

    it('should parse _KRGR_BOGO without price gracefully', () => {
      const ad = {
        mainlineCopy: 'Yogurt',
        pricingTemplate: '_KRGR_BOGO',
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 Free');
      expect(result.priceNumber).toBeNull();
      expect(result.quantity).toBe(2);
    });
  });

  describe('BOGO % deals', () => {
    it('should parse _KRGR_BOGO % with percentOff correctly', () => {
      const ad = {
        mainlineCopy: 'Frozen Pizza',
        pricingTemplate: '_KRGR_BOGO %',
        retailPrice: '8',
        percentOff: 50,
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 50% Off ($8 each)');
      // (8 * 1 + 8 * 0.5) / 2 = 12 / 2 = 6
      expect(result.priceNumber).toBe(6);
      expect(result.quantity).toBe(2);
    });

    it('should parse _KRGR_BOGO % without price gracefully', () => {
      const ad = {
        mainlineCopy: 'Bread',
        pricingTemplate: '_KRGR_BOGO %',
        percentOff: 50,
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 50% Off');
      expect(result.priceNumber).toBeNull();
      expect(result.quantity).toBe(2);
    });
  });

  describe('price fallback behavior', () => {
    it('should prefer salePrice over retailPrice', () => {
      const ad = {
        mainlineCopy: 'Item',
        pricingTemplate: '_KRGR_2FOR',
        salePrice: 10,
        retailPrice: '8',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $10');
      expect(result.priceNumber).toBe(5);
    });

    it('should fallback to retailPrice when salePrice is missing', () => {
      const ad = {
        mainlineCopy: 'Item',
        pricingTemplate: '_KRGR_2FOR',
        retailPrice: '8',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $8');
      expect(result.priceNumber).toBe(4);
    });

    it('should fallback to disclaimer price when both salePrice and retailPrice are missing', () => {
      const ad = {
        mainlineCopy: 'Item',
        disclaimer: 'Regular retail is up to $7.49 each with Card.',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('$7.49');
      expect(result.priceNumber).toBe(7.49);
    });

    it('should show "See store for details" when no price is available', () => {
      const ad = {
        mainlineCopy: 'Mystery Item',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('See store for details');
      expect(result.priceNumber).toBeNull();
    });
  });

  describe('single item price display', () => {
    it('should display single item price correctly', () => {
      const ad = {
        mainlineCopy: 'Milk',
        salePrice: 3.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('$3.99');
      expect(result.priceNumber).toBe(3.99);
      expect(result.quantity).toBe(1);
    });

    it('should handle quantity > 1 without 2FOR template', () => {
      const ad = {
        mainlineCopy: 'Cans',
        salePrice: 5,
        quantity: 5,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('5 for $5');
      expect(result.priceNumber).toBe(1);
      expect(result.quantity).toBe(5);
    });
  });

  describe('standard deal fields', () => {
    it('should populate all standard deal fields', () => {
      const ad = {
        mainlineCopy: 'Test Product',
        underlineCopy: 'Product details',
        departments: [{ department: 'Grocery' }],
        salePrice: 2.99,
        loyaltyIndicator: 'CARD_REQUIRED',
        images: [{ url: 'https://example.com/image.jpg' }],
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.store).toBe('King Soopers');
      expect(result.name).toBe('Test Product');
      expect(result.details).toBe('Product details');
      expect(result.dept).toBe('Grocery');
      expect(result.loyalty).toBe('CARD_REQUIRED');
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    it('should use description as fallback when underlineCopy is missing', () => {
      const ad = {
        mainlineCopy: 'Test Product',
        description: 'Fallback description',
        salePrice: 1.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.details).toBe('Fallback description');
    });

    it('should handle multiple departments', () => {
      const ad = {
        mainlineCopy: 'Multi-dept Item',
        departments: [{ department: 'Grocery' }, { department: 'Bakery' }],
        salePrice: 4.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.dept).toBe('Grocery, Bakery');
    });
  });
});

describe('fetchWeeklyDeals - BOGO price resolution', () => {
  let fetchSpy: MockInstance<typeof global.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    _resetTokenCache();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const DEALS_URL = 'https://www.kingsoopers.com/atlas/v1/shoppable-weekly-deals/deals';
  const TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';

  function isProductUrl(url: string): boolean {
    return url.includes('api.kroger.com/v1/products') && url.includes('filter.productId=');
  }

  function isTokenUrl(url: string): boolean {
    return url.includes(TOKEN_URL);
  }

  function tokenResponse(): Response {
    return mockResponse({ access_token: 'test-token', expires_in: 1800 });
  }

  function mockResponse(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('should resolve price using min and attach variants with multiple products', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-123')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-123',
                mainlineCopy: 'Ice Cream',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-123')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              upcs: [{ upc: '0007283008114' }, { upc: '0007283008115' }, { upc: '0007283008116' }],
            },
          },
        });
      }

      if (isTokenUrl(url)) return tokenResponse();

      if (isProductUrl(url)) {
        return mockResponse({
          data: [
            { upc: '0007283008114', description: 'Tillamook Vanilla Bean Ice Cream', items: [{ price: { regular: 7.49 } }] },
            { upc: '0007283008115', description: 'Tillamook Marionberry Pie', items: [{ price: { regular: 7.49 } }] },
            { upc: '0007283008116', description: 'Tillamook Extra Creamy Vanilla', items: [{ price: { regular: 6.99 } }] },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    // Uses min price (6.99) for priceNumber
    expect(deals[0].priceNumber).toBeCloseTo(3.495); // 6.99 / 2
    // Shows price range in display
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($6.99 - $7.49 each)');
    expect(deals[0].quantity).toBe(2);
    // Attaches sorted variants with example product names
    expect(deals[0].priceVariants).toEqual([
      { price: 6.99, example: 'Tillamook Extra Creamy Vanilla' },
      { price: 7.49, example: 'Tillamook Vanilla Bean Ice Cream' },
    ]);
  });

  it('should resolve single-price BOGO without range in display', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-single')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-single',
                mainlineCopy: 'Yogurt',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-single')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              upcs: [{ upc: '0001111041700' }],
            },
          },
        });
      }

      if (isTokenUrl(url)) return tokenResponse();

      if (isProductUrl(url)) {
        return mockResponse({
          data: [
            { upc: '0001111041700', description: 'Chobani Greek Yogurt', items: [{ price: { regular: 5.99 } }] },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeCloseTo(2.995); // 5.99 / 2
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($5.99 each)');
    expect(deals[0].priceVariants).toEqual([
      { price: 5.99, example: 'Chobani Greek Yogurt' },
    ]);
  });

  it('should compute effective per-unit price for weight-sold items', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-chicken')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-chicken',
                mainlineCopy: 'Chicken Breast',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-chicken')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              upcs: [{ upc: '0027061550000' }, { upc: '0027061550001' }],
            },
          },
        });
      }

      if (isTokenUrl(url)) return tokenResponse();

      if (isProductUrl(url)) {
        return mockResponse({
          data: [
            {
              upc: '0027061550000',
              description: 'Heritage Farm Chicken Breast',
              items: [{ price: { regular: 5.49 }, soldBy: 'WEIGHT' }],
              itemInformation: { averageWeightPerUnit: '3.24 [lb_av]' },
            },
            {
              upc: '0027061550001',
              description: 'Heritage Farm Chicken Thighs',
              items: [{ price: { regular: 5.49 }, soldBy: 'WEIGHT' }],
              itemInformation: { averageWeightPerUnit: '2.50 [lb_av]' },
            },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    // Min effective price: 5.49 * 2.50 = 13.73, BOGO: 13.73 / 2 = 6.865
    expect(deals[0].priceNumber).toBeCloseTo(6.8625);
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($13.73 - $17.79 each)');
    expect(deals[0].priceVariants).toEqual([
      { price: 13.73, example: 'Heritage Farm Chicken Thighs', perLb: 5.49, avgWeight: 2.5 },
      { price: 17.79, example: 'Heritage Farm Chicken Breast', perLb: 5.49, avgWeight: 3.24 },
    ]);
  });

  it('should retain null price when deal detail endpoint fails', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-456')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-456',
                mainlineCopy: 'Ice Cream',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      // Deal detail returns error
      if (url.includes(DEALS_URL + '/deal-456')) {
        return mockResponse({}, false);
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeNull();
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free');
  });

  it('should retain null price when product endpoint fails', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-789')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-789',
                mainlineCopy: 'Cheese',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-789')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              upcs: [{ upc: '0001111099999' }],
            },
          },
        });
      }

      // Token fetch
      if (isTokenUrl(url)) return tokenResponse();

      // Product endpoint fails
      if (isProductUrl(url)) {
        return mockResponse({}, false);
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeNull();
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free');
  });

  it('should not attempt resolution for non-BOGO deals with null price', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-abc',
                mainlineCopy: 'Mystery Item',
                // No pricingTemplate — not BOGO
              }],
            },
          },
        });
      }

      // Should never be called
      throw new Error('Unexpected fetch call: ' + url);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeNull();
    expect(deals[0].priceDisplay).toBe('See store for details');
    // Only the initial deals fetch should have been called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should fallback to term search when UPC lookup returns partial results', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-fallback')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-fallback',
                mainlineCopy: 'Tostitos',
                underlineCopy: '5-8 oz',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-fallback')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              mainlineCopy: 'Tostitos',
              underlineCopy: '5-8 oz',
              upcs: [{ upc: 'UPC-A' }, { upc: 'UPC-B' }],
            },
          },
        });
      }

      if (isTokenUrl(url)) return tokenResponse();

      // UPC lookup returns only 1 of 2
      if (url.includes('api.kroger.com/v1/products') && url.includes('filter.productId=')) {
        return mockResponse({
          data: [
            { upc: 'UPC-A', description: 'Tostitos Scoops', items: [{ price: { regular: 4.99 } }] },
          ],
          meta: { pagination: { start: 0, limit: 50, total: 1 } },
        });
      }

      // Term search finds the missing UPC
      if (url.includes('api.kroger.com/v1/products') && url.includes('filter.term=')) {
        return mockResponse({
          data: [
            { upc: 'UPC-A', description: 'Tostitos Scoops', items: [{ price: { regular: 4.99 } }] },
            { upc: 'UPC-B', description: 'Tostitos Rounds', items: [{ price: { regular: 3.99 } }] },
          ],
          meta: { pagination: { start: 0, limit: 50, total: 2 } },
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceVariants).toEqual([
      { price: 3.99, example: 'Tostitos Rounds' },
      { price: 4.99, example: 'Tostitos Scoops' },
    ]);
    expect(deals[0].priceNumber).toBeCloseTo(1.995); // 3.99 / 2
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($3.99 - $4.99 each)');
  });

  it('should retain null price when both UPC and term lookups return no prices', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-empty')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-empty',
                mainlineCopy: 'Rare Item',
                underlineCopy: 'Limited edition',
                pricingTemplate: '_KRGR_BOGO',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      if (url.includes(DEALS_URL + '/deal-empty')) {
        return mockResponse({
          data: {
            shoppableWeeklyDealDetails: {
              mainlineCopy: 'Rare Item',
              underlineCopy: 'Limited edition',
              upcs: [{ upc: 'UPC-MISSING' }],
            },
          },
        });
      }

      if (isTokenUrl(url)) return tokenResponse();

      // Both UPC and term lookups return empty
      if (url.includes('api.kroger.com/v1/products')) {
        return mockResponse({
          data: [],
          meta: { pagination: { start: 0, limit: 50, total: 0 } },
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeNull();
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free');
    expect(deals[0].priceVariants).toBeUndefined();
  });

  it('should not re-fetch for BOGO deal that already has retailPrice', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes(DEALS_URL) && !url.includes('/deal-')) {
        return mockResponse({
          data: {
            shoppableWeeklyDeals: {
              ads: [{
                id: 'deal-existing',
                mainlineCopy: 'Ice Cream',
                pricingTemplate: '_KRGR_BOGO',
                retailPrice: '5.99',
                buyQuantity: 1,
                getQuantity: 1,
              }],
            },
          },
        });
      }

      // Should never be called — already has price
      throw new Error('Unexpected fetch call: ' + url);
    });

    const deals = await fetchWeeklyDeals('circ-1', { type: 'kingsoopers', storeId: 'store-1', facilityId: 'fac-1' });

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeCloseTo(2.995); // 5.99 / 2
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($5.99 each)');
    // Only the initial deals fetch should have been called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('_getKrogerPriceVariants', () => {
  let fetchSpy: MockInstance<typeof global.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    _resetTokenCache();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockResponse(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('should paginate when total > start + limit', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes('oauth2/token')) {
        return mockResponse({ access_token: 'test-token', expires_in: 1800 });
      }

      if (url.includes('api.kroger.com/v1/products')) {
        const params = new URL(url).searchParams;
        const start = parseInt(params.get('filter.start') || '0');

        if (start === 0) {
          return mockResponse({
            data: [
              { upc: '001', description: 'Product A', items: [{ price: { regular: 1.99 } }] },
              { upc: '002', description: 'Product B', items: [{ price: { regular: 2.99 } }] },
            ],
            meta: { pagination: { start: 0, limit: 2, total: 3 } },
          });
        } else {
          return mockResponse({
            data: [
              { upc: '003', description: 'Product C', items: [{ price: { regular: 3.99 } }] },
            ],
            meta: { pagination: { start: 2, limit: 2, total: 3 } },
          });
        }
      }

      return mockResponse({}, false);
    });

    const result = await _getKrogerPriceVariants({
      'filter.term': 'test',
      'filter.locationId': 'loc-1',
      'filter.limit': '2',
    });

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['001']).toEqual({ price: 1.99, example: 'Product A' });
    expect(result['002']).toEqual({ price: 2.99, example: 'Product B' });
    expect(result['003']).toEqual({ price: 3.99, example: 'Product C' });
  });

  it('should not paginate when total <= start + limit', async () => {
    let productCallCount = 0;

    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes('oauth2/token')) {
        return mockResponse({ access_token: 'test-token', expires_in: 1800 });
      }

      if (url.includes('api.kroger.com/v1/products')) {
        productCallCount++;
        return mockResponse({
          data: [
            { upc: '001', description: 'Product A', items: [{ price: { regular: 1.99 } }] },
          ],
          meta: { pagination: { start: 0, limit: 50, total: 1 } },
        });
      }

      return mockResponse({}, false);
    });

    const result = await _getKrogerPriceVariants({
      'filter.term': 'test',
      'filter.locationId': 'loc-1',
    });

    expect(Object.keys(result)).toHaveLength(1);
    expect(productCallCount).toBe(1);
  });
});

describe('_fetchProductPrices', () => {
  let fetchSpy: MockInstance<typeof global.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    _resetTokenCache();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockResponse(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('should split UPCs into batches of 10 and merge results', async () => {
    const batchProductIds: string[][] = [];

    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes('oauth2/token')) {
        return mockResponse({ access_token: 'test-token', expires_in: 1800 });
      }

      if (url.includes('api.kroger.com/v1/products')) {
        const params = new URL(url).searchParams;
        const ids = params.get('filter.productId')?.split(',') || [];
        batchProductIds.push(ids);

        return mockResponse({
          data: ids.map((id, i) => ({
            upc: id,
            description: `Product ${id}`,
            items: [{ price: { regular: 1.00 + i * 0.01 } }],
          })),
          meta: { pagination: { start: 0, limit: 50, total: ids.length } },
        });
      }

      return mockResponse({}, false);
    });

    // 12 UPCs => 2 batches (10 + 2)
    const upcs = Array.from({ length: 12 }, (_, i) => `UPC${String(i).padStart(3, '0')}`);
    const result = await _fetchProductPrices(upcs, 'loc-1');

    expect(batchProductIds).toHaveLength(2);
    expect(batchProductIds[0]).toHaveLength(10);
    expect(batchProductIds[1]).toHaveLength(2);
    expect(Object.keys(result)).toHaveLength(12);
  });
});

describe('_fetchProductPricesByTerm', () => {
  let fetchSpy: MockInstance<typeof global.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    _resetTokenCache();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockResponse(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('should split on " or " and search multiple terms, filtering to deal UPCs', async () => {
    const searchedTerms: string[] = [];

    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes('oauth2/token')) {
        return mockResponse({ access_token: 'test-token', expires_in: 1800 });
      }

      if (url.includes('api.kroger.com/v1/products') && url.includes('filter.term=')) {
        const params = new URL(url).searchParams;
        const term = params.get('filter.term')!;
        searchedTerms.push(term);

        if (term.includes('Tostitos')) {
          return mockResponse({
            data: [
              { upc: 'UPC-TOSTITOS', description: 'Tostitos Chips', items: [{ price: { regular: 4.99 } }] },
              { upc: 'UPC-UNRELATED', description: 'Unrelated Product', items: [{ price: { regular: 9.99 } }] },
            ],
            meta: { pagination: { start: 0, limit: 50, total: 2 } },
          });
        }

        if (term.includes('Doritos')) {
          return mockResponse({
            data: [
              { upc: 'UPC-DORITOS', description: 'Doritos Nacho', items: [{ price: { regular: 3.99 } }] },
            ],
            meta: { pagination: { start: 0, limit: 50, total: 1 } },
          });
        }

        return mockResponse({ data: [], meta: { pagination: { start: 0, limit: 50, total: 0 } } });
      }

      return mockResponse({}, false);
    });

    const dealDetails = {
      data: {
        shoppableWeeklyDealDetails: {
          mainlineCopy: 'Tostitos',
          underlineCopy: '5-8 oz or Doritos, 9-10.75 oz',
          upcs: [{ upc: 'UPC-TOSTITOS' }, { upc: 'UPC-DORITOS' }],
        },
      },
    };

    const result = await _fetchProductPricesByTerm(dealDetails, 'loc-1');

    expect(searchedTerms).toHaveLength(2);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['UPC-TOSTITOS']).toBeDefined();
    expect(result['UPC-DORITOS']).toBeDefined();
    expect(result['UPC-UNRELATED']).toBeUndefined();
  });

  it('should use full mainline as search term when no " or " in underline', async () => {
    const searchedTerms: string[] = [];

    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();

      if (url.includes('oauth2/token')) {
        return mockResponse({ access_token: 'test-token', expires_in: 1800 });
      }

      if (url.includes('api.kroger.com/v1/products') && url.includes('filter.term=')) {
        const params = new URL(url).searchParams;
        searchedTerms.push(params.get('filter.term')!);

        return mockResponse({
          data: [
            { upc: 'UPC-ICE1', description: 'Tillamook Vanilla', items: [{ price: { regular: 7.49 } }] },
            { upc: 'UPC-ICE2', description: 'Tillamook Chocolate', items: [{ price: { regular: 7.49 } }] },
          ],
          meta: { pagination: { start: 0, limit: 50, total: 2 } },
        });
      }

      return mockResponse({}, false);
    });

    const dealDetails = {
      data: {
        shoppableWeeklyDealDetails: {
          mainlineCopy: 'Tillamook Ice Cream',
          underlineCopy: 'Select Varieties, 6.88-21 oz',
          upcs: [{ upc: 'UPC-ICE1' }, { upc: 'UPC-ICE2' }],
        },
      },
    };

    const result = await _fetchProductPricesByTerm(dealDetails, 'loc-1');

    expect(searchedTerms).toHaveLength(1);
    expect(searchedTerms[0]).toBe('Tillamook Ice Cream');
    expect(Object.keys(result)).toHaveLength(2);
  });
});
