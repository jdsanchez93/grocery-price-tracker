import { Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { AsyncPipe } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LogoutButton } from "../logout-button/logout-button";
import { LoginButton } from "../login-button/login-button";

@Component({
  selector: 'app-auth-buttons',
  imports: [AsyncPipe, ProgressSpinnerModule, LogoutButton, LoginButton],
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
  `,
})
export class AuthButtons {
  auth = inject(AuthService);
}
