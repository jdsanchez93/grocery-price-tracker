import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-login-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    <p-button
      label="Log in"
      icon="pi pi-sign-in"
      [text]="true"
      (onClick)="login()"
    />
  `
})
export class LoginButtonComponent {
  private auth = inject(AuthService);

  login() {
    this.auth.loginWithRedirect();
  }
}
