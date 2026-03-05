import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DealsService } from './deals.service';
import { makeDeal } from '../models/deal.model.spec';

const API = '/api';

function makeDealResponse(overrides: Record<string, unknown> = {}) {
  return {
    weekId: '2026-W04',
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

  /** Flush the constructor's GET /me/week → GET /me/deals chain. */
  function flushInitialRequests(weekId = '2026-W04') {
    const weekReq = httpCtrl.expectOne(`${API}/me/week`);
    weekReq.flush({ weekId });

    const dealsReq = httpCtrl.expectOne(`${API}/me/deals?week=${weekId}`);
    dealsReq.flush(makeDealResponse({ weekId }));
  }

  describe('constructor', () => {
    beforeEach(() => setup());

    it('should fetch /me/week then /me/deals with the weekId', () => {
      const weekReq = httpCtrl.expectOne(`${API}/me/week`);
      expect(weekReq.request.method).toBe('GET');
      weekReq.flush({ weekId: '2026-W04' });

      const dealsReq = httpCtrl.expectOne(`${API}/me/deals?week=2026-W04`);
      expect(dealsReq.request.method).toBe('GET');
      dealsReq.flush(makeDealResponse());

      expect(service.currentWeekId()).toBe('2026-W04');
      expect(service.selectedWeekId()).toBe('2026-W04');
      expect(service.deals().length).toBe(1);
      httpCtrl.verify();
    });

    it('should set loading states during initial fetch', () => {
      // Constructor fires /me/week but loading starts false until loadDeals is called
      expect(service.loading()).toBe(false);

      const weekReq = httpCtrl.expectOne(`${API}/me/week`);
      weekReq.flush({ weekId: '2026-W04' });

      // After week resolves, loadDeals is called — now loading
      expect(service.loading()).toBe(true);

      const dealsReq = httpCtrl.expectOne(`${API}/me/deals?week=2026-W04`);
      dealsReq.flush(makeDealResponse());

      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should fall back to loadDeals without weekId when /me/week errors', () => {
      const weekReq = httpCtrl.expectOne(`${API}/me/week`);
      weekReq.error(new ProgressEvent('Network error'));

      const dealsReq = httpCtrl.expectOne(`${API}/me/deals`);
      dealsReq.flush(makeDealResponse());

      expect(service.deals().length).toBe(1);
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
      req.flush(makeDealResponse({ weekId: '2026-W05' }));
      expect(service.loading()).toBe(false);
      httpCtrl.verify();
    });

    it('should append week query param when provided', () => {
      service.loadDeals('2026-W05');
      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`);
      req.flush(makeDealResponse({ weekId: '2026-W05' }));
      httpCtrl.verify();
    });

    it('should not append week query param when not provided', () => {
      service.loadDeals();
      const req = httpCtrl.expectOne(`${API}/me/deals`);
      req.flush(makeDealResponse());
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

    it('should not overwrite existing weekIds', () => {
      expect(service.currentWeekId()).toBe('2026-W04');
      expect(service.selectedWeekId()).toBe('2026-W04');

      service.loadDeals('2026-W05');
      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`);
      req.flush(makeDealResponse({ weekId: '2026-W05' }));

      expect(service.currentWeekId()).toBe('2026-W04');
      expect(service.selectedWeekId()).toBe('2026-W04');
      httpCtrl.verify();
    });
  });

  describe('selectWeek', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    it('should set selectedWeekId and trigger loadDeals', () => {
      service.selectWeek('2026-W05');
      expect(service.selectedWeekId()).toBe('2026-W05');

      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W05`);
      req.flush(makeDealResponse({ weekId: '2026-W05' }));
      httpCtrl.verify();
    });
  });

  describe('selectCurrentWeek', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    it('should reset to current week', () => {
      service.selectWeek('2026-W01');
      httpCtrl.expectOne(`${API}/me/deals?week=2026-W01`)
        .flush(makeDealResponse({ weekId: '2026-W01' }));

      service.selectCurrentWeek();
      expect(service.selectedWeekId()).toBe('2026-W04');

      const req = httpCtrl.expectOne(`${API}/me/deals?week=2026-W04`);
      req.flush(makeDealResponse());
      httpCtrl.verify();
    });
  });

  describe('selectCurrentWeek when currentWeekId is null', () => {
    beforeEach(() => setup());

    it('should no-op when currentWeekId is null', () => {
      // Fail /me/week
      httpCtrl.expectOne(`${API}/me/week`).error(new ProgressEvent('error'));
      // Fail /me/deals too so currentWeekId stays null
      httpCtrl.expectOne(`${API}/me/deals`).flush('Error', { status: 500, statusText: 'Error' });

      expect(service.currentWeekId()).toBeNull();
      service.selectCurrentWeek(); // should not throw or make HTTP calls
      httpCtrl.verify();
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      setup();
      flushInitialRequests();
    });

    it('isCurrentWeek should be true when current equals selected', () => {
      expect(service.isCurrentWeek()).toBe(true);
    });

    it('isCurrentWeek should be false when different week is selected', () => {
      service.selectWeek('2026-W01');
      httpCtrl.expectOne(`${API}/me/deals?week=2026-W01`)
        .flush(makeDealResponse({ weekId: '2026-W01' }));

      expect(service.isCurrentWeek()).toBe(false);
      httpCtrl.verify();
    });

    it('storeInstanceIds should deduplicate', () => {
      service.loadDeals();
      const req = httpCtrl.expectOne(`${API}/me/deals`);
      req.flush({
        weekId: '2026-W04',
        deals: [
          makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:a' }),
          makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:a' }),
          makeDeal({ dealId: '3', storeInstanceId: 'safeway:b' }),
        ],
        count: 3,
      });

      expect(service.storeInstanceIds()).toEqual(['kingsoopers:a', 'safeway:b']);
      httpCtrl.verify();
    });

    it('departments should be sorted and unique', () => {
      service.loadDeals();
      const req = httpCtrl.expectOne(`${API}/me/deals`);
      req.flush({
        weekId: '2026-W04',
        deals: [
          makeDeal({ dealId: '1', dept: 'Produce' }),
          makeDeal({ dealId: '2', dept: 'Bakery' }),
          makeDeal({ dealId: '3', dept: 'Produce' }),
        ],
        count: 3,
      });

      expect(service.departments()).toEqual(['Bakery', 'Produce']);
      httpCtrl.verify();
    });

    it('storeOptions should map ids to display names', () => {
      const opts = service.storeOptions();
      expect(opts.length).toBeGreaterThan(0);
      expect(opts[0]).toHaveProperty('value');
      expect(opts[0]).toHaveProperty('label');
    });

    it('departmentOptions should map departments to value/label pairs', () => {
      const opts = service.departmentOptions();
      expect(opts.length).toBeGreaterThan(0);
      expect(opts[0].value).toBe(opts[0].label);
    });
  });
});
