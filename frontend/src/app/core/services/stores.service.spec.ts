import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StoresService } from './stores.service';
import { DealsService } from './deals.service';
import { UserStore, AvailableStore } from '../models/store.model';

const API = '/api';

function makeUserStore(overrides: Partial<UserStore> = {}): UserStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'King Soopers #1',
    storeType: 'kingsoopers',
    chain: 'kroger',
    addedAt: '2026-01-01',
    ...overrides,
  };
}

function makeAvailableStore(overrides: Partial<AvailableStore> = {}): AvailableStore {
  return {
    instanceId: 'kingsoopers:xyz',
    name: 'King Soopers #99',
    storeType: 'kingsoopers',
    identifiers: {},
    enabled: true,
    ...overrides,
  };
}

describe('StoresService', () => {
  let service: StoresService;
  let httpCtrl: HttpTestingController;
  let dealsService: { loadDeals: ReturnType<typeof vi.fn> };

  function setup() {
    dealsService = { loadDeals: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DealsService, useValue: dealsService },
      ],
    });
    httpCtrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(StoresService);
  }

  /** Flush the constructor's GET /me/stores request. */
  function flushInitialRequest(stores: UserStore[] = []) {
    const req = httpCtrl.expectOne(`${API}/me/stores`);
    req.flush({ stores });
  }

  describe('loadUserStores', () => {
    beforeEach(() => setup());

    it('should fetch user stores on construction', () => {
      const stores = [makeUserStore()];
      flushInitialRequest(stores);

      expect(service.getUserStores()).toEqual(stores);
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should set error on failure', () => {
      const req = httpCtrl.expectOne(`${API}/me/stores`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should clear error and set loading on retry', () => {
      flushInitialRequest();

      service.loadUserStores();
      expect(service.loading()).toBe(true);
      expect(service.error()).toBeNull();

      const req = httpCtrl.expectOne(`${API}/me/stores`);
      req.flush({ stores: [] });
      httpCtrl.verify();
    });
  });

  describe('addStore', () => {
    beforeEach(() => {
      setup();
      flushInitialRequest();
    });

    it('should return an Observable that triggers loadUserStores and loadDeals on success', () => {
      let completed = false;
      service.addStore('kingsoopers:abc').subscribe({ complete: () => (completed = true) });

      const postReq = httpCtrl.expectOne(`${API}/me/stores/kingsoopers:abc`);
      expect(postReq.request.method).toBe('POST');
      postReq.flush(null);

      // loadUserStores triggers a new GET
      const getReq = httpCtrl.expectOne(`${API}/me/stores`);
      getReq.flush({ stores: [makeUserStore()] });

      expect(completed).toBe(true);
      expect(dealsService.loadDeals).toHaveBeenCalled();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should set error and re-throw on failure', () => {
      let errorCaught = false;
      service.addStore('kingsoopers:abc').subscribe({
        error: () => (errorCaught = true),
      });

      const req = httpCtrl.expectOne(`${API}/me/stores/kingsoopers:abc`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(errorCaught).toBe(true);
      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });
  });

  describe('removeStore', () => {
    beforeEach(() => {
      setup();
      flushInitialRequest();
    });

    it('should return an Observable that triggers loadUserStores and loadDeals on success', () => {
      let completed = false;
      service.removeStore('kingsoopers:abc').subscribe({ complete: () => (completed = true) });

      const delReq = httpCtrl.expectOne(`${API}/me/stores/kingsoopers:abc`);
      expect(delReq.request.method).toBe('DELETE');
      delReq.flush(null);

      const getReq = httpCtrl.expectOne(`${API}/me/stores`);
      getReq.flush({ stores: [] });

      expect(completed).toBe(true);
      expect(dealsService.loadDeals).toHaveBeenCalled();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should set error and re-throw on failure', () => {
      let errorCaught = false;
      service.removeStore('kingsoopers:abc').subscribe({
        error: () => (errorCaught = true),
      });

      const req = httpCtrl.expectOne(`${API}/me/stores/kingsoopers:abc`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(errorCaught).toBe(true);
      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });
  });

  describe('loadAvailableStores', () => {
    beforeEach(() => {
      setup();
      flushInitialRequest();
    });

    it('should fetch available stores for a type', () => {
      const stores = [makeAvailableStore()];
      service.loadAvailableStores('kingsoopers');

      expect(service.loadingAvailable()).toBe(true);

      const req = httpCtrl.expectOne(`${API}/stores/kingsoopers`);
      req.flush({ stores });

      expect(service.getAvailableStores()).toEqual(stores);
      expect(service.loadingAvailable()).toBe(false);
      httpCtrl.verify();
    });

    it('should set error on failure', () => {
      service.loadAvailableStores('kingsoopers');

      const req = httpCtrl.expectOne(`${API}/stores/kingsoopers`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.error()).toBeTruthy();
      expect(service.loadingAvailable()).toBe(false);
      httpCtrl.verify();
    });
  });

  describe('clearAvailableStores', () => {
    beforeEach(() => {
      setup();
      flushInitialRequest();
    });

    it('should clear available stores', () => {
      service.clearAvailableStores();
      expect(service.getAvailableStores()).toEqual([]);
    });
  });

  describe('computed signals', () => {
    beforeEach(() => setup());

    it('getStoresGroupedByType should group stores by storeType', () => {
      const stores = [
        makeUserStore({ instanceId: 'kingsoopers:a', storeType: 'kingsoopers' }),
        makeUserStore({ instanceId: 'safeway:b', storeType: 'safeway', name: 'Safeway #1' }),
        makeUserStore({ instanceId: 'kingsoopers:c', storeType: 'kingsoopers', name: 'KS #2' }),
      ];
      flushInitialRequest(stores);

      const grouped = service.getStoresGroupedByType();
      expect(grouped.get('kingsoopers')?.length).toBe(2);
      expect(grouped.get('safeway')?.length).toBe(1);
      httpCtrl.verify();
    });

    it('getUserStoreTypes should return a Set of store types', () => {
      const stores = [
        makeUserStore({ storeType: 'kingsoopers' }),
        makeUserStore({ instanceId: 'safeway:b', storeType: 'safeway', name: 'Safeway #1' }),
      ];
      flushInitialRequest(stores);

      const types = service.getUserStoreTypes();
      expect(types.has('kingsoopers')).toBe(true);
      expect(types.has('safeway')).toBe(true);
      expect(types.has('sprouts')).toBe(false);
      httpCtrl.verify();
    });

    it('getAvailableStoreTypeOptions should mark user types as disabled', () => {
      const stores = [makeUserStore({ storeType: 'kingsoopers' })];
      flushInitialRequest(stores);

      const options = service.getAvailableStoreTypeOptions();
      const ks = options.find(o => o.value === 'kingsoopers');
      const safeway = options.find(o => o.value === 'safeway');

      expect(ks?.disabled).toBe(true);
      expect(safeway?.disabled).toBe(false);
      httpCtrl.verify();
    });
  });
});
