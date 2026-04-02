import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { makeDeal } from '../models/test-utils';

const API = '/api';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpCtrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => httpCtrl.verify());

  describe('getProductHistory', () => {
    it('should GET /me/products/:id/history', () => {
      service.getProductHistory('chicken-breast').subscribe();
      const req = httpCtrl.expectOne(`${API}/me/products/chicken-breast/history`);
      expect(req.request.method).toBe('GET');
      req.flush({ productId: 'chicken-breast', history: [], count: 0 });
    });

    it('should URL-encode product IDs with special characters', () => {
      service.getProductHistory('orange/juice').subscribe();
      const req = httpCtrl.expectOne(`${API}/me/products/orange%2Fjuice/history`);
      req.flush({ productId: 'orange/juice', history: [], count: 0 });
    });

    it('should return the response as-is', () => {
      const deal = makeDeal({ canonicalProductId: 'chicken-breast' });
      const mockResponse = { productId: 'chicken-breast', history: [deal], count: 1 };

      let result: typeof mockResponse | undefined;
      service.getProductHistory('chicken-breast').subscribe(r => (result = r));

      httpCtrl.expectOne(`${API}/me/products/chicken-breast/history`).flush(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate HTTP errors to the subscriber', () => {
      let error: unknown;
      service.getProductHistory('chicken-breast').subscribe({ error: e => (error = e) });

      httpCtrl
        .expectOne(`${API}/me/products/chicken-breast/history`)
        .flush('Forbidden', { status: 403, statusText: 'Forbidden' });

      expect(error).toBeTruthy();
    });
  });
});
