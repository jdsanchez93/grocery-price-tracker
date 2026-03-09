import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Dashboard } from './dashboard';
import { DealsService } from '@/app/core/services/deals.service';
import { StoresService } from '@/app/core/services/stores.service';

describe('Dashboard', () => {
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
            getUserStores: signal([]).asReadonly(),
          },
        },
      ],
    });
    return TestBed.createComponent(Dashboard);
  }

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all three widgets', () => {
    const fixture = setup();
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('app-stats-widget')).toBeTruthy();
    expect(el.querySelector('app-stores-widget')).toBeTruthy();
    expect(el.querySelector('app-department-widget')).toBeTruthy();
  });

  it('should use a 12-column grid layout', () => {
    const fixture = setup();
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.classList).toContain('grid-cols-12');
  });
});
