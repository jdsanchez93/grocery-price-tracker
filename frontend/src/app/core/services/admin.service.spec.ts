import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService, Circular, CreateStoreRequest, CreateStoreResponse, UpdateStoreRequest, UpdateStoreResponse } from './admin.service';
import { AvailableStore } from '../models/store.model';
import { ScrapeStatusResponse } from '../models/admin.model';
import { Deal } from '../models/deal.model';

const API = '/api';

describe('AdminService', () => {
  let service: AdminService;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpCtrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AdminService);
  });

  afterEach(() => httpCtrl.verify());

  describe('autoScrapeStore', () => {
    it('should send POST to /admin/scrape/auto with instanceId and force params', () => {
      service.autoScrapeStore('kingsoopers:123').subscribe();

      const req = httpCtrl.expectOne(
        r => r.url === `${API}/admin/scrape/auto`
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.params.get('instanceId')).toBe('kingsoopers:123');
      expect(req.request.params.get('force')).toBe('false');
      req.flush({ success: true, alreadyScraped: false, dealCount: 10 });
    });

    it('should send force=true when force is true', () => {
      service.autoScrapeStore('safeway:456', true).subscribe();

      const req = httpCtrl.expectOne(
        r => r.url === `${API}/admin/scrape/auto`
      );
      expect(req.request.params.get('force')).toBe('true');
      req.flush({ success: true, alreadyScraped: false, dealCount: 5 });
    });
  });

  describe('getAllStores', () => {
    it('should send GET to /stores and return AvailableStore[]', () => {
      const mockStores: AvailableStore[] = [
        { instanceId: 'kingsoopers:123', name: 'King Soopers #123', storeType: 'kingsoopers', identifiers: {}, enabled: true },
        { instanceId: 'safeway:456', name: 'Safeway #456', storeType: 'safeway', identifiers: {}, enabled: true },
      ];

      let result: AvailableStore[] | undefined;
      service.getAllStores().subscribe(stores => result = stores);

      const req = httpCtrl.expectOne(`${API}/stores`);
      expect(req.request.method).toBe('GET');
      req.flush({ stores: mockStores });

      expect(result).toEqual(mockStores);
    });
  });

  describe('getScrapeStatus', () => {
    it('should send GET to /admin/scrape/status with comma-joined instanceIds', () => {
      const mockStatus: ScrapeStatusResponse = {
        'kingsoopers:123': { scraped: true, dealCount: 10, circularId: 'abc' },
        'safeway:456': { scraped: false },
      };

      let result: ScrapeStatusResponse | undefined;
      service.getScrapeStatus(['kingsoopers:123', 'safeway:456']).subscribe(s => result = s);

      const req = httpCtrl.expectOne(
        r => r.url === `${API}/admin/scrape/status`
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('instanceIds')).toBe('kingsoopers:123,safeway:456');
      req.flush(mockStatus);

      expect(result).toEqual(mockStatus);
    });
  });

  describe('createStore', () => {
    it('should send POST to /admin/stores with CreateStoreRequest body and return CreateStoreResponse', () => {
      const mockCreateStoreRequest: CreateStoreRequest = {
        name: 'local kings',
        type: 'kingsoopers',
        storeId: '123',
        facilityId: '456'
      };
      const mockCreateStoreResponse: CreateStoreResponse = {
        success: true,
        store: {
          enabled: true,
          identifiers: {
            'type': 'kingsoopers',
            'storeId': '123',
            'facilityId': '456'
          },
          storeType: 'kingsoopers',
          instanceId: 'kingsoopers:123456',
          name: 'local kings'
        },
      };

      let result: CreateStoreResponse | undefined;
      service.createStore(mockCreateStoreRequest).subscribe(s => result = s);

      const req = httpCtrl.expectOne(r => r.url === `${API}/admin/stores`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCreateStoreRequest);
      req.flush(mockCreateStoreResponse);

      expect(result).toBe(mockCreateStoreResponse);
    });
  });

  describe('updateStore', () => {
    const instanceId = 'kingsoopers:abc123';
    const mockStore: AvailableStore = {
      instanceId,
      name: 'Updated Name',
      storeType: 'kingsoopers',
      identifiers: {},
      enabled: true,
    };

    it('should send PATCH to /admin/stores/:instanceId with the request body', () => {
      const request: UpdateStoreRequest = { name: 'Updated Name' };
      service.updateStore(instanceId, request).subscribe();

      const req = httpCtrl.expectOne(`${API}/admin/stores/${instanceId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(request);
      req.flush({ success: true, store: mockStore });
    });

    it('should return the UpdateStoreResponse from the server', () => {
      const request: UpdateStoreRequest = { name: 'Updated Name' };
      const mockResponse: UpdateStoreResponse = { success: true, store: mockStore };

      let result: UpdateStoreResponse | undefined;
      service.updateStore(instanceId, request).subscribe(r => result = r);

      httpCtrl.expectOne(`${API}/admin/stores/${instanceId}`).flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });

    it('should include address in request body when provided', () => {
      const request: UpdateStoreRequest = {
        name: 'Updated Name',
        address: { addressLine1: '123 Main St', city: 'Denver', state: 'CO' },
      };
      service.updateStore(instanceId, request).subscribe();

      const req = httpCtrl.expectOne(`${API}/admin/stores/${instanceId}`);
      expect(req.request.body.address).toEqual(request.address);
      req.flush({ success: true, store: mockStore });
    });
  });

  describe('getHistoricalDeals', () => {
    it('should send GET to /admin/deals/:instanceId/:weekId', () => {
      service.getHistoricalDeals('kingsoopers:abc', '2026-W17').subscribe();

      const req = httpCtrl.expectOne(`${API}/admin/deals/kingsoopers:abc/2026-W17`);
      expect(req.request.method).toBe('GET');
      req.flush({ weekId: '2026-W17', deals: [], count: 0 });
    });

    it('should return the response as-is', () => {
      const mockResponse = { weekId: '2026-W17', deals: [{ dealId: 'd1' }], count: 1 };

      let result: unknown;
      service.getHistoricalDeals('kingsoopers:abc', '2026-W17').subscribe(r => result = r);

      httpCtrl.expectOne(`${API}/admin/deals/kingsoopers:abc/2026-W17`).flush(mockResponse);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateDeal', () => {
    const instanceId = 'kingsoopers:abc';
    const weekId = '2026-W17';
    const dealId = 'deal-001';
    const url = `${API}/admin/deals/${instanceId}/${weekId}/${dealId}`;

    it('should send PATCH to /admin/deals/:instanceId/:weekId/:dealId', () => {
      service.updateDeal(instanceId, weekId, dealId, { dept: 'produce' }).subscribe();

      const req = httpCtrl.expectOne(url);
      expect(req.request.method).toBe('PATCH');
      req.flush({ deal: {} });
    });

    it('should send the request body', () => {
      const body = { dept: 'dairy', canonicalProductId: 'milk' };
      service.updateDeal(instanceId, weekId, dealId, body).subscribe();

      const req = httpCtrl.expectOne(url);
      expect(req.request.body).toEqual(body);
      req.flush({ deal: {} });
    });

    it('should unwrap the deal from the response envelope', () => {
      const mockDeal: Partial<Deal> = { dealId, dept: 'produce' };

      let result: Deal | undefined;
      service.updateDeal(instanceId, weekId, dealId, { dept: 'produce' }).subscribe(d => result = d);

      httpCtrl.expectOne(url).flush({ deal: mockDeal });

      expect(result).toEqual(mockDeal);
    });

    it('should send only dept when canonicalProductId is omitted', () => {
      service.updateDeal(instanceId, weekId, dealId, { dept: 'frozen' }).subscribe();

      const req = httpCtrl.expectOne(url);
      expect(req.request.body).toEqual({ dept: 'frozen' });
      req.flush({ deal: {} });
    });

    it('should send only canonicalProductId when dept is omitted', () => {
      service.updateDeal(instanceId, weekId, dealId, { canonicalProductId: 'ice-cream' }).subscribe();

      const req = httpCtrl.expectOne(url);
      expect(req.request.body).toEqual({ canonicalProductId: 'ice-cream' });
      req.flush({ deal: {} });
    });
  });

  describe('getAllCirculars', () => {
    it('should send GET to /admin/circulars', () => {
      service.getAllCirculars().subscribe();

      const req = httpCtrl.expectOne(`${API}/admin/circulars`);
      expect(req.request.method).toBe('GET');
      req.flush({ circulars: [] });
    });

    it('should unwrap the circulars array from the response envelope', () => {
      const mockCirculars: Circular[] = [
        { storeInstanceId: 'kingsoopers:abc', weekId: '2026-W17', dealCount: 120, startDate: '2026-04-22', endDate: '2026-04-28' },
        { storeInstanceId: 'safeway:xyz',     weekId: '2026-W17', dealCount: 95,  startDate: '2026-04-22', endDate: '2026-04-28' },
      ];

      let result: Circular[] | undefined;
      service.getAllCirculars().subscribe(c => result = c);

      httpCtrl.expectOne(`${API}/admin/circulars`).flush({ circulars: mockCirculars });

      expect(result).toEqual(mockCirculars);
    });
  });
});
