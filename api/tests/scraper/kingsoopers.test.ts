import { describe, it, expect, vi, type MockInstance, beforeEach, afterEach } from 'vitest';
import { standardizeKingSoopersAd, StandardDeal, fetchWeeklyDeals, _resetTokenCache } from '../../src/scraper/kingsoopers';

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
    vi.stubEnv('KROGER_CLIENT_ID', 'test-client-id');
    vi.stubEnv('KROGER_CLIENT_SECRET', 'test-client-secret');
    _resetTokenCache();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
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
            { description: 'Tillamook Vanilla Bean Ice Cream', items: [{ price: { regular: 7.49 } }] },
            { description: 'Tillamook Marionberry Pie', items: [{ price: { regular: 7.49 } }] },
            { description: 'Tillamook Extra Creamy Vanilla', items: [{ price: { regular: 6.99 } }] },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

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
            { description: 'Chobani Greek Yogurt', items: [{ price: { regular: 5.99 } }] },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

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
              description: 'Heritage Farm Chicken Breast',
              items: [{ price: { regular: 5.49 }, soldBy: 'WEIGHT' }],
              itemInformation: { averageWeightPerUnit: '3.24 [lb_av]' },
            },
            {
              description: 'Heritage Farm Chicken Thighs',
              items: [{ price: { regular: 5.49 }, soldBy: 'WEIGHT' }],
              itemInformation: { averageWeightPerUnit: '2.50 [lb_av]' },
            },
          ],
        });
      }

      return mockResponse({}, false);
    });

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

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

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

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

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

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

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeNull();
    expect(deals[0].priceDisplay).toBe('See store for details');
    // Only the initial deals fetch should have been called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

    const deals = await fetchWeeklyDeals('circ-1', 'store-1', 'fac-1');

    expect(deals).toHaveLength(1);
    expect(deals[0].priceNumber).toBeCloseTo(2.995); // 5.99 / 2
    expect(deals[0].priceDisplay).toBe('Buy 1 Get 1 Free ($5.99 each)');
    // Only the initial deals fetch should have been called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
