import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DealsService } from './deals.service';
import { makeDeal } from '../models/test-utils';
import { DealRating } from '../models/deal.model';

function makeRating(overrides: Partial<DealRating> = {}): DealRating {
  return {
    label: 'good',
    percentVsAvg: -15,
    historicalAvg: 2.99,
    historicalMin: 1.99,
    sampleSize: 5,
    ...overrides,
  };
}

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

  describe('topDeals', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    function flushDeals(deals: unknown[]) {
      service.loadDeals();
      httpCtrl.expectOne(`${API}/me/deals`).flush(makeCurrentResponse({ deals, count: deals.length }));
    }

    it('should exclude unrated deals', () => {
      flushDeals([makeDeal({ dealId: '1' })]);
      expect(service.topDeals()).toEqual([]);
    });

    it('should exclude typical and high rated deals', () => {
      flushDeals([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'typical' }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'high' }) }),
      ]);
      expect(service.topDeals()).toEqual([]);
    });

    it('should include best and good rated deals', () => {
      flushDeals([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'best' }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'good' }) }),
      ]);
      expect(service.topDeals().length).toBe(2);
    });

    it('should sort best before good', () => {
      flushDeals([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good', percentVsAvg: -20 }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'best', percentVsAvg: -5 }) }),
      ]);
      expect(service.topDeals().map(d => d.dealId)).toEqual(['2', '1']);
    });

    it('should sort by percentVsAvg ascending within the same label', () => {
      flushDeals([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good', percentVsAvg: -10 }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'good', percentVsAvg: -25 }) }),
        makeDeal({ dealId: '3', rating: makeRating({ label: 'good', percentVsAvg: -15 }) }),
      ]);
      expect(service.topDeals().map(d => d.dealId)).toEqual(['2', '3', '1']);
    });

    it('should break ties deterministically by dealId', () => {
      flushDeals([
        makeDeal({ dealId: 'b', rating: makeRating({ label: 'good', percentVsAvg: -10 }) }),
        makeDeal({ dealId: 'a', rating: makeRating({ label: 'good', percentVsAvg: -10 }) }),
      ]);
      expect(service.topDeals().map(d => d.dealId)).toEqual(['a', 'b']);
    });

    it('should not mutate the order of the deals signal', () => {
      flushDeals([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good' }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'best' }) }),
      ]);
      service.topDeals();
      expect(service.deals().map(d => d.dealId)).toEqual(['1', '2']);
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
