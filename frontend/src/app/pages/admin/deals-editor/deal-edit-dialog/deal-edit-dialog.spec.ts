import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { DealEditDialog } from './deal-edit-dialog';
import { AdminService } from '@/app/core/services/admin.service';
import { Deal } from '@/app/core/models/deal.model';
import { makeDeal } from '@/app/core/models/test-utils';

function makeAdminService() {
  return {
    updateDeal: vi.fn().mockReturnValue(of({} as Deal)),
  };
}

describe('DealEditDialog', () => {
  let component: DealEditDialog;
  let fixture: ComponentFixture<DealEditDialog>;
  let adminService: ReturnType<typeof makeAdminService>;

  beforeEach(async () => {
    adminService = makeAdminService();

    await TestBed.configureTestingModule({
      imports: [DealEditDialog],
      providers: [
        { provide: AdminService, useValue: adminService },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DealEditDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── initial state ────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('visible is false', () => {
      expect(component.visible()).toBe(false);
    });

    it('saving is false', () => {
      expect(component.saving()).toBe(false);
    });

    it('dept is empty string', () => {
      expect(component.dept()).toBe('');
    });

    it('canonicalProductId is empty string', () => {
      expect(component.canonicalProductId()).toBe('');
    });
  });

  // ── dialogHeader ─────────────────────────────────────────────────────────────

  describe('dialogHeader', () => {
    it('returns "Edit Deal" for a single deal', () => {
      component.open([makeDeal()]);
      expect(component.dialogHeader()).toBe('Edit Deal');
    });

    it('returns "Edit N Deals" for multiple deals', () => {
      component.open([makeDeal({ dealId: 'd1' }), makeDeal({ dealId: 'd2' }), makeDeal({ dealId: 'd3' })]);
      expect(component.dialogHeader()).toBe('Edit 3 Deals');
    });
  });

  // ── canSave ──────────────────────────────────────────────────────────────────

  describe('canSave', () => {
    it('is false when both dept and canonicalProductId are empty', () => {
      expect(component.canSave()).toBe(false);
    });

    it('is true when dept has content', () => {
      component.dept.set('produce');
      expect(component.canSave()).toBe(true);
    });

    it('is true when canonicalProductId has content', () => {
      component.canonicalProductId.set('chicken-breast');
      expect(component.canSave()).toBe(true);
    });

    it('is false when saving is true even if fields have content', () => {
      component.dept.set('produce');
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });

    it('is false when dept is whitespace-only', () => {
      component.dept.set('   ');
      expect(component.canSave()).toBe(false);
    });

    it('is false when dept is null (p-autocomplete cleared)', () => {
      component.dept.set(null as unknown as string);
      expect(component.canSave()).toBe(false);
    });
  });

  // ── open() ───────────────────────────────────────────────────────────────────

  describe('open()', () => {
    it('sets visible to true', () => {
      component.open([makeDeal()]);
      expect(component.visible()).toBe(true);
    });

    it('pre-fills dept when all deals share the same dept', () => {
      component.open([
        makeDeal({ dealId: 'd1', dept: 'produce' }),
        makeDeal({ dealId: 'd2', dept: 'produce' }),
      ]);
      expect(component.dept()).toBe('produce');
    });

    it('clears dept when deals have different depts', () => {
      component.open([
        makeDeal({ dealId: 'd1', dept: 'produce' }),
        makeDeal({ dealId: 'd2', dept: 'dairy' }),
      ]);
      expect(component.dept()).toBe('');
    });

    it('pre-fills canonicalProductId when all deals share the same value', () => {
      component.open([
        makeDeal({ dealId: 'd1', canonicalProductId: 'chicken-breast' }),
        makeDeal({ dealId: 'd2', canonicalProductId: 'chicken-breast' }),
      ]);
      expect(component.canonicalProductId()).toBe('chicken-breast');
    });

    it('clears canonicalProductId when deals have different values', () => {
      component.open([
        makeDeal({ dealId: 'd1', canonicalProductId: 'chicken-breast' }),
        makeDeal({ dealId: 'd2', canonicalProductId: 'ground-beef' }),
      ]);
      expect(component.canonicalProductId()).toBe('');
    });

    it('clears canonicalProductId when deals have no canonical ID', () => {
      component.open([
        makeDeal({ dealId: 'd1', canonicalProductId: undefined }),
        makeDeal({ dealId: 'd2', canonicalProductId: undefined }),
      ]);
      expect(component.canonicalProductId()).toBe('');
    });
  });

  // ── filterDepts() ────────────────────────────────────────────────────────────

  describe('filterDepts()', () => {
    it('returns all suggestions for an empty query', () => {
      component.filterDepts({ query: '' } as any);
      expect(component.deptSuggestions().length).toBeGreaterThan(0);
    });

    it('filters to matching suggestions', () => {
      component.filterDepts({ query: 'pro' } as any);
      expect(component.deptSuggestions()).toContain('produce');
      expect(component.deptSuggestions()).not.toContain('dairy');
    });

    it('is case-insensitive', () => {
      component.filterDepts({ query: 'PRO' } as any);
      expect(component.deptSuggestions()).toContain('produce');
    });

    it('returns empty array when query matches nothing', () => {
      component.filterDepts({ query: 'zzz' } as any);
      expect(component.deptSuggestions()).toEqual([]);
    });
  });

  // ── closeDialog() ────────────────────────────────────────────────────────────

  describe('closeDialog()', () => {
    it('sets visible to false', () => {
      component.open([makeDeal()]);
      expect(component.visible()).toBe(true);

      component.closeDialog();
      expect(component.visible()).toBe(false);
    });
  });

  // ── onDialogHide() ───────────────────────────────────────────────────────────

  describe('onDialogHide()', () => {
    it('resets dept, canonicalProductId, and dealsToEdit', () => {
      component.open([makeDeal({ dept: 'produce', canonicalProductId: 'apple' })]);
      expect(component.dept()).toBe('produce');

      component.onDialogHide();

      expect(component.dept()).toBe('');
      expect(component.canonicalProductId()).toBe('');
      expect(component['dealsToEdit']()).toEqual([]);
    });
  });

  // ── save() ───────────────────────────────────────────────────────────────────

  describe('save()', () => {
    it('calls updateDeal for each deal with trimmed dept', () => {
      const deals = [makeDeal({ dealId: 'd1' }), makeDeal({ dealId: 'd2' })];
      component.open(deals);
      component.dept.set('  produce  ');

      component.save();

      expect(adminService.updateDeal).toHaveBeenCalledTimes(2);
      expect(adminService.updateDeal).toHaveBeenCalledWith(
        deals[0].storeInstanceId, deals[0].weekId, deals[0].dealId,
        { dept: 'produce' }
      );
    });

    it('only sends dept when canonicalProductId is empty', () => {
      component.open([makeDeal()]);
      component.dept.set('dairy');
      component.canonicalProductId.set('');

      component.save();

      const body = adminService.updateDeal.mock.calls[0][3];
      expect(body).toEqual({ dept: 'dairy' });
      expect(body.canonicalProductId).toBeUndefined();
    });

    it('only sends canonicalProductId when dept is empty', () => {
      component.open([makeDeal()]);
      component.dept.set('');
      component.canonicalProductId.set('milk');

      component.save();

      const body = adminService.updateDeal.mock.calls[0][3];
      expect(body).toEqual({ canonicalProductId: 'milk' });
      expect(body.dept).toBeUndefined();
    });

    it('sends both fields when both have content', () => {
      component.open([makeDeal()]);
      component.dept.set('dairy');
      component.canonicalProductId.set('milk');

      component.save();

      const body = adminService.updateDeal.mock.calls[0][3];
      expect(body).toEqual({ dept: 'dairy', canonicalProductId: 'milk' });
    });

    it('closes dialog and clears saving on success', () => {
      component.open([makeDeal()]);
      component.dept.set('produce');

      component.save();

      expect(component.visible()).toBe(false);
      expect(component.saving()).toBe(false);
    });

    it('emits saved with optimistically updated deals', () => {
      const deal = makeDeal({ dealId: 'd1', dept: 'unknown' });
      component.open([deal]);
      component.dept.set('produce');

      const emitted: Deal[][] = [];
      component.saved.subscribe(v => emitted.push(v));

      component.save();

      expect(emitted).toHaveLength(1);
      expect(emitted[0][0].dept).toBe('produce');
      expect(emitted[0][0].dealId).toBe('d1');
    });

    it('does not call updateDeal when both fields are empty, closes dialog instead', () => {
      component.open([makeDeal()]);
      // open() pre-fills dept from the deal; clear both fields explicitly
      component.dept.set('');
      component.canonicalProductId.set('');

      component.save();

      expect(adminService.updateDeal).not.toHaveBeenCalled();
      expect(component.visible()).toBe(false);
    });

    it('handles null dept gracefully (p-autocomplete cleared)', () => {
      component.open([makeDeal()]);
      component.dept.set(null as unknown as string);
      component.canonicalProductId.set('milk');

      component.save();

      const body = adminService.updateDeal.mock.calls[0][3];
      expect(body).toEqual({ canonicalProductId: 'milk' });
    });

    it('clears saving and keeps dialog open on error', () => {
      adminService.updateDeal.mockReturnValue(throwError(() => new Error('fail')));
      component.open([makeDeal()]);
      component.dept.set('produce');

      component.save();

      expect(component.saving()).toBe(false);
      expect(component.visible()).toBe(true);
    });

    it('does not emit saved on error', () => {
      adminService.updateDeal.mockReturnValue(throwError(() => new Error('fail')));
      component.open([makeDeal()]);
      component.dept.set('produce');

      const emitted: Deal[][] = [];
      component.saved.subscribe(v => emitted.push(v));

      component.save();

      expect(emitted).toHaveLength(0);
    });
  });
});
