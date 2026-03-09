import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { StoreCard } from "@/app/shared/components/store-card/store-card";
import { ButtonModule } from "primeng/button";
import { StoresService } from '@/app/core/services/stores.service';
import { AddStoreDialog } from "../add-store-dialog/add-store-dialog";
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-user-stores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StoreCard,
    ButtonModule,
    AddStoreDialog,
    ToastModule,
    ConfirmDialogModule,
    SkeletonModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />                             
    <app-add-store-dialog (storeAdded)="addSelectedStore($event)" />

    <div class ="stores-page">
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
        <div class="store-grid">
          @for (_ of skeletonItems; track $index) {                                                                      
            <p-skeleton height="150px" borderRadius="var(--card-border-radius, 12px)" />                                 
          }        
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
          <div class="store-grid">
            @for(store of stores(); track store.instanceId) {
              <app-store-card [name]="store.name" [storeType]="store.storeType">
                <p-button 
                  icon="pi pi-trash" 
                  [rounded]="true" 
                  [outlined]="true" 
                  severity="danger" 
                  ariaLabel="Delete store"
                  (onClick)="confirmRemove(store.instanceId, store.name)"
                   />
              </app-store-card>
            }
          </div>
        }
    </div>
  `,
  styles: `
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
      margin-top: 1.5rem;
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

    .store-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
  `,
})
export class UserStores {
  private storesService = inject(StoresService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  stores = this.storesService.getUserStores;
  loading = this.storesService.loading;
  error = this.storesService.error;

  dialog = viewChild.required(AddStoreDialog);

  skeletonItems = [1, 2];

  openAddDialog(): void {
    this.dialog().open();
  }

  addSelectedStore(instanceId: string): void {
    if (!instanceId) return;

    this.storesService.addStore(instanceId).subscribe({
      next: () => this.messageService.add({
        severity: 'success',
        summary: 'Store Added',
        detail: 'The store has been added to your list.'
      }),
      error: () => this.messageService.add({
        severity: 'error',
        summary: 'Failed to Add Store',
        detail: `${this.error()}`
      }),
    });
  }

  confirmRemove(instanceId: string, name: string): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to remove "${name}" from your stores?`,
      header: 'Remove Store',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.storesService.removeStore(instanceId).subscribe({
          next: () => this.messageService.add({
            severity: 'success',
            summary: 'Store Removed',
            detail: 'The store has been removed from your list.'
          }),
          error: () => this.messageService.add({
            severity: 'error',
            summary: 'Failed to Remove Store',
            detail: `${this.error()}`
          }),
        });
      }
    });
  }

  retry(): void {
    this.storesService.loadUserStores();
  }
}
