import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DealsService } from '../../core/services/deals.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule],
  template: `
    <div class="grid">
      <div class="col-12">
        <h1>Welcome to Grocery Price Tracker</h1>
        <p class="text-secondary">Track and compare grocery deals from your favorite stores.</p>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <p-card>
          <div class="flex flex-column align-items-center">
            <span class="text-4xl font-bold text-primary">{{ totalDeals() }}</span>
            <span class="text-secondary mt-2">Total Deals</span>
          </div>
        </p-card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <p-card>
          <div class="flex flex-column align-items-center">
            <span class="text-4xl font-bold text-primary">{{ storeCount() }}</span>
            <span class="text-secondary mt-2">Stores Tracked</span>
          </div>
        </p-card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <p-card>
          <div class="flex flex-column align-items-center">
            <span class="text-4xl font-bold text-primary">{{ departmentCount() }}</span>
            <span class="text-secondary mt-2">Departments</span>
          </div>
        </p-card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <p-card>
          <div class="flex flex-column align-items-center">
            <span class="text-4xl font-bold text-primary">{{ loyaltyDeals() }}</span>
            <span class="text-secondary mt-2">Loyalty Deals</span>
          </div>
        </p-card>
      </div>

      <div class="col-12 mt-4">
        <p-card header="Quick Actions">
          <div class="flex gap-3 flex-wrap">
            <a routerLink="/deals" class="no-underline">
              <p-button label="Browse Deals" icon="pi pi-tag" />
            </a>
          </div>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    h1 {
      margin-bottom: 0.5rem;
    }

    .text-secondary {
      color: var(--text-color-secondary);
    }

    .text-primary {
      color: var(--primary-color);
    }
  `]
})
export class DashboardComponent {
  private dealsService = inject(DealsService);

  totalDeals = computed(() => this.dealsService.getDeals().length);
  storeCount = computed(() => this.dealsService.getStoreInstanceIds().length);
  departmentCount = computed(() => this.dealsService.getDepartments().length);
  loyaltyDeals = computed(() =>
    this.dealsService.getDeals().filter(d => d.loyalty).length
  );
}
