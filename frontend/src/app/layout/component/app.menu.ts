import { Component, computed, inject, Signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { RoleService } from '@/app/core/services/role.service';

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
    private roles = inject(RoleService);

    model = computed<MenuItem[]>(() => [
        {
            label: 'Home',
            items: [
                { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] },
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
        ...(this.roles.isAdmin() ? [{
            label: 'Admin',
            path: '/admin',
            items: [
                { label: 'Scrape', icon: 'pi pi-fw pi-download', routerLink: ['/admin/scrape-management'] },
                { label: 'Configure Stores', icon: 'pi pi-fw pi-address-book', routerLink: ['/admin/configure-stores'] },
                { label: 'Deals Editor', icon: 'pi pi-fw pi-database', routerLink: ['/admin/edit-deals'] }
            ]
        }] : [])
    ]);
}
