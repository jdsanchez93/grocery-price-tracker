import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
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
});
