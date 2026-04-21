import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DealsTable, DealColumnConfig } from './deals-table';
import { Deal } from '../../../core/models/deal.model';
import { makeDeal } from '../../../core/models/test-utils';
import { Table } from 'primeng/table';

const TEST_COLUMNS: DealColumnConfig[] = [
  { field: 'store', header: 'Store', sortable: true, filterType: 'multiselect', filterField: 'storeInstanceId' },
  { field: 'name', header: 'Name', sortable: true, filterType: 'text' },
  { field: 'dept', header: 'Department', sortable: true },
  { field: 'priceDisplay', header: 'Price', sortable: true },
  { field: 'loyalty', header: 'Loyalty' },
];

const TEST_DEALS: Deal[] = [
  makeDeal({ dealId: 'd1', storeInstanceId: 'kingsoopers:a', dept: 'Produce', name: 'Apples' }),
  makeDeal({
    dealId: 'd2',
    storeInstanceId: 'safeway:b',
    dept: 'Bakery',
    name: 'Bread',
    priceVariants: [{ price: 2.99, example: 'Wheat Bread' }],
  }),
  makeDeal({
    dealId: 'd3',
    storeInstanceId: 'sprouts:c',
    dept: 'Produce',
    name: 'Bananas',
    priceVariants: [
      { price: 0.69, example: 'Organic Bananas', perLb: 0.69, avgWeight: 2.5 },
    ],
  }),
];

describe('DealsTable', () => {
  let component: DealsTable;
  let fixture: ComponentFixture<DealsTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DealsTable],
    }).compileComponents();

    fixture = TestBed.createComponent(DealsTable);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('deals', TEST_DEALS);
    fixture.componentRef.setInput('columns', TEST_COLUMNS);
    fixture.detectChanges();
  });

  describe('defaults', () => {
    it('should have loading=false by default', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have rows=20 by default', () => {
      expect(component.rows()).toBe(20);
    });

    it('should have rowsPerPageOptions=[10,20,50] by default', () => {
      expect(component.rowsPerPageOptions()).toEqual([10, 20, 50]);
    });

    it('should have dataKey=dealId by default', () => {
      expect(component.dataKey()).toBe('dealId');
    });
  });

  describe('computed signals', () => {
    it('globalFilterFields should exclude image and map store to storeInstanceId', () => {
      const fields = component.globalFilterFields();
      expect(fields).not.toContain('image');
      expect(fields).toContain('storeInstanceId');
      expect(fields).toContain('name');
      expect(fields).toContain('dept');
    });

    it('hasExpandableRows should be true when deals have priceVariants', () => {
      expect(component.hasExpandableRows()).toBe(true);
    });

    it('hasExpandableRows should be false when no deals have priceVariants', () => {
      fixture.componentRef.setInput('deals', [makeDeal({ dealId: 'd1' })]);
      fixture.detectChanges();
      expect(component.hasExpandableRows()).toBe(false);
    });

    it('hasExpandableRows should be false with empty deals', () => {
      fixture.componentRef.setInput('deals', []);
      fixture.detectChanges();
      expect(component.hasExpandableRows()).toBe(false);
    });

    it('expandedColspan should include extra column when expandable rows exist', () => {
      expect(component.expandedColspan()).toBe(TEST_COLUMNS.length + 1);
    });

    it('expandedColspan should equal columns length when no expandable rows', () => {
      fixture.componentRef.setInput('deals', [makeDeal({ dealId: 'd1' })]);
      fixture.detectChanges();
      expect(component.expandedColspan()).toBe(TEST_COLUMNS.length);
    });
  });

  describe('expandAll / collapseAll', () => {
    it('should only expand deals with non-empty priceVariants', () => {
      component.expandAll();
      const expanded = component.expandedRows();
      expect(expanded['d1']).toBeUndefined();
      expect(expanded['d2']).toBe(true);
      expect(expanded['d3']).toBe(true);
    });

    it('collapseAll should clear all expanded rows', () => {
      component.expandAll();
      expect(Object.keys(component.expandedRows()).length).toBeGreaterThan(0);

      component.collapseAll();
      expect(Object.keys(component.expandedRows()).length).toBe(0);
    });
  });

  describe('getStoreSeverity', () => {
    it('should return info for kingsoopers', () => {
      expect(component.getStoreSeverity('kingsoopers:a')).toBe('info');
    });

    it('should return danger for safeway', () => {
      expect(component.getStoreSeverity('safeway:b')).toBe('danger');
    });

    it('should return success for sprouts', () => {
      expect(component.getStoreSeverity('sprouts:c')).toBe('success');
    });

    it('should return secondary for unknown stores', () => {
      expect(component.getStoreSeverity('walmart:x')).toBe('secondary');
    });
  });

  describe('getFieldValue', () => {
    it('should return string field values', () => {
      const deal = makeDeal({ dept: 'Produce' });
      expect(component.getFieldValue(deal, 'dept')).toBe('Produce');
    });

    it('should return empty string for undefined fields', () => {
      const deal = makeDeal({ loyalty: undefined });
      expect(component.getFieldValue(deal, 'loyalty')).toBe('');
    });

    it('should return stringified numeric values', () => {
      const deal = makeDeal({ quantity: 5 });
      expect(component.getFieldValue(deal, 'quantity')).toBe('5');
    });
  });

  describe('hasPerLb', () => {
    it('should return true when a variant has perLb', () => {
      const deal = makeDeal({ priceVariants: [{ price: 1, example: 'x', perLb: 0.5 }] });
      expect(component.hasPerLb(deal)).toBe(true);
    });

    it('should return false when no variant has perLb', () => {
      const deal = makeDeal({ priceVariants: [{ price: 1, example: 'x' }] });
      expect(component.hasPerLb(deal)).toBe(false);
    });

    it('should return false when no priceVariants', () => {
      const deal = makeDeal();
      expect(component.hasPerLb(deal)).toBe(false);
    });
  });

  describe('hasAvgWeight', () => {
    it('should return true when a variant has avgWeight', () => {
      const deal = makeDeal({ priceVariants: [{ price: 1, example: 'x', avgWeight: 2 }] });
      expect(component.hasAvgWeight(deal)).toBe(true);
    });

    it('should return false when no variant has avgWeight', () => {
      const deal = makeDeal({ priceVariants: [{ price: 1, example: 'x' }] });
      expect(component.hasAvgWeight(deal)).toBe(false);
    });

    it('should return false when no priceVariants', () => {
      const deal = makeDeal();
      expect(component.hasAvgWeight(deal)).toBe(false);
    });
  });

  describe('weekId column', () => {
    it('getFieldValue should return weekId string', () => {
      const deal = makeDeal({ weekId: '2026-W14' });
      expect(component.getFieldValue(deal, 'weekId')).toBe('2026-W14');
    });

    it('getFieldValue should return empty string when weekId is undefined', () => {
      const deal = makeDeal({ weekId: undefined as any });
      expect(component.getFieldValue(deal, 'weekId')).toBe('');
    });
  });

  describe('onGlobalFilter', () => {
    it('should call table.filterGlobal with input value', () => {
      const mockTable = { filterGlobal: vi.fn() } as unknown as Table;
      const event = { target: { value: 'apples' } } as unknown as Event;

      component.onGlobalFilter(mockTable, event);
      expect(mockTable.filterGlobal).toHaveBeenCalledWith('apples', 'contains');
    });
  });

  describe('DOM', () => {
    it('should render p-table', () => {
      expect(fixture.nativeElement.querySelector('p-table')).toBeTruthy();
    });

    it('should show expand buttons when deals have priceVariants', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const caption = fixture.nativeElement.querySelector('.caption-actions');
      expect(caption).toBeTruthy();
    });

    it('should hide expand buttons when no deals have priceVariants', async () => {
      fixture.componentRef.setInput('deals', [makeDeal({ dealId: 'x' })]);
      fixture.detectChanges();
      await fixture.whenStable();
      const caption = fixture.nativeElement.querySelector('.caption-actions');
      expect(caption).toBeFalsy();
    });

    it('should show empty message when no deals', async () => {
      fixture.componentRef.setInput('deals', []);
      fixture.detectChanges();
      await fixture.whenStable();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('No deals found');
    });
  });
});
