import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { AdminService, CreateStoreRequest } from '../../../core/services/admin.service';
import { AvailableStore, STORE_FIELD_CONFIGS, STORE_TYPE_METADATA, StoreType } from '../../../core/models/store.model';
import { FieldControlService } from './field-control.service';
import { DynamicFormField } from './dynamic-form-field/dynamic-form-field';

@Component({
  selector: 'app-configure-stores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    ReactiveFormsModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    TableModule,
    ButtonModule,
    ToastModule,
    FluidModule,
    DynamicFormField,
  ],
  templateUrl: './configure-stores.html',
  styles: `
    .address-fieldset {
      border: 1px solid var(--surface-border);
      border-radius: var(--border-radius);
      padding: 1rem;
    }
    .address-fieldset legend {
      padding: 0 0.5rem;
      font-weight: 500;
    }
    .optional-label {
      font-weight: 400;
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }
  `,
})
export class ConfigureStores implements OnInit {
  private adminService = inject(AdminService);
  private fcs = inject(FieldControlService);
  private messageService = inject(MessageService);

  selectedType = signal<StoreType | null>(null);
  typeTouched  = signal(false);
  nameControl  = new FormControl('', Validators.required);

  addressForm = new FormGroup({
    addressLine1: new FormControl(''),
    city: new FormControl(''),
    state: new FormControl(''),
    zipCode: new FormControl(''),
  });

  dynamicFields = computed(() =>
    this.selectedType() ? STORE_FIELD_CONFIGS[this.selectedType()!] : []
  );

  identifierForm = computed(() => this.fcs.toFormGroup(this.dynamicFields()));

  loading    = signal(false);
  submitting = signal(false);
  stores     = signal<AvailableStore[]>([]);

  storeTypeOptions = Object.entries(STORE_TYPE_METADATA).map(([value, meta]) => ({
    value: value as StoreType,
    label: meta.name,
  }));

  ngOnInit(): void {
    this.loadStores();
  }

  onTypeChange(type: StoreType | null): void {
    this.selectedType.set(type);
  }

  submitForm(): void {
    this.typeTouched.set(true);
    this.nameControl.markAsTouched();
    this.identifierForm().markAllAsTouched();

    const type = this.selectedType();
    if (!type || this.nameControl.invalid || this.identifierForm().invalid) return;

    this.submitting.set(true);
    const ids = this.identifierForm().getRawValue() as Record<string, string>;
    const addr = this.addressForm.getRawValue();
    const hasAddress = !!(addr.addressLine1?.trim() || addr.city?.trim());
    const payload: CreateStoreRequest = {
      type,
      name: this.nameControl.value!.trim(),
      storeId: ids['storeId'],
      facilityId: ids['facilityId'],
      postalCode: ids['postalCode'],
      ...(hasAddress && {
        address: {
          addressLine1: addr.addressLine1?.trim() ?? '',
          city: addr.city?.trim() ?? '',
          state: addr.state?.trim() ?? '',
          zipCode: addr.zipCode?.trim() || undefined,
        },
      }),
    };

    this.adminService.createStore(payload).subscribe({
      next: (res) => {
        this.stores.update(s => [...s, res.store]);
        this.messageService.add({ severity: 'success', summary: 'Store added', detail: res.store.name });
        this.selectedType.set(null);
        this.typeTouched.set(false);
        this.nameControl.reset('');
        this.addressForm.reset();
        this.submitting.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message ?? 'Failed to create store' });
        this.submitting.set(false);
      },
    });
  }

  private loadStores(): void {
    this.loading.set(true);
    this.adminService.getAllStores().subscribe({
      next: (stores) => { this.stores.set(stores); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }
}
