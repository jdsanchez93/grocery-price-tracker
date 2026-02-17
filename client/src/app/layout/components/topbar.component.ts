import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LayoutService } from '../services/layout.service';
import { AuthButtonsComponent } from '../../core/components/auth/auth-buttons.component';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, CommonModule, AuthButtonsComponent],
  template: `
    <div class="layout-topbar">
      <div class="layout-topbar-logo-container">
        <button
          class="layout-menu-button layout-topbar-action"
          (click)="layoutService.onMenuToggle()"
          aria-label="Toggle menu"
        >
          <i class="pi pi-bars"></i>
        </button>
        <a class="layout-topbar-logo" routerLink="/">
          <i class="pi pi-shopping-cart" style="font-size: 1.5rem; color: var(--primary-color)"></i>
          <span>Grocery Tracker</span>
        </a>
      </div>

      <div class="layout-topbar-actions">
        <div class="layout-config-menu">
          <button
            type="button"
            class="layout-topbar-action"
            (click)="toggleDarkMode()"
            [attr.aria-label]="layoutService.isDarkTheme() ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <i [class]="layoutService.isDarkTheme() ? 'pi pi-sun' : 'pi pi-moon'"></i>
          </button>
        </div>
        <app-auth-buttons />
      </div>
    </div>
  `
})
export class TopbarComponent {
  layoutService = inject(LayoutService);

  toggleDarkMode() {
    this.layoutService.layoutConfig.update((state) => ({
      ...state,
      darkTheme: !state.darkTheme
    }));
  }
}
