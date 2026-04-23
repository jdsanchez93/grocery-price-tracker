import { Component, inject, signal, computed, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { StoresService } from '@/app/core/services/stores.service';
import { StoreType } from '@/app/core/models/store.model';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

interface LocationOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-add-store-dialog',
  imports: [
    DialogModule,
    SelectModule,
    ButtonModule,
    FormsModule,
    ProgressSpinnerModule
  ],
  template: `
    <p-dialog
        header="Add Store"
        [(visible)]="visible"
        [modal]="true"
        [style]="{ width: '450px', minHeight: '300px' }"
        [breakpoints]="{ '768px': '90vw'}"
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
  styles: `
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
  `,
})
export class AddStoreDialog {
  private storesService = inject(StoresService);

  visible = signal(false);
  storeAdded = output<string>();

  selectedStoreType = signal<StoreType | null>(null);
  selectedLocation = signal<string | null>(null);

  loading = this.storesService.loading;
  loadingAvailable = this.storesService.loadingAvailable;
  error = this.storesService.error;
  storeTypeOptions = this.storesService.getAvailableStoreTypeOptions;

  availableStores = computed(() => {
    const type = this.selectedStoreType();
    if (!type) return [];
    return this.storesService.getAvailableStoresByType(type);
  });

  locationOptions = computed<LocationOption[]>(() => {
    return this.availableStores()
      .filter(store => store.enabled)
      .map(store => {
        const addr = store.address;
        const addrStr = addr
          ? ` — ${addr.addressLine1 ? addr.addressLine1 + ', ' : ''}${addr.city}, ${addr.state}`
          : '';
        return { value: store.instanceId, label: store.name + addrStr };
      });
  });

  canAddStore = computed(() => {
    return this.selectedStoreType() !== null && this.selectedLocation() !== null;
  });

  open() {
    this.visible.set(true);
  }

  onDialogHide(): void {
    this.selectedStoreType.set(null);
    this.selectedLocation.set(null);
  }

  onStoreTypeChange(): void {
    this.selectedLocation.set(null);
    this.storesService.loadAllStores();
  }

  closeDialog(): void {
    this.visible.set(false);
  }

  addSelectedStore(): void {
    const instanceId = this.selectedLocation();
    if (!instanceId) return;

    this.storeAdded.emit(instanceId);
    this.closeDialog();
  }

}
