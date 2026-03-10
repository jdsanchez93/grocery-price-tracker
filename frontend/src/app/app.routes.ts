import { Routes } from '@angular/router';
import { AppLayout } from './layout/component/app.layout';

export const routes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            { path: '', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
            { path: 'deals', loadChildren: () => import('./pages/deals/deals.routes') },
            { path: 'user/stores', loadComponent: () => import('./pages/stores/user-stores/user-stores').then(m => m.UserStores) }
        ]
    },
    {
        path: 'unauthorized',
        loadComponent: () => import('./core/auth/unauthorized/unauthorized').then(m => m.Unauthorized)
    }
];