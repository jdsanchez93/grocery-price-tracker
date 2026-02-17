import { Component, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { StoresService } from '../../core/services/stores.service';
import { StoreType, STORE_TYPE_METADATA } from '../../core/models/deal.model';
import { AvailableStore } from '../../core/models/store.model';

interface StoreTypeOption {
  value: StoreType;
  label: string;
  disabled: boolean;
}

interface LocationOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-stores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    TagModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="stores-page">
      <div class="page-header">
        <h2>My Stores</h2>
        <p-button
          label="Add Store"
          icon="pi pi-plus"
          (onClick)="openAddDialog()"
          [disabled]="loading()"
        />
      </div>

      @if (loading() && stores().length === 0) {
        <div class="loading-container">
          <p-progressSpinner ariaLabel="Loading stores" />
        </div>
      } @else if (error()) {
        <div class="error-container">
          <i class="pi pi-exclamation-triangle"></i>
          <p>{{ error() }}</p>
          <p-button label="Retry" (onClick)="retry()" />
        </div>
      } @else if (stores().length === 0) {
        <div class="empty-state">
          <i class="pi pi-shop"></i>
          <h3>No stores added yet</h3>
          <p>Add your first store to start tracking deals.</p>
          <p-button
            label="Add Your First Store"
            icon="pi pi-plus"
            (onClick)="openAddDialog()"
          />
        </div>
      } @else {
        <div class="stores-grid">
          @for (storeType of storeTypes; track storeType) {
            @if (getStoresForType(storeType).length > 0) {
              <div class="store-type-section">
                <h3>{{ getStoreTypeName(storeType) }}</h3>
                <div class="store-cards">
                  @for (store of getStoresForType(storeType); track store.instanceId) {
                    <p-card>
                      <ng-template #header>
                        <div class="store-card-header">
                          <p-tag [value]="store.chain" severity="info" />
                        </div>
                      </ng-template>
                      <div class="store-card-content">
                        <h4>{{ store.name }}</h4>
                        <p class="store-id">{{ store.instanceId }}</p>
                      </div>
                      <ng-template #footer>
                        <p-button
                          icon="pi pi-trash"
                          severity="danger"
                          [text]="true"
                          (onClick)="confirmRemove(store.instanceId, store.name)"
                          ariaLabel="Remove store"
                        />
                      </ng-template>
                    </p-card>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </div>

    <p-dialog
      header="Add Store"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '450px', minHeight: '300px' }"
      [closable]="true"
      (onHide)="onDialogHide()"
    >
      <div class="dialog-content">
        <div class="field">
          <label for="storeType" id="storeTypeLabel">Store Type</label>
          <p-select
            id="storeType"
            [options]="storeTypeOptions()"
            [(ngModel)]="selectedStoreType"
            placeholder="Select a store type"
            (onChange)="onStoreTypeChange()"
            [style]="{ width: '100%' }"
            ariaLabelledBy="storeTypeLabel"
            appendTo="body"
          />
        </div>

        @if (selectedStoreType()) {
          <div class="field">
            <label for="location" id="locationLabel">Location</label>
            @if (loadingAvailable()) {
              <div class="loading-locations">
                <p-progressSpinner
                  [style]="{ width: '24px', height: '24px' }"
                  ariaLabel="Loading locations"
                />
                <span>Loading locations...</span>
              </div>
            } @else {
              <p-select
                id="location"
                [options]="locationOptions()"
                [(ngModel)]="selectedLocation"
                placeholder="Select a location"
                [filter]="true"
                filterPlaceholder="Search locations..."
                [style]="{ width: '100%' }"
                ariaLabelledBy="locationLabel"
                appendTo="body"
              />
            }
          </div>
        }
      </div>

      <ng-template #footer>
        <p-button
          label="Cancel"
          [text]="true"
          (onClick)="closeDialog()"
        />
        <p-button
          label="Add Store"
          icon="pi pi-plus"
          (onClick)="addSelectedStore()"
          [disabled]="!canAddStore()"
          [loading]="loading()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    .stores-page {
      padding: 1rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .page-header h2 {
      margin: 0;
    }

    .loading-container,
    .error-container,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
      background: var(--surface-card);
      border-radius: var(--border-radius);
    }

    .error-container i,
    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: var(--text-color-secondary);
    }

    .error-container i {
      color: var(--red-500);
    }

    .empty-state h3 {
      margin: 0 0 0.5rem 0;
    }

    .empty-state p {
      color: var(--text-color-secondary);
      margin-bottom: 1rem;
    }

    .stores-grid {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .store-type-section h3 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }

    .store-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .store-card-header {
      padding: 0.75rem 1rem 0;
    }

    .store-card-content h4 {
      margin: 0 0 0.5rem 0;
    }

    .store-card-content .store-id {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      margin: 0;
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .field label {
      font-weight: 500;
    }

    .loading-locations {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-color-secondary);
    }
  `]
})
export class StoresComponent {
  private storesService = inject(StoresService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  readonly storeTypes: StoreType[] = ['kingsoopers', 'safeway', 'sprouts'];

  dialogVisible = signal(false);
  selectedStoreType = signal<StoreType | null>(null);
  selectedLocation = signal<string | null>(null);

  stores = this.storesService.getUserStores;
  loading = this.storesService.loading;
  loadingAvailable = this.storesService.loadingAvailable;
  error = this.storesService.error;
  storeTypeOptions = this.storesService.getAvailableStoreTypeOptions;
  availableStores = this.storesService.getAvailableStores;

  locationOptions = computed<LocationOption[]>(() => {
    return this.availableStores()
      .filter(store => store.enabled)
      .map(store => ({
        value: store.instanceId,
        label: store.name
      }));
  });

  canAddStore = computed(() => {
    return this.selectedStoreType() !== null && this.selectedLocation() !== null;
  });

  getStoreTypeName(type: StoreType): string {
    return STORE_TYPE_METADATA[type]?.name ?? type;
  }

  getStoresForType(type: StoreType) {
    return this.stores().filter(s => s.storeType === type);
  }

  openAddDialog(): void {
    this.dialogVisible.set(true);
  }

  closeDialog(): void {
    this.dialogVisible.set(false);
  }

  onDialogHide(): void {
    this.selectedStoreType.set(null);
    this.selectedLocation.set(null);
    this.storesService.clearAvailableStores();
  }

  onStoreTypeChange(): void {
    const type = this.selectedStoreType();
    this.selectedLocation.set(null);

    if (type) {
      this.storesService.loadAvailableStores(type);
    } else {
      this.storesService.clearAvailableStores();
    }
  }

  addSelectedStore(): void {
    const instanceId = this.selectedLocation();
    if (!instanceId) return;

    this.storesService.addStore(instanceId);
    this.closeDialog();
    this.messageService.add({
      severity: 'success',
      summary: 'Store Added',
      detail: 'The store has been added to your list.'
    });
  }

  confirmRemove(instanceId: string, name: string): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to remove "${name}" from your stores?`,
      header: 'Remove Store',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.storesService.removeStore(instanceId);
        this.messageService.add({
          severity: 'success',
          summary: 'Store Removed',
          detail: 'The store has been removed from your list.'
        });
      }
    });
  }

  retry(): void {
    this.storesService.loadUserStores();
  }
}
