import { Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ButtonModule } from "primeng/button";

@Component({
  selector: 'app-login-button',
  imports: [ButtonModule],
  template: `
    <p-button
      label="Log in"
      icon="pi pi-sign-in"
      [text]="true"
      (onClick)="login()"
    />
  `,
})
export class LoginButton {
  private auth = inject(AuthService);

  login() {
    this.auth.loginWithRedirect();
  }
}
