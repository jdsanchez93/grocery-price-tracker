import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
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

    it('globalFilterFields always includes canonicalProductId even when not in columns', () => {
      const fields = component.globalFilterFields();
      expect(fields).toContain('canonicalProductId');
    });

    it('globalFilterFields does not duplicate canonicalProductId when it is an explicit column', () => {
      const colsWithCanonical: DealColumnConfig[] = [
        ...TEST_COLUMNS,
        { field: 'canonicalProductId', header: 'Product ID' },
      ];
      fixture.componentRef.setInput('columns', colsWithCanonical);
      fixture.detectChanges();
      const fields = component.globalFilterFields();
      expect(fields.filter(f => f === 'canonicalProductId')).toHaveLength(1);
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

    it('expandedColspan adds 1 when selectable is true', () => {
      fixture.componentRef.setInput('deals', [makeDeal({ dealId: 'd1' })]);
      fixture.componentRef.setInput('selectable', true);
      fixture.detectChanges();
      // no expandable rows + selectable = columns + 1
      expect(component.expandedColspan()).toBe(TEST_COLUMNS.length + 1);
    });
  });

  describe('selectable', () => {
    it('selectable defaults to false', () => {
      expect(component.selectable()).toBe(false);
    });

    it('selectedDeals defaults to empty array', () => {
      expect(component.selectedDeals()).toEqual([]);
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

  describe('getStoreAbbr', () => {
    it('should return KS for kingsoopers', () => {
      expect(component.getStoreAbbr('kingsoopers:a')).toBe('KS');
    });

    it('should return SW for safeway', () => {
      expect(component.getStoreAbbr('safeway:b')).toBe('SW');
    });

    it('should return SP for sprouts', () => {
      expect(component.getStoreAbbr('sprouts:c')).toBe('SP');
    });

    it('should fall back to instanceId for unknown stores', () => {
      expect(component.getStoreAbbr('walmart:x')).toBe('walmart:x');
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

  describe('getLoyaltyIcon', () => {
    it('should return tag icon for "With Digital Coupon"', () => {
      expect(component.getLoyaltyIcon('With Digital Coupon')).toBe('pi pi-tag');
    });

    it('should return tag icon for strings containing "coupon"', () => {
      expect(component.getLoyaltyIcon('digital coupon required')).toBe('pi pi-tag');
    });

    it('should return credit-card icon for "With Card"', () => {
      expect(component.getLoyaltyIcon('With Card')).toBe('pi pi-credit-card');
    });

    it('should return credit-card icon for "CARD_REQUIRED"', () => {
      expect(component.getLoyaltyIcon('CARD_REQUIRED')).toBe('pi pi-credit-card');
    });

    it('should return star icon for unknown loyalty values', () => {
      expect(component.getLoyaltyIcon('some unknown value')).toBe('pi pi-star');
    });
  });

  describe('getLoyaltyTooltip', () => {
    it('should return digital coupon tooltip for "With Digital Coupon"', () => {
      expect(component.getLoyaltyTooltip('With Digital Coupon')).toBe('Requires digital coupon');
    });

    it('should return loyalty card tooltip for "With Card"', () => {
      expect(component.getLoyaltyTooltip('With Card')).toBe('Requires loyalty card');
    });

    it('should return loyalty card tooltip for "CARD_REQUIRED"', () => {
      expect(component.getLoyaltyTooltip('CARD_REQUIRED')).toBe('Requires loyalty card');
    });

    it('should return the raw value for unknown loyalty strings', () => {
      expect(component.getLoyaltyTooltip('some unknown value')).toBe('some unknown value');
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

  describe('canonicalProductId column', () => {
    it('getFieldValue returns the canonical product id', () => {
      const deal = makeDeal({ canonicalProductId: 'chicken-breast' });
      expect(component.getFieldValue(deal, 'canonicalProductId')).toBe('chicken-breast');
    });

    it('getFieldValue returns empty string when canonicalProductId is undefined', () => {
      const deal = makeDeal({ canonicalProductId: undefined });
      expect(component.getFieldValue(deal, 'canonicalProductId')).toBe('');
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

  describe('derivedFilterOptions', () => {
    it('returns an empty map when no columns use multiselect', () => {
      const textOnlyCols: DealColumnConfig[] = [
        { field: 'name', header: 'Name', filterType: 'text' },
      ];
      fixture.componentRef.setInput('columns', textOnlyCols);
      fixture.detectChanges();
      expect(component.derivedFilterOptions().size).toBe(0);
    });

    it('derives dept options from the deals in the current data set', () => {
      const deptOnlyCol: DealColumnConfig[] = [
        { field: 'dept', header: 'Department', filterType: 'multiselect' },
      ];
      fixture.componentRef.setInput('columns', deptOnlyCol);
      fixture.componentRef.setInput('deals', [
        makeDeal({ dealId: 'd1', dept: 'produce' }),
        makeDeal({ dealId: 'd2', dept: 'dairy' }),
        makeDeal({ dealId: 'd3', dept: 'produce' }), // duplicate
      ]);
      fixture.detectChanges();

      const opts = component.derivedFilterOptions().get('dept');
      expect(opts).toBeDefined();
      expect(opts!.map(o => o.value)).toEqual(['dairy', 'produce']); // sorted
    });

    it('uses getStoreDisplayName as the label for storeInstanceId field', () => {
      const storeCol: DealColumnConfig[] = [
        { field: 'store', header: 'Store', filterType: 'multiselect', filterField: 'storeInstanceId' },
      ];
      fixture.componentRef.setInput('columns', storeCol);
      fixture.componentRef.setInput('deals', [
        makeDeal({ dealId: 'd1', storeInstanceId: 'kingsoopers:a' }),
        makeDeal({ dealId: 'd2', storeInstanceId: 'safeway:b' }),
      ]);
      fixture.detectChanges();

      const opts = component.derivedFilterOptions().get('storeInstanceId');
      expect(opts).toBeDefined();
      const ks = opts!.find(o => o.value === 'kingsoopers:a');
      expect(ks?.label).toBe(component.getStoreDisplayName('kingsoopers:a'));
      expect(ks?.label).not.toBe('kingsoopers:a'); // not raw instanceId
    });

    it('sorts options alphabetically by label', () => {
      const deptCol: DealColumnConfig[] = [
        { field: 'dept', header: 'Department', filterType: 'multiselect' },
      ];
      fixture.componentRef.setInput('columns', deptCol);
      fixture.componentRef.setInput('deals', [
        makeDeal({ dealId: 'd1', dept: 'snacks' }),
        makeDeal({ dealId: 'd2', dept: 'bakery' }),
        makeDeal({ dealId: 'd3', dept: 'produce' }),
      ]);
      fixture.detectChanges();

      const labels = component.derivedFilterOptions().get('dept')!.map(o => o.label);
      expect(labels).toEqual([...labels].sort());
    });

    it('deduplicates values', () => {
      const deptCol: DealColumnConfig[] = [
        { field: 'dept', header: 'Department', filterType: 'multiselect' },
      ];
      fixture.componentRef.setInput('columns', deptCol);
      fixture.componentRef.setInput('deals', [
        makeDeal({ dealId: 'd1', dept: 'produce' }),
        makeDeal({ dealId: 'd2', dept: 'produce' }),
        makeDeal({ dealId: 'd3', dept: 'produce' }),
      ]);
      fixture.detectChanges();

      expect(component.derivedFilterOptions().get('dept')).toHaveLength(1);
    });

    it('returns empty options for a column when deals array is empty', () => {
      const deptCol: DealColumnConfig[] = [
        { field: 'dept', header: 'Department', filterType: 'multiselect' },
      ];
      fixture.componentRef.setInput('columns', deptCol);
      fixture.componentRef.setInput('deals', []);
      fixture.detectChanges();

      expect(component.derivedFilterOptions().get('dept')).toEqual([]);
    });

    it('excludes entries with empty string values', () => {
      const deptCol: DealColumnConfig[] = [
        { field: 'dept', header: 'Department', filterType: 'multiselect' },
      ];
      fixture.componentRef.setInput('columns', deptCol);
      fixture.componentRef.setInput('deals', [
        makeDeal({ dealId: 'd1', dept: 'produce' }),
        makeDeal({ dealId: 'd2', dept: '' }),
      ]);
      fixture.detectChanges();

      const opts = component.derivedFilterOptions().get('dept')!;
      expect(opts.every(o => o.value !== '')).toBe(true);
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

// ── Content projection ────────────────────────────────────────────────────────
// Tests for #captionActions and #rowActions require a host component to project
// content into DealsTable.

const FLAT_DEALS = [makeDeal({ dealId: 'flat' })]; // no priceVariants → no expand toggle

@Component({
  template: `
    <app-deals-table [deals]="deals" [columns]="columns">
      <ng-template #captionActions>
        <button class="test-caption-btn">Caption Action</button>
      </ng-template>
    </app-deals-table>
  `,
  imports: [DealsTable],
})
class HostWithCaptionActions {
  deals = FLAT_DEALS;
  columns = TEST_COLUMNS;
}

@Component({
  template: `
    <app-deals-table [deals]="deals" [columns]="columns">
      <ng-template #rowActions let-deal>
        <button class="test-row-btn">Row Action</button>
      </ng-template>
    </app-deals-table>
  `,
  imports: [DealsTable],
})
class HostWithRowActions {
  deals = FLAT_DEALS;
  columns = TEST_COLUMNS;
}

describe('DealsTable — captionActionsTemplate', () => {
  let hostFixture: ComponentFixture<HostWithCaptionActions>;
  let tableComponent: DealsTable;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithCaptionActions],
    }).compileComponents();

    hostFixture = TestBed.createComponent(HostWithCaptionActions);
    tableComponent = hostFixture.debugElement.query(By.directive(DealsTable)).componentInstance;
    hostFixture.detectChanges();
    await hostFixture.whenStable();
  });

  it('captionActionsTemplate signal is defined when template is projected', () => {
    expect(tableComponent.captionActionsTemplate()).toBeDefined();
  });

  it('renders .caption-actions even when there are no expandable rows', () => {
    expect(hostFixture.nativeElement.querySelector('.caption-actions')).toBeTruthy();
  });

  it('renders projected caption content inside .caption-actions', () => {
    const btn = hostFixture.nativeElement.querySelector('.test-caption-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Caption Action');
  });
});

describe('DealsTable — rowActionsTemplate', () => {
  let hostFixture: ComponentFixture<HostWithRowActions>;
  let tableComponent: DealsTable;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithRowActions],
    }).compileComponents();

    hostFixture = TestBed.createComponent(HostWithRowActions);
    tableComponent = hostFixture.debugElement.query(By.directive(DealsTable)).componentInstance;
    hostFixture.detectChanges();
    await hostFixture.whenStable();
  });

  it('rowActionsTemplate signal is defined when template is projected', () => {
    expect(tableComponent.rowActionsTemplate()).toBeDefined();
  });

  it('expandedColspan adds 1 for rowActionsTemplate (no expandable rows, not selectable)', () => {
    // flat deals → no expand col; not selectable; rowActionsTemplate present → +1
    expect(tableComponent.expandedColspan()).toBe(TEST_COLUMNS.length + 1);
  });
});
