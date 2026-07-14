import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { StatsWidget } from './widgets/stats-widget';
import { StoresWidget } from './widgets/stores-widget';
import { DepartmentWidget } from './widgets/department-widget';
import { StoresService } from '@/app/core/services/stores.service';
import { RoleService } from '@/app/core/services/role.service';
import { TopDealsWidget } from "./widgets/top-deals-widget/top-deals-widget";
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatsWidget, StoresWidget, DepartmentWidget, ButtonModule, RouterLink, TopDealsWidget, SkeletonModule],
  styles: `
    .empty-dashboard {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
    }

    .get-started-card {
      background: var(--surface-card);
      border-radius: 1rem;
      padding: 3rem 2.5rem;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    }

    .get-started-card i {
      font-size: 2.5rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }

    .get-started-card h2 {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--text-color);
    }

    .get-started-card p {
      color: var(--text-color-secondary);
      margin: 0 0 1.5rem;
    }
  `,
  template: `
    @if (hasStores()) {
      <div class="grid grid-cols-12 gap-8">
        @if (isPowerUser()) {
          <app-top-deals-widget class="col-span-12" />
        }
        <app-stats-widget class="contents" />
        <app-stores-widget class="col-span-12 xl:col-span-6" />
        <app-department-widget class="col-span-12 xl:col-span-6" />
      </div>
    } @else if (loading()) {
      <!-- Skeleton mirroring the widget grid while stores load -->
      <div class="grid grid-cols-12 gap-8" aria-busy="true" aria-label="Loading dashboard">
        @if (isPowerUser()) {
          <div class="col-span-12 card"><p-skeleton height="14rem" /></div>
        }
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="col-span-12 lg:col-span-6 xl:col-span-3 card mb-0"><p-skeleton height="5rem" /></div>
        }
        <div class="col-span-12 xl:col-span-6 card"><p-skeleton height="12rem" /></div>
        <div class="col-span-12 xl:col-span-6 card"><p-skeleton height="12rem" /></div>
      </div>
    } @else {
      <div class="empty-dashboard">
        <div class="get-started-card">
          <i class="pi pi-shop" aria-hidden="true"></i>
          <h2>No stores added yet</h2>
          <p>Add your first store to start tracking weekly deals and price history.</p>
          <p-button
            label="Get Started"
            icon="pi pi-arrow-right"
            iconPos="right"
            routerLink="/onboarding"
          />
        </div>
      </div>
    }
  `,
})
export class Dashboard {
  private storesService = inject(StoresService)
  protected isPowerUser = inject(RoleService).isPowerUser;

  loading = this.storesService.loading;
  hasStores = () => this.storesService.getUserStores().length > 0;
}
