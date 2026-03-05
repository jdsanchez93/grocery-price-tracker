import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
})
export class AppMenu {
    model: MenuItem[] = [];

    ngOnInit() {
        this.model = [
            {
                label: 'Home',
                items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'] }]
            },
            {
                label: 'Browse',
                items: [
                    { label: 'Current Deals', icon: 'pi pi-fw pi-tag', routerLink: ['/deals/current-deals'] },
                    { label: 'Deal History', icon: 'pi pi-fw pi-history', routerLink: ['/deals/history'] },
                    { label: 'Deal Search', icon: 'pi pi-fw pi-search', routerLink: ['/deals/search'] },
                ]
            },
            {
                label: 'User',
                icon: 'pi pi-fw pi-briefcase',
                path: '/user',
                items: [
                    {
                        label: 'Profile',
                        icon: 'pi pi-fw pi-user',
                        routerLink: ['/user/profile']
                    },
                    {
                        label: 'My Stores',
                        icon: 'pi pi-fw pi-shop',
                        routerLink: ['/user/stores']
                    }
                ]
            },
            {
                label: 'Admin',
                path: '/admin',
                items: [
                    {
                        label: 'Scrape',
                        icon: 'pi pi-fw pi-download',
                        routerLink: ['/admin/scrape-management']
                    },
                    {
                        label: 'Configure Stores',
                        icon: 'pi pi-fw pi-address-book',
                        routerLink: ['/admin/store-management']
                    }
                ]
            }
        ];
    }
}
