import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-unauthorized',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, RouterModule, AsyncPipe],
  template: `
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-screen overflow-hidden">
      <div class="flex flex-col items-center justify-center">
        <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, rgba(247, 149, 48, 0.4) 10%, rgba(247, 149, 48, 0) 30%)">
          <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20 flex flex-col items-center" style="border-radius: 53px">
            <div class="gap-4 flex flex-col items-center">
              <div class="flex justify-center items-center border-2 border-orange-500 rounded-full" style="width: 3.2rem; height: 3.2rem">
                <i class="text-orange-500 pi pi-fw pi-lock text-2xl!" aria-hidden="true"></i>
              </div>
              <h1 class="text-surface-900 dark:text-surface-0 font-bold text-4xl lg:text-5xl mb-2">Access Denied</h1>
              <span class="text-muted-color mb-8">You do not have the necessary permissions to view this page.</span>
              <div class="mt-8 flex gap-3">
                <p-button label="Go to Dashboard" routerLink="/dashboard" severity="warn" />
                @if (!(auth.isAuthenticated$ | async)) {
                  <p-button label="Sign In" icon="pi pi-sign-in" [text]="true" (onClick)="login()" />
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Unauthorized {
  auth = inject(AuthService);

  login(): void {
    this.auth.loginWithRedirect({ appState: { target: '/dashboard' } });
  }
}
