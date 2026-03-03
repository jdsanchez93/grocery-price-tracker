import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';

import { ScrapeManagement } from './scrape-management';
import { StoresService } from '../../core/services/stores.service';
import { DealsService } from '../../core/services/deals.service';
import { UserStore } from '../../core/models/store.model';
import { Deal } from '../../core/models/deal.model';

const mockStores: UserStore[] = [
  { instanceId: 'kingsoopers:abc123', name: 'King Soopers #1', storeType: 'kingsoopers', chain: 'kroger', addedAt: '2026-01-01' },
  { instanceId: 'safeway:def456', name: 'Safeway #2', storeType: 'safeway', chain: 'albertsons', addedAt: '2026-01-02' },
];

const mockDeals: Deal[] = [
  { dealId: 'd1', storeInstanceId: 'kingsoopers:abc123', weekId: '2026-W04', name: 'Apples', details: '$1/lb', dept: 'Produce', priceDisplay: '$1.00', priceNumber: 1, quantity: 1, loyalty: undefined, image: undefined },
];

describe('ScrapeManagement', () => {
  let component: ScrapeManagement;
  let fixture: ComponentFixture<ScrapeManagement>;
  let httpTesting: HttpTestingController;
  let messageService: MessageService;
  let userStoresSignal: WritableSignal<UserStore[]>;
  let dealsSignal: WritableSignal<Deal[]>;

  beforeEach(async () => {
    userStoresSignal = signal<UserStore[]>([]);
    dealsSignal = signal<Deal[]>([]);

    await TestBed.configureTestingModule({
      imports: [ScrapeManagement],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: StoresService,
          useValue: { getUserStores: userStoresSignal.asReadonly() },
        },
        {
          provide: DealsService,
          useValue: { getDeals: dealsSignal.asReadonly() },
        },
      ],
    })
    .overrideComponent(ScrapeManagement, {
      set: { providers: [MessageService] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScrapeManagement);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    messageService = fixture.debugElement.injector.get(MessageService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display store cards', () => {
    userStoresSignal.set(mockStores);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('p-card');
    expect(cards.length).toBe(2);
  });

  it('should display store name and instanceId', () => {
    userStoresSignal.set([mockStores[0]]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('King Soopers #1');
    expect(text).toContain('kingsoopers:abc123');
  });

  it('should show "Scrape" button when store has not been scraped', () => {
    userStoresSignal.set([mockStores[1]]);
    dealsSignal.set([]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('p-button');
    expect(button.getAttribute('label')).toBe('Scrape');
  });

  it('should show "Force Re-scrape" button when store has already been scraped', () => {
    userStoresSignal.set([mockStores[0]]);
    dealsSignal.set(mockDeals);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('p-button');
    expect(button.getAttribute('label')).toBe('Force Re-scrape');
  });

  it('should compute alreadyScraped from deals', () => {
    dealsSignal.set(mockDeals);
    const scraped = component.alreadyScraped();
    expect(scraped.has('kingsoopers:abc123')).toBe(true);
    expect(scraped.has('safeway:def456')).toBe(false);
  });

  it('should add instanceId to loading set when scrapeStore is called', () => {
    component.scrapeStore('kingsoopers:abc123');

    expect(component.loading().has('kingsoopers:abc123')).toBe(true);

    httpTesting.expectOne(() => true).flush({});
  });

  it('should remove instanceId from loading set on success', () => {
    vi.spyOn(messageService, 'add');
    component.scrapeStore('kingsoopers:abc123');

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush({});

    expect(component.loading().has('kingsoopers:abc123')).toBe(false);
  });

  it('should show success toast on successful scrape', () => {
    vi.spyOn(messageService, 'add');
    component.scrapeStore('kingsoopers:abc123');

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush({});

    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Success' })
    );
  });

  it('should show error toast on failed scrape', () => {
    vi.spyOn(messageService, 'add');
    component.scrapeStore('kingsoopers:abc123');

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(component.loading().has('kingsoopers:abc123')).toBe(false);
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', summary: 'Error' })
    );
  });

  it('should set error signal on failed scrape', () => {
    component.scrapeStore('kingsoopers:abc123');

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    req.flush('fail', { status: 500, statusText: 'Internal Server Error' });

    expect(component.error()).toBeTruthy();
  });

  it('should pass force=true when scraping with force', () => {
    component.scrapeStore('kingsoopers:abc123', true);

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    expect(req.request.params.get('force')).toBe('true');
    req.flush({});
  });

  it('should pass force=false by default', () => {
    component.scrapeStore('kingsoopers:abc123');

    const req = httpTesting.expectOne(r => r.url.includes('/admin/scrape/auto'));
    expect(req.request.params.get('force')).toBe('false');
    req.flush({});
  });

  it('should return correct store type name', () => {
    expect(component.getStoreTypeName('kingsoopers')).toBe('King Soopers');
    expect(component.getStoreTypeName('safeway')).toBe('Safeway');
    expect(component.getStoreTypeName('sprouts')).toBe('Sprouts');
  });

  it('should display store type heading', () => {
    userStoresSignal.set([mockStores[0]]);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h3');
    expect(heading.textContent).toContain('King Soopers');
  });

  it('should display chain tag', () => {
    userStoresSignal.set([mockStores[0]]);
    fixture.detectChanges();

    const tag = fixture.nativeElement.querySelector('p-tag');
    expect(tag).toBeTruthy();
    expect(tag.textContent).toContain('kroger');
  });
});
