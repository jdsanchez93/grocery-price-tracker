import { Routes } from '@angular/router';
import { AppLayout } from './layout/component/app.layout';
import { AuthGuard } from '@auth0/auth0-angular';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            { path: '', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
            { path: 'deals', loadChildren: () => import('./pages/deals/deals.routes') },
            { path: 'user/stores', loadComponent: () => import('./pages/stores/user-stores/user-stores').then(m => m.UserStores) },
            {
                path: 'admin',
                loadChildren: () => import('./pages/admin/admin.routes'),
                canActivate: [AuthGuard, roleGuard('admin')]
            }
        ]
    },
    {
        path: 'unauthorized',
        loadComponent: () => import('./core/auth/unauthorized/unauthorized').then(m => m.Unauthorized)
    }
];