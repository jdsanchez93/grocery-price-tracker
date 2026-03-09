import { Routes } from '@angular/router';
import { AppLayout } from './layout/component/app.layout';

export const routes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [
            // { path: '', component: Dashboard },
            { path: 'deals', loadChildren: () => import('./pages/deals/deals.routes') },
            { path: 'user/stores', loadComponent: () => import('./pages/stores/user-stores/user-stores').then(m => m.UserStores) }
        ]
    }
];