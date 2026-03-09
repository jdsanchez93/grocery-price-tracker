import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DepartmentWidget } from './department-widget';
import { DealsService } from '@/app/core/services/deals.service';
import { makeDeal } from '@/app/core/models/deal.model.spec';
import { Deal } from '@/app/core/models/deal.model';

describe('DepartmentWidget', () => {
  const deals = signal<Deal[]>([]);

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DealsService,
          useValue: { deals: deals.asReadonly() },
        },
      ],
    });
    return TestBed.createComponent(DepartmentWidget);
  }

  beforeEach(() => {
    deals.set([]);
  });

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should return empty array when no deals', () => {
    const fixture = setup();
    expect(fixture.componentInstance.topDepartments()).toEqual([]);
  });

  it('should show empty state when no deals', () => {
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No deals loaded yet');
  });

  it('should group deals by department and sort by count descending', () => {
    deals.set([
      makeDeal({ dealId: '1', dept: 'Bakery' }),
      makeDeal({ dealId: '2', dept: 'Produce' }),
      makeDeal({ dealId: '3', dept: 'Produce' }),
      makeDeal({ dealId: '4', dept: 'Produce' }),
      makeDeal({ dealId: '5', dept: 'Bakery' }),
    ]);
    const fixture = setup();
    const depts = fixture.componentInstance.topDepartments();
    expect(depts[0].name).toBe('Produce');
    expect(depts[0].count).toBe(3);
    expect(depts[1].name).toBe('Bakery');
    expect(depts[1].count).toBe(2);
  });

  it('should limit to top 8 departments', () => {
    const deptNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    deals.set(deptNames.map((dept, i) => makeDeal({ dealId: `${i}`, dept })));
    const fixture = setup();
    expect(fixture.componentInstance.topDepartments().length).toBe(8);
  });

  it('should calculate percentage relative to the max count', () => {
    deals.set([
      makeDeal({ dealId: '1', dept: 'Produce' }),
      makeDeal({ dealId: '2', dept: 'Produce' }),
      makeDeal({ dealId: '3', dept: 'Produce' }),
      makeDeal({ dealId: '4', dept: 'Produce' }),
      makeDeal({ dealId: '5', dept: 'Bakery' }),
      makeDeal({ dealId: '6', dept: 'Bakery' }),
    ]);
    const fixture = setup();
    const depts = fixture.componentInstance.topDepartments();
    expect(depts[0].percentage).toBe(100); // Produce: 4/4 = 100%
    expect(depts[1].percentage).toBe(50);  // Bakery: 2/4 = 50%
  });

  it('should render department names and counts in the DOM', () => {
    deals.set([
      makeDeal({ dealId: '1', dept: 'Produce' }),
      makeDeal({ dealId: '2', dept: 'Produce' }),
      makeDeal({ dealId: '3', dept: 'Bakery' }),
    ]);
    const fixture = setup();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Produce');
    expect(text).toContain('Bakery');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });

  it('should render list items for each department', () => {
    deals.set([
      makeDeal({ dealId: '1', dept: 'Produce' }),
      makeDeal({ dealId: '2', dept: 'Bakery' }),
      makeDeal({ dealId: '3', dept: 'Deli' }),
    ]);
    const fixture = setup();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(3);
  });
});
