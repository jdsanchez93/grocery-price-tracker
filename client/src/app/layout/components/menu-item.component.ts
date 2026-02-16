import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RippleModule } from 'primeng/ripple';
import { LayoutService } from '../services/layout.service';
import { filter } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';

@Component({
  selector: '[app-menuitem]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, RippleModule],
  template: `
    @if (root() && isVisible()) {
      <div class="layout-menuitem-root-text">{{ item().label }}</div>
    }
    @if ((!hasRouterLink() || hasChildren()) && isVisible()) {
      <a
        [attr.href]="item().url"
        (click)="itemClick($event)"
        [attr.target]="item().target"
        tabindex="0"
        pRipple
      >
        <i [class]="item().icon" class="layout-menuitem-icon"></i>
        <span class="layout-menuitem-text">{{ item().label }}</span>
        @if (hasChildren()) {
          <i class="pi pi-fw pi-angle-down layout-submenu-toggler"></i>
        }
      </a>
    }
    @if (hasRouterLink() && !hasChildren() && isVisible()) {
      <a
        (click)="itemClick($event)"
        [routerLink]="item().routerLink"
        routerLinkActive="active-route"
        [routerLinkActiveOptions]="item().routerLinkActiveOptions || { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"
        [fragment]="item().fragment"
        [queryParamsHandling]="item().queryParamsHandling"
        [preserveFragment]="item().preserveFragment ?? false"
        [skipLocationChange]="item().skipLocationChange ?? false"
        [replaceUrl]="item().replaceUrl ?? false"
        [state]="item().state"
        [queryParams]="item().queryParams"
        [attr.target]="item().target"
        tabindex="0"
        pRipple
      >
        <i [class]="item().icon" class="layout-menuitem-icon"></i>
        <span class="layout-menuitem-text">{{ item().label }}</span>
        @if (hasChildren()) {
          <i class="pi pi-fw pi-angle-down layout-submenu-toggler"></i>
        }
      </a>
    }
    @if (hasChildren() && isVisible() && (root() || isActive())) {
      <ul [class.layout-root-submenulist]="root()">
        @for (child of item().items; track child?.label) {
          <li app-menuitem [item]="child" [parentPath]="fullPath()" [root]="false" [class]="child['badgeClass']"></li>
        }
      </ul>
    }
  `,
  host: {
    '[class.active-menuitem]': 'isActive()',
    '[class.layout-root-menuitem]': 'root()'
  }
})
export class MenuItemComponent {
  private layoutService = inject(LayoutService);
  private router = inject(Router);

  item = input<MenuItem>({} as MenuItem);
  root = input<boolean>(false);
  parentPath = input<string | null>(null);

  isVisible = computed(() => this.item()?.visible !== false);

  hasChildren = computed(() => {
    const items = this.item()?.items;
    return items && items.length > 0;
  });

  hasRouterLink = computed(() => !!this.item()?.routerLink);

  fullPath = computed(() => {
    const itemPath = (this.item() as any)?.path;
    if (!itemPath) return this.parentPath();
    const parent = this.parentPath();
    if (parent && !itemPath.startsWith(parent)) {
      return parent + itemPath;
    }
    return itemPath;
  });

  isActive = computed(() => {
    const activePath = this.layoutService.layoutState().activePath;
    const itemPath = (this.item() as any)?.path;
    if (itemPath) {
      return activePath?.startsWith(this.fullPath() ?? '') ?? false;
    }
    return false;
  });

  initialized = signal<boolean>(false);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (this.item()?.routerLink) {
        this.updateActiveStateFromRoute();
      }
    });
  }

  ngOnInit() {
    if (this.item()?.routerLink) {
      this.updateActiveStateFromRoute();
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initialized.set(true);
    });
  }

  updateActiveStateFromRoute() {
    const item = this.item();
    if (!item?.routerLink) return;

    const routerLink = item.routerLink;
    const linkPath = Array.isArray(routerLink) ? routerLink[0] : routerLink;

    const isRouteActive = this.router.isActive(linkPath, {
      paths: 'exact',
      queryParams: 'ignored',
      matrixParams: 'ignored',
      fragment: 'ignored'
    });

    if (isRouteActive) {
      const parentPath = this.parentPath();
      if (parentPath) {
        this.layoutService.layoutState.update((val) => ({
          ...val,
          activePath: parentPath
        }));
      }
    }
  }

  itemClick(event: Event) {
    const item = this.item();

    if (item?.disabled) {
      event.preventDefault();
      return;
    }

    if (item?.command) {
      item.command({ originalEvent: event, item: item });
    }

    if (this.hasChildren()) {
      if (this.isActive()) {
        this.layoutService.layoutState.update((val) => ({
          ...val,
          activePath: this.parentPath()
        }));
      } else {
        this.layoutService.layoutState.update((val) => ({
          ...val,
          activePath: this.fullPath(),
          menuHoverActive: true
        }));
      }
    } else {
      this.layoutService.layoutState.update((val) => ({
        ...val,
        overlayMenuActive: false,
        staticMenuMobileActive: false,
        mobileMenuActive: false,
        menuHoverActive: false
      }));
    }
  }
}
