import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-logout-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  template: `
    <p-button
      label="Log out"
      icon="pi pi-sign-out"
      [text]="true"
      (onClick)="logout()"
    />
  `
})
export class LogoutButtonComponent {
  private auth = inject(AuthService);

  logout() {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
