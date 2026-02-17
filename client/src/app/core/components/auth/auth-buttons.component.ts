import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '@auth0/auth0-angular';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LoginButtonComponent } from './login-button.component';
import { LogoutButtonComponent } from './logout-button.component';

@Component({
  selector: 'app-auth-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, ProgressSpinnerModule, LoginButtonComponent, LogoutButtonComponent],
  template: `
    @if (auth.isLoading$ | async) {
      <p-progressSpinner
        strokeWidth="4"
        [style]="{ width: '24px', height: '24px' }"
        ariaLabel="Loading authentication"
      />
    } @else if (auth.isAuthenticated$ | async) {
      <app-logout-button />
    } @else {
      <app-login-button />
    }
  `
})
export class AuthButtonsComponent {
  auth = inject(AuthService);
}
