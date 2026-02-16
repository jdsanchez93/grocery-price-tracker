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
      }
    ]
  }
];
