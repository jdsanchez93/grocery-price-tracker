import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ScrapeManagement } from './scrape-management';
import { AdminService } from '@/app/core/services/admin.service';
import { AvailableStore } from '@/app/core/models/store.model';
import { AutoScrapeResponse, ScrapeStatusResponse } from '@/app/core/models/admin.model';

const mockStores: AvailableStore[] = [
  { instanceId: 'kingsoopers:123', name: 'King Soopers #123', storeType: 'kingsoopers', identifiers: {}, enabled: true },
  { instanceId: 'safeway:456', name: 'Safeway #456', storeType: 'safeway', identifiers: {}, enabled: true },
];

const mockStatus: ScrapeStatusResponse = {
  'kingsoopers:123': { scraped: true, dealCount: 42, circularId: 'abc' },
  'safeway:456': { scraped: false },
};

const mockScrapeResponse: AutoScrapeResponse = {
  success: true,
  alreadyScraped: false,
  forced: false,
  weekId: '2026-W10',
  circularId: 'new-circ',
  storeInstanceId: 'safeway:456',
  dealCount: 15,
  persisted: 15,
  dates: { startDate: '2026-03-04', endDate: '2026-03-10' },
};

describe('ScrapeManagement', () => {
  let component: ScrapeManagement;
  let fixture: ComponentFixture<ScrapeManagement>;
  let adminServiceMock: Record<string, ReturnType<typeof vi.fn>>;
  let messageServiceMock: Partial<MessageService>;

  beforeEach(async () => {
    adminServiceMock = {
      getAllStores: vi.fn().mockReturnValue(of(mockStores)),
      getScrapeStatus: vi.fn().mockReturnValue(of(mockStatus)),
      autoScrapeStore: vi.fn().mockReturnValue(of(mockScrapeResponse)),
    };

    messageServiceMock = {
      add: vi.fn(),
      messageObserver: new Subject(),
      clearObserver: new Subject(),
    };

    await TestBed.configureTestingModule({
      imports: [ScrapeManagement],
      providers: [
        { provide: AdminService, useValue: adminServiceMock },
      ],
    })
    .overrideComponent(ScrapeManagement, {
      set: { providers: [{ provide: MessageService, useValue: messageServiceMock }] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScrapeManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load stores and scrape status on init', () => {
    expect(component.allStores()).toEqual(mockStores);
    expect(component.scrapeStatus()).toEqual(mockStatus);
    expect(component.loading()).toBe(false);
  });

  it('should show skeletons while loading', async () => {
    const stores$ = new Subject<AvailableStore[]>();
    adminServiceMock['getAllStores'].mockReturnValue(stores$);

    // Re-create so ngOnInit uses the pending Subject
    fixture = TestBed.createComponent(ScrapeManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('p-skeleton')).toBeTruthy();
    expect(el.querySelector('app-store-card')).toBeNull();

    stores$.next(mockStores);
    stores$.complete();
    // getScrapeStatus is already mocked to return of(mockStatus)
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(el.querySelector('p-skeleton')).toBeNull();
    expect(el.querySelectorAll('app-store-card').length).toBe(2);
  });

  describe('scrapeLabel', () => {
    it('should return "Scrape" for an unscraped store', () => {
      expect(component.scrapeLabel('safeway:456')).toBe('Scrape');
    });

    it('should return "Force Re-scrape" for a scraped store', () => {
      expect(component.scrapeLabel('kingsoopers:123')).toBe('Force Re-scrape');
    });

    it('should return "Scrape" for an unknown instanceId', () => {
      expect(component.scrapeLabel('unknown:999')).toBe('Scrape');
    });
  });

  describe('storeStats', () => {
    it('should return "Not scraped" placeholder for an unscraped store', () => {
      expect(component.storeStats('safeway:456')).toEqual([
        { label: 'Deals this week', value: 'Not scraped' },
      ]);
    });

    it('should return deal count stat for a scraped store', () => {
      expect(component.storeStats('kingsoopers:123')).toEqual([
        { label: 'Deals this week', value: 42 },
      ]);
    });

    it('should return "Not scraped" placeholder for an unknown instanceId', () => {
      expect(component.storeStats('unknown:999')).toEqual([
        { label: 'Deals this week', value: 'Not scraped' },
      ]);
    });

    it('should reflect updated deal count after scraping', () => {
      component.scrapeStore('safeway:456');
      expect(component.storeStats('safeway:456')).toEqual([
        { label: 'Deals this week', value: 15 },
      ]);
    });
  });

  describe('scrapeSeverity', () => {
    it('should return "primary" for an unscraped store', () => {
      expect(component.scrapeSeverity('safeway:456')).toBe('primary');
    });

    it('should return "warn" for a scraped store', () => {
      expect(component.scrapeSeverity('kingsoopers:123')).toBe('warn');
    });
  });

  describe('scrapeStore', () => {
    it('should update scrapeStatus signal on success', () => {
      component.scrapeStore('safeway:456');

      expect(component.scrapeStatus()['safeway:456']).toEqual({
        scraped: true,
        dealCount: 15,
        circularId: 'new-circ',
      });
    });

    it('should add to and remove from scrapingInProgress', () => {
      // Capture intermediate state via the mock
      let capturedInProgress = false;
      adminServiceMock['autoScrapeStore'].mockImplementation(() => {
        capturedInProgress = component.scrapingInProgress().has('safeway:456');
        return of(mockScrapeResponse);
      });

      component.scrapeStore('safeway:456');

      expect(capturedInProgress).toBe(true);
      expect(component.scrapingInProgress().has('safeway:456')).toBe(false);
    });

    it('should show success toast via MessageService', () => {
      component.scrapeStore('safeway:456');

      expect(messageServiceMock['add']).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Success',
        detail: 'safeway:456 has been scraped successfully.',
      });
    });

    it('should show error toast on failure', () => {
      adminServiceMock['autoScrapeStore'].mockReturnValue(
        throwError(() => new Error('Network failure'))
      );

      component.scrapeStore('safeway:456');

      expect(messageServiceMock['add']).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Scraping error',
        detail: 'Network failure',
      });
      expect(component.scrapingInProgress().has('safeway:456')).toBe(false);
    });
  });
});
