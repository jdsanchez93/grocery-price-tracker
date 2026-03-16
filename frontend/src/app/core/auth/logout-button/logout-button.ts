import { Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ButtonModule } from "primeng/button";

@Component({
  selector: 'app-logout-button',
  imports: [ButtonModule],
  template: `
    <p-button
      label="Log out"
      icon="pi pi-sign-out"
      [text]="true"
      (onClick)="logout()"
    />
  `,
})
export class LogoutButton {
  private auth = inject(AuthService);
  
  logout() {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
