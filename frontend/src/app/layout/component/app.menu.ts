import { Component, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { MenuItem } from 'primeng/api';
import { Auth0User, ROLES_CLAIM } from '@/app/core/auth/auth.constants';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    imports: [AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul>`,
})
export class AppMenu {
    private user = toSignal(inject(AuthService).user$) as Signal<Auth0User | null | undefined>;
    private isAdmin = computed(() =>
        (this.user()?.[ROLES_CLAIM] ?? []).includes('admin')
    );

    model = computed<MenuItem[]>(() => [
        {
            label: 'Home',
            items: [
                { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'] },
                { label: 'Current Deals', icon: 'pi pi-fw pi-tag', routerLink: ['/deals/current-deals'] },
            ]
        },
        {
            label: 'User',
            path: '/user',
            items: [
                { label: 'Profile', icon: 'pi pi-fw pi-user', routerLink: ['/user/profile'] },
                { label: 'My Stores', icon: 'pi pi-fw pi-shop', routerLink: ['/user/stores'] },
            ]
        },
        ...(this.isAdmin() ? [{
            label: 'Admin',
            path: '/admin',
            items: [
                { label: 'Scrape', icon: 'pi pi-fw pi-download', routerLink: ['/admin/scrape-management'] },
                { label: 'Configure Stores', icon: 'pi pi-fw pi-address-book', routerLink: ['/admin/configure-stores'] },
            ]
        }] : [])
    ]);
}
