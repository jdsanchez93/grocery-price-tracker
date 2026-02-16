import { Component, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from './topbar.component';
import { SidebarComponent } from './sidebar.component';
import { FooterComponent } from './footer.component';
import { LayoutService } from '../services/layout.service';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TopbarComponent, SidebarComponent, RouterModule, FooterComponent],
  template: `
    <div class="layout-wrapper" [class]="containerClass()">
      <app-topbar />
      <app-sidebar />
      <div class="layout-main-container">
        <div class="layout-main">
          <router-outlet />
        </div>
        <app-footer />
      </div>
      <div class="layout-mask" (click)="onMaskClick()"></div>
    </div>
  `
})
export class LayoutComponent {
  private layoutService = inject(LayoutService);

  constructor() {
    effect(() => {
      const state = this.layoutService.layoutState();
      if (state.mobileMenuActive) {
        document.body.classList.add('blocked-scroll');
      } else {
        document.body.classList.remove('blocked-scroll');
      }
    });
  }

  containerClass = computed(() => {
    const config = this.layoutService.layoutConfig();
    const state = this.layoutService.layoutState();
    return {
      'layout-overlay': config.menuMode === 'overlay',
      'layout-static': config.menuMode === 'static',
      'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
      'layout-overlay-active': state.overlayMenuActive,
      'layout-mobile-active': state.mobileMenuActive
    };
  });

  onMaskClick() {
    this.layoutService.layoutState.update((val) => ({
      ...val,
      overlayMenuActive: false,
      mobileMenuActive: false
    }));
  }
}
