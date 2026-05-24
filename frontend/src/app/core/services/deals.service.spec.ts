import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DealsService } from './deals.service';
import { makeDeal } from '../models/test-utils';

const API = '/api';

function makeCurrentResponse(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'current',
    circulars: [
      { storeInstanceId: 'kingsoopers:abc', weekId: '2026-W04', startDate: '2026-01-21', endDate: '2026-01-27', dealCount: 1 },
    ],
    deals: [makeDeal()],
    count: 1,
    ...overrides,
  };
}

describe('DealsService', () => {
  let service: DealsService;
  let httpCtrl: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpCtrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DealsService);
  }

  /** Flush the constructor's GET /me/deals (current mode, no week param). */
  function flushInitialRequests() {
    const dealsReq = httpCtrl.expectOne(`${API}/me/deals`);
    dealsReq.flush(makeCurrentResponse());
  }

  describe('constructor', () => {
    beforeEach(() => setup());

    it('should fetch /me/deals with no week param and populate deals', () => {
      const dealsReq = httpCtrl.expectOne(`${API}/me/deals`);
      expect(dealsReq.request.method).toBe('GET');
      dealsReq.flush(makeCurrentResponse());

      expect(service.deals().length).toBe(1);
      httpCtrl.verify();
    });

    it('should not call the removed /me/week endpoint', () => {
      httpCtrl.expectNone(`${API}/me/week`);
      httpCtrl.expectOne(`${API}/me/deals`).flush(makeCurrentResponse());
      httpCtrl.verify();
    });

    it('should toggle loading around the initial fetch', () => {
      // loadDeals is called synchronously in the constructor → loading true until flush
      expect(service.loading()).toBe(true);

      httpCtrl.expectOne(`${API}/me/deals`).flush(makeCurrentResponse());

      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });
  });

  describe('loadDeals', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    it('should set loading and clear error', () => {
      service.loadDeals('2026-W05');
      expect(service.loading()).toBe(true);
      expect(service.error()).toBeNull();

      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`);
      req.flush({ mode: 'historical', weekId: '2026-W05', deals: [makeDeal()], count: 1 });
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should append week query param when provided', () => {
      service.loadDeals('2026-W05');
      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`);
      req.flush({ mode: 'historical', weekId: '2026-W05', deals: [], count: 0 });
      httpCtrl.verify();
    });

    it('should not append week query param when not provided', () => {
      service.loadDeals();
      const req = httpCtrl.expectOne(`${API}/me/deals`);
      req.flush(makeCurrentResponse());
      httpCtrl.verify();
    });

    it('should set specific error message on 403', () => {
      service.loadDeals('2026-W01');
      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W01`);
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(service.error()).toBe('Upgrade your plan to browse historical weeks');
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should set generic error message on other errors', () => {
      service.loadDeals('2026-W01');
      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W01`);
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

      expect(service.error()).toBeTruthy();
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should replace the deals signal with the latest response', () => {
      service.loadDeals('2026-W05');
      httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`)
        .flush({ mode: 'historical', weekId: '2026-W05', deals: [makeDeal({ dealId: 'x' })], count: 1 });

      expect(service.deals().map(d => d.dealId)).toEqual(['x']);
      httpCtrl.verify();
    });
  });

  describe('departments', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    it('should be sorted and unique', () => {
      service.loadDeals();
      const req = httpCtrl.expectOne(`${API}/me/deals`);
      req.flush(makeCurrentResponse({
        deals: [
          makeDeal({ dealId: '1', dept: 'Produce' }),
          makeDeal({ dealId: '2', dept: 'Bakery' }),
          makeDeal({ dealId: '3', dept: 'Produce' }),
        ],
        count: 3,
      }));

      expect(service.departments()).toEqual(['Bakery', 'Produce']);
      httpCtrl.verify();
    });
  });
});
