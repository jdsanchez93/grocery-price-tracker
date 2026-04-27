import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { StepperModule } from 'primeng/stepper';
import { MessageModule } from 'primeng/message';
import { StoresService } from '@/app/core/services/stores.service';
import { ProfileService } from '@/app/core/services/profile.service';
import { StoreCard } from '@/app/shared/components/store-card/store-card';
import { StoreType, STORE_TYPE_METADATA, StoreSelectOption, storeSelectOption } from '@/app/core/models/store.model';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    ProgressSpinnerModule,
    StepperModule,
    MessageModule,
    StoreCard,
  ],
  styles: `
    :host {
      display: block;
    }

    .onboarding-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--surface-ground);
      padding: 2rem 1rem;
    }

    .onboarding-card {
      background: var(--surface-card);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .card-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .card-header h1 {
      font-size: 1.6rem;
      font-weight: 700;
      margin: 0 0 0.4rem;
      color: var(--text-color);
    }

    .card-header p {
      color: var(--text-color-secondary);
      margin: 0;
    }

    .step-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem 0 0.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .field label {
      font-weight: 500;
      color: var(--text-color);
    }

    .loading-locations {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-color-secondary);
    }

    .step-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding-top: 1rem;
    }

    .confirm-store {
      padding: 0.5rem 0;
    }

    .confirm-label {
      font-size: 0.9rem;
      color: var(--text-color-secondary);
      margin-bottom: 0.75rem;
    }

    .done-content {
      text-align: center;
      padding: 1rem 0;
    }

    .done-icon {
      font-size: 3rem;
      color: var(--green-500);
      margin-bottom: 1rem;
    }

    .done-content h2 {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--text-color);
    }

    .done-content p {
      color: var(--text-color-secondary);
      margin: 0 0 1.5rem;
    }

    :host ::ng-deep .p-steppanel-content-wrapper {
      width: 100%;
      min-width: 0;
    }
  `,
  template: `
    <div class="onboarding-wrapper">
      <div class="onboarding-card">
        <div class="card-header">
          <h1>Welcome to Grocery Price Tracker</h1>
          <p>Let's add your first store to get started.</p>
        </div>

        <p-stepper [value]="activeStep()" [linear]="true" (valueChange)="onStepChange($event)">
          <p-step-list>
            <p-step [value]="1" class="flex flex-row flex-auto gap-2">
              <ng-template #content let-activateCallback="activateCallback" let-value="value">
                <button class="bg-transparent border-0 inline-flex flex-col items-center gap-2" (click)="activateCallback()">
                  <span
                    class="rounded-full border-2 w-12 h-12 inline-flex items-center justify-center"
                    [class.bg-primary]="value <= activeStep()"
                    [class.text-primary-contrast]="value <= activeStep()"
                    [class.border-primary]="value <= activeStep()"
                    [class.border-surface]="value > activeStep()"
                  >
                    <i class="pi pi-shop"></i>
                  </span>
                  <span class="text-sm font-medium">Find a Store</span>
                </button>
              </ng-template>
            </p-step>
            <p-step [value]="2" class="flex flex-row flex-auto gap-2">
              <ng-template #content let-activateCallback="activateCallback" let-value="value">
                <button class="bg-transparent border-0 inline-flex flex-col items-center gap-2" (click)="activateCallback()">
                  <span
                    class="rounded-full border-2 w-12 h-12 inline-flex items-center justify-center"
                    [class.bg-primary]="value <= activeStep()"
                    [class.text-primary-contrast]="value <= activeStep()"
                    [class.border-primary]="value <= activeStep()"
                    [class.border-surface]="value > activeStep()"
                  >
                    <i class="pi pi-clipboard"></i>
                  </span>
                  <span class="text-sm font-medium">Confirm</span>
                </button>
              </ng-template>
            </p-step>
            <p-step [value]="3" class="flex flex-row flex-auto gap-2">
              <ng-template #content let-activateCallback="activateCallback" let-value="value">
                <button class="bg-transparent border-0 inline-flex flex-col items-center gap-2" (click)="activateCallback()">
                  <span
                    class="rounded-full border-2 w-12 h-12 inline-flex items-center justify-center"
                    [class.bg-primary]="value <= activeStep()"
                    [class.text-primary-contrast]="value <= activeStep()"
                    [class.border-primary]="value <= activeStep()"
                    [class.border-surface]="value > activeStep()"
                  >
                    <i class="pi pi-check-circle"></i>
                  </span>
                  <span class="text-sm font-medium">Done</span>
                </button>
              </ng-template>
            </p-step>
          </p-step-list>

          <p-step-panels>
            <!-- Step 1: Pick store type + location -->
            <p-step-panel [value]="1">
              <ng-template #content let-activateCallback="activateCallback">
                <div class="step-content">
                  <div class="field">
                    <label for="storeType" id="storeTypeLabel">Store chain</label>
                    <p-select
                      inputId="storeType"
                      [options]="storeTypeOptions()"
                      [(ngModel)]="selectedStoreType"
                      placeholder="Select a store chain"
                      (onChange)="onStoreTypeChange()"
                      ariaLabelledBy="storeTypeLabel"
                      appendTo="body"
                      fluid
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
                          <span>Loading locations…</span>
                        </div>
                      } @else {
                        <p-select
                          inputId="location"
                          [options]="locationOptions()"
                          [(ngModel)]="selectedLocation"
                          placeholder="Select a location"
                          [filter]="true"
                          filterPlaceholder="Search locations…"
                          ariaLabelledBy="locationLabel"
                          appendTo="body"
                          fluid
                        />
                      }
                    </div>
                  }
                </div>

                <div class="step-actions">
                  <p-button
                    label="Next"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    [disabled]="!canProceedToConfirm()"
                    (onClick)="activateCallback(2)"
                  />
                </div>
              </ng-template>
            </p-step-panel>

            <!-- Step 2: Confirm selection -->
            <p-step-panel [value]="2">
              <ng-template #content let-activateCallback="activateCallback">
                <div class="step-content">
                  @if (selectedStore()) {
                    <div class="confirm-store">
                      <p class="confirm-label">You selected:</p>
                      <app-store-card
                        [name]="selectedStore()!.name"
                        [storeType]="selectedStore()!.storeType"
                        [address]="selectedStore()!.address"
                      />
                    </div>
                  }

                  @if (addError()) {
                    <p-message severity="error" [text]="addError()!" />
                  }
                </div>

                <div class="step-actions">
                  <p-button
                    label="Back"
                    [text]="true"
                    (onClick)="activateCallback(1)"
                    [disabled]="loading()"
                  />
                  <p-button
                    label="Add Store"
                    icon="pi pi-plus"
                    [loading]="loading()"
                    (onClick)="addStore(activateCallback)"
                  />
                </div>
              </ng-template>
            </p-step-panel>

            <!-- Step 3: Done -->
            <p-step-panel [value]="3">
              <ng-template #content>
                <div class="done-content">
                  <i class="pi pi-check-circle done-icon" aria-hidden="true"></i>
                  <h2>You're all set!</h2>
                  <p>Your store has been added. Start browsing this week's deals.</p>
                  <p-button
                    label="View My Deals"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    size="large"
                    routerLink="/dashboard"
                  />
                </div>
              </ng-template>
            </p-step-panel>
          </p-step-panels>
        </p-stepper>
      </div>
    </div>
  `,
})
export class Onboarding {
  private storesService = inject(StoresService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  activeStep = signal(1);
  addError = signal<string | null>(null);

  selectedStoreType = signal<StoreType | null>(null);
  selectedLocation = signal<string | null>(null);

  loading = this.storesService.loading;
  loadingAvailable = this.storesService.loadingAvailable;

  availableStores = computed(() => {
    const type = this.selectedStoreType();
    if (!type) return [];
    return this.storesService.getAvailableStoresByType(type);
  });

  storeTypeOptions = computed(() => {
    const allTypes: StoreType[] = ['kingsoopers', 'safeway', 'sprouts'];
    return allTypes.map(type => ({
      value: type,
      label: STORE_TYPE_METADATA[type].name,
    }));
  });

  locationOptions = computed<StoreSelectOption[]>(() =>
    this.availableStores()
      .filter(s => s.enabled)
      .map(storeSelectOption)
  );

  selectedStore = computed(() => {
    const id = this.selectedLocation();
    return id ? this.availableStores().find(s => s.instanceId === id) ?? null : null;
  });

  canProceedToConfirm = computed(
    () => this.selectedStoreType() !== null && this.selectedLocation() !== null
  );

  onStepChange(value: number | undefined): void {
    if (value !== undefined) this.activeStep.set(value);
  }

  onStoreTypeChange(): void {
    this.selectedLocation.set(null);
    this.storesService.loadAllStores();
  }

  addStore(activateCallback: (step: number) => void): void {
    const instanceId = this.selectedLocation();
    if (!instanceId) return;

    this.addError.set(null);
    this.storesService.addStore(instanceId).subscribe({
      next: () => {
        this.profileService.markOnboarded().subscribe();
        activateCallback(3);
      },
      error: () => {
        this.addError.set(this.storesService.error() ?? 'Failed to add store. Please try again.');
      },
    });
  }
}
