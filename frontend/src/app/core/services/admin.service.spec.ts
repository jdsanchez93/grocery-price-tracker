import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService, CreateStoreRequest, CreateStoreResponse, UpdateStoreRequest, UpdateStoreResponse } from './admin.service';
import { AvailableStore } from '../models/store.model';
import { ScrapeStatusResponse } from '../models/admin.model';

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
    it('should send GET to /admin/stores and return AvailableStore[]', () => {
      const mockStores: AvailableStore[] = [
        { instanceId: 'kingsoopers:123', name: 'King Soopers #123', storeType: 'kingsoopers', identifiers: {}, enabled: true },
        { instanceId: 'safeway:456', name: 'Safeway #456', storeType: 'safeway', identifiers: {}, enabled: true },
      ];

      let result: AvailableStore[] | undefined;
      service.getAllStores().subscribe(stores => result = stores);

      const req = httpCtrl.expectOne(`${API}/admin/stores`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStores);

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
});
