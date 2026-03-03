import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/components/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'deals',
        loadComponent: () =>
          import('./pages/deals/deals.component').then(m => m.DealsComponent)
      },
      {
        path: 'stores',
        loadComponent: () =>
          import('./pages/stores/stores.component').then(m => m.StoresComponent)
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./pages/scrape-management/scrape-management').then(m => m.ScrapeManagement)
      }
    ]
  }
];
