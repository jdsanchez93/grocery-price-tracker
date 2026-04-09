import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { StatsWidget } from './widgets/stats-widget';
import { StoresWidget } from './widgets/stores-widget';
import { DepartmentWidget } from './widgets/department-widget';
import { StoresService } from '@/app/core/services/stores.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatsWidget, StoresWidget, DepartmentWidget, ButtonModule, RouterLink],
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
        <app-stats-widget class="contents" />
        <app-stores-widget class="col-span-12 xl:col-span-6" />
        <app-department-widget class="col-span-12 xl:col-span-6" />
      </div>
    } @else if (!loading()) {
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
  private storesService = inject(StoresService);

  loading = this.storesService.loading;
  hasStores = () => this.storesService.getUserStores().length > 0;
}
