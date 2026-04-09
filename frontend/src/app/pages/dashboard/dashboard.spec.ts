import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { DealsService } from '@/app/core/services/deals.service';
import { StoresService } from '@/app/core/services/stores.service';
import { UserStore } from '@/app/core/models/store.model';

function makeUserStore(overrides: Partial<UserStore> = {}): UserStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'Test Store',
    storeType: 'kingsoopers',
    chain: 'kroger',
    addedAt: '2026-01-01',
    ...overrides,
  };
}

describe('Dashboard', () => {
  const userStores = signal<UserStore[]>([]);
  const loading = signal(false);

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: DealsService,
          useValue: {
            deals: signal([]).asReadonly(),
            departments: signal([]).asReadonly(),
          },
        },
        {
          provide: StoresService,
          useValue: {
            getUserStores: userStores.asReadonly(),
            loading: loading.asReadonly(),
          },
        },
      ],
    });
    return TestBed.createComponent(Dashboard);
  }

  beforeEach(() => {
    userStores.set([]);
    loading.set(false);
  });

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all three widgets when stores exist', () => {
    userStores.set([makeUserStore()]);
    const fixture = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('app-stats-widget')).toBeTruthy();
    expect(el.querySelector('app-stores-widget')).toBeTruthy();
    expect(el.querySelector('app-department-widget')).toBeTruthy();
  });

  it('should use a 12-column grid layout when stores exist', () => {
    userStores.set([makeUserStore()]);
    const fixture = setup();
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.classList).toContain('grid-cols-12');
  });

  it('should show get-started card when no stores and not loading', () => {
    const fixture = setup();
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.get-started-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toContain('No stores added yet');
  });

  it('should not show get-started card while loading', () => {
    loading.set(true);
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.get-started-card')).toBeFalsy();
  });

  it('should not show widgets when no stores', () => {
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-stats-widget')).toBeFalsy();
  });
});
