import { Component, inject, ChangeDetectionStrategy, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DealsService } from '../../core/services/deals.service';
import { Deal, getStoreDisplayName } from '../../core/models/deal.model';

interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-deals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    IconFieldModule,
    InputIconModule
  ],
  template: `
    <div class="card">
      <h2>Deals</h2>

      <p-table
        #dt
        [value]="deals()"
        [loading]="loading()"
        [paginator]="true"
        [rows]="10"
        [rowsPerPageOptions]="[10, 25, 50]"
        [globalFilterFields]="['name', 'details', 'dept', 'priceDisplay']"
        [tableStyle]="{ 'min-width': '75rem' }"
        responsiveLayout="stack"
        [breakpoint]="'960px'"
        dataKey="dealId"
      >
        <ng-template #caption>
          <div class="flex flex-wrap gap-3 align-items-center justify-content-between">
            <p-iconfield>
              <p-inputicon styleClass="pi pi-search" />
              <input
                pInputText
                type="text"
                placeholder="Search deals..."
                (input)="onGlobalFilter($event)"
              />
            </p-iconfield>

            <div class="flex gap-3 flex-wrap">
              <p-select
                [options]="storeOptions()"
                [(ngModel)]="selectedStore"
                placeholder="All Stores"
                [showClear]="true"
                (onChange)="onStoreFilter()"
                styleClass="w-full md:w-auto"
              />

              <p-select
                [options]="departmentOptions()"
                [(ngModel)]="selectedDepartment"
                placeholder="All Departments"
                [showClear]="true"
                (onChange)="onDepartmentFilter()"
                styleClass="w-full md:w-auto"
              />
            </div>
          </div>
        </ng-template>

        <ng-template #header>
          <tr>
            <th style="width: 3rem"></th>
            <th pSortableColumn="name" style="min-width: 200px">
              Product <p-sortIcon field="name" />
            </th>
            <th pSortableColumn="storeInstanceId" style="min-width: 150px">
              Store <p-sortIcon field="storeInstanceId" />
            </th>
            <th pSortableColumn="dept" style="min-width: 120px">
              Department <p-sortIcon field="dept" />
            </th>
            <th pSortableColumn="priceNumber" style="min-width: 100px">
              Price <p-sortIcon field="priceNumber" />
            </th>
            <th style="min-width: 100px">Quantity</th>
            <th style="min-width: 120px">Loyalty</th>
          </tr>
        </ng-template>

        <ng-template #body let-deal let-expanded="expanded">
          <tr>
            <td>
              @if (deal.priceVariants?.length > 1) {
                <p-button
                  type="button"
                  [pRowToggler]="deal"
                  [text]="true"
                  [rounded]="true"
                  [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                  [attr.aria-label]="expanded ? 'Collapse variants' : 'Expand variants'"
                />
              }
            </td>
            <td>
              <span class="p-column-title">Product</span>
              <div>
                <strong>{{ deal.name || 'Unknown Product' }}</strong>
                @if (deal.details) {
                  <div class="text-sm text-secondary">{{ deal.details }}</div>
                }
              </div>
            </td>
            <td>
              <span class="p-column-title">Store</span>
              {{ getStoreName(deal.storeInstanceId) }}
            </td>
            <td>
              <span class="p-column-title">Department</span>
              {{ deal.dept }}
            </td>
            <td>
              <span class="p-column-title">Price</span>
              <strong class="text-primary">{{ deal.priceDisplay }}</strong>
            </td>
            <td>
              <span class="p-column-title">Quantity</span>
              @if (deal.quantity > 1) {
                {{ deal.quantity }}
              } @else {
                -
              }
            </td>
            <td>
              <span class="p-column-title">Loyalty</span>
              @if (deal.loyalty) {
                <p-tag [value]="deal.loyalty" severity="info" />
              } @else {
                -
              }
            </td>
          </tr>
        </ng-template>

        <ng-template #expandedrow let-deal>
          <tr>
            <td colspan="7">
              <div class="variant-container">
                <table class="variant-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of deal.priceVariants; track variant.price) {
                      <tr>
                        <td>{{ variant.example }}</td>
                        <td>
                          {{ variant.price | currency }}
                          @if (variant.perLb) {
                            <span class="text-sm text-secondary">
                              ({{ variant.perLb | currency }}/lb, ~{{ variant.avgWeight }}lb avg)
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="7" class="text-center p-4">
              No deals found. Try adjusting your filters.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .card {
      background: var(--surface-card);
      border-radius: var(--border-radius);
      padding: 1.5rem;
    }

    h2 {
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .text-secondary {
      color: var(--text-color-secondary);
    }

    .text-primary {
      color: var(--primary-color);
    }

    .text-sm {
      font-size: 0.875rem;
    }

    /* Hide column titles on desktop - only show in stacked/mobile mode */
    :host ::ng-deep .p-datatable-tbody > tr > td > .p-column-title {
      display: none;
    }

    :host ::ng-deep .p-datatable-stacked-tbody > tr > td > .p-column-title {
      display: block;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .variant-container {
      padding: 0.5rem 1rem 0.5rem 3rem;
    }

    .variant-table {
      width: 100%;
      max-width: 500px;
      border-collapse: collapse;
    }

    .variant-table th,
    .variant-table td {
      padding: 0.4rem 0.75rem;
      text-align: left;
    }

    .variant-table th {
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--text-color-secondary);
      border-bottom: 1px solid var(--surface-border);
    }

    .variant-table td {
      font-size: 0.875rem;
      border-bottom: 1px solid var(--surface-border);
    }
  `]
})
export class DealsComponent {
  private dealsService = inject(DealsService);
  private table = viewChild<Table>('dt');

  loading = this.dealsService.loading;
  selectedStore = signal<string | null>(null);
  selectedDepartment = signal<string | null>(null);

  private allDeals = this.dealsService.getDeals;

  deals = computed(() => {
    let result = this.allDeals();

    const store = this.selectedStore();
    if (store) {
      result = result.filter(d => d.storeInstanceId === store);
    }

    const dept = this.selectedDepartment();
    if (dept) {
      result = result.filter(d => d.dept === dept);
    }

    return result;
  });

  storeOptions = computed<FilterOption[]>(() => {
    return this.dealsService.getStoreOptions();
  });

  departmentOptions = computed<FilterOption[]>(() => {
    return this.dealsService.getDepartmentOptions();
  });

  getStoreName(instanceId: string): string {
    return getStoreDisplayName(instanceId);
  }

  onGlobalFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    const table = this.table();
    if (table) {
      table.filterGlobal(input.value, 'contains');
    }
  }

  onStoreFilter() {
    // Filtering is handled reactively through the deals() computed
  }

  onDepartmentFilter() {
    // Filtering is handled reactively through the deals() computed
  }
}
