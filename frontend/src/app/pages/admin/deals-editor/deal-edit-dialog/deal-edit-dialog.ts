import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AdminService } from '@/app/core/services/admin.service';
import { Deal } from '@/app/core/models/deal.model';

const NORMALIZED_DEPTS = [
  'produce', 'dairy', 'meat', 'seafood', 'bakery', 'snacks', 'candy',
  'seasonal', 'beverages', 'pantry', 'cereal', 'frozen', 'deli', 'general', 'other',
];

@Component({
  selector: 'app-deal-edit-dialog',
  imports: [
    DialogModule,
    AutoCompleteModule,
    InputTextModule,
    ButtonModule,
    FormsModule,
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      [header]="dialogHeader()"
      [modal]="true"
      [style]="{ width: '480px' }"
      [breakpoints]="{ '768px': '90vw' }"
      [closable]="true"
      (onHide)="onDialogHide()"
    >
      <div class="dialog-content">
        <div class="field">
          <label for="dept">Department</label>
          <p-autocomplete
            inputId="dept"
            [(ngModel)]="dept"
            [suggestions]="deptSuggestions()"
            (completeMethod)="filterDepts($event)"
            [forceSelection]="false"
            [dropdown]="true"
            [style]="{ width: '100%' }"
            placeholder="e.g. beverages"
          />
          <small class="field-hint">Will be normalized on save. Leave blank to keep existing value.</small>
        </div>

        <div class="field">
          <label for="canonicalProductId">Canonical Product ID</label>
          <input
            pInputText
            id="canonicalProductId"
            type="text"
            [(ngModel)]="canonicalProductId"
            placeholder="e.g. chicken-breast"
            [style]="{ width: '100%' }"
          />
          <small class="field-hint">Leave blank to keep existing value.</small>
        </div>
      </div>

      <ng-template #footer>
        <p-button label="Cancel" [text]="true" (onClick)="closeDialog()" />
        <p-button
          label="Save"
          icon="pi pi-check"
          [loading]="saving()"
          [disabled]="!canSave()"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field label {
      font-weight: 500;
    }

    .field-hint {
      color: var(--text-color-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealEditDialog {
  private adminService = inject(AdminService);

  private dealsToEdit = signal<Deal[]>([]);

  visible            = signal(false);
  saving             = signal(false);
  dept               = signal('');
  canonicalProductId = signal('');
  deptSuggestions    = signal<string[]>(NORMALIZED_DEPTS);

  saved = output<Deal[]>();

  dialogHeader = computed(() => {
    const n = this.dealsToEdit().length;
    return n === 1 ? 'Edit Deal' : `Edit ${n} Deals`;
  });

  canSave = computed(() =>
    !this.saving() &&
    // p-autocomplete emits null when cleared; coerce defensively before trimming
    ((this.dept() ?? '').trim().length > 0 || (this.canonicalProductId() ?? '').trim().length > 0)
  );

  open(deals: Deal[]): void {
    this.dealsToEdit.set(deals);

    const depts = new Set(deals.map(d => d.dept));
    this.dept.set(depts.size === 1 ? [...depts][0] : '');

    const canonicalIds = new Set(deals.map(d => d.canonicalProductId ?? ''));
    this.canonicalProductId.set(canonicalIds.size === 1 ? [...canonicalIds][0] : '');

    this.visible.set(true);
  }

  filterDepts(event: AutoCompleteCompleteEvent): void {
    const query = event.query.toLowerCase();
    this.deptSuggestions.set(
      NORMALIZED_DEPTS.filter(d => d.includes(query))
    );
  }

  save(): void {
    const deals = this.dealsToEdit();
    const body: { canonicalProductId?: string; dept?: string } = {};
    const trimmedDept = (this.dept() ?? '').trim();
    const trimmedCanonical = (this.canonicalProductId() ?? '').trim();
    if (trimmedDept) body.dept = trimmedDept;
    if (trimmedCanonical) body.canonicalProductId = trimmedCanonical;

    if (!body.dept && !body.canonicalProductId) {
      this.visible.set(false);
      return;
    }

    this.saving.set(true);
    forkJoin(
      deals.map(d => this.adminService.updateDeal(d.storeInstanceId, d.weekId, d.dealId, body))
    ).subscribe({
      next: () => {
        const updatedDeals = deals.map(d => ({ ...d, ...body }));
        this.saved.emit(updatedDeals);
        this.saving.set(false);
        this.visible.set(false);
      },
      error: () => {
        // HTTP errors are shown by the global errorInterceptor
        this.saving.set(false);
      },
    });
  }

  closeDialog(): void {
    this.visible.set(false);
  }

  onDialogHide(): void {
    this.dept.set('');
    this.canonicalProductId.set('');
    this.dealsToEdit.set([]);
  }
}
