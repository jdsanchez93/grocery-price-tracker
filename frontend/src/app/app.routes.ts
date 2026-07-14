import { Routes } from '@angular/router';
import { AppLayout } from './layout/component/app.layout';
import { AuthGuard } from '@auth0/auth0-angular';
import { roleGuard } from './core/auth/role.guard';
import { landingGuard } from './core/auth/landing.guard';
import { Landing } from './pages/landing/landing';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        canActivate: [landingGuard],
        component: Landing
    },
    {
        path: '',
        component: AppLayout,
        canActivate: [AuthGuard],
        children: [
            // Eagerly loaded: the post-auth landing spot. Bundling it into main
            // means the guard-resolved redirect renders with no chunk wait.
            { path: 'dashboard', component: Dashboard },
            { path: 'deals', data: { preload: true }, loadChildren: () => import('./pages/deals/deals.routes') },
            { path: 'user/stores', loadComponent: () => import('./pages/stores/user-stores/user-stores').then(m => m.UserStores) },
            { path: 'user/profile', loadComponent: () => import('./pages/user/profile/profile').then(m => m.Profile) },
            { path: 'analytics/products/:id/history', loadComponent: () => import('./pages/analytics/product-history/product-history').then(m => m.ProductHistory), canActivate: [roleGuard('power_user', 'admin')] },
            {
                path: 'admin',
                loadChildren: () => import('./pages/admin/admin.routes'),
                canActivate: [roleGuard('admin')]
            }
        ]
    },
    {
        path: 'onboarding',
        canActivate: [AuthGuard],
        loadComponent: () => import('./pages/onboarding/onboarding').then(m => m.Onboarding)
    },
    {
        path: 'unauthorized',
        loadComponent: () => import('./core/auth/unauthorized/unauthorized').then(m => m.Unauthorized)
    }
];
