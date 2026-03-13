import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { CardModule } from "primeng/card";
import { AuthButtons } from "@/app/core/auth/auth-buttons/auth-buttons";
import { Auth0User, ROLES_CLAIM } from '@/app/core/auth/auth.constants';

@Component({
  selector: 'app-profile',
  imports: [CardModule, AuthButtons],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [style]="{ width: '25rem', overflow: 'hidden' }">
      <ng-template #title>{{user()?.name}}</ng-template>
      <ng-template #subtitle>{{role()}}</ng-template>
      <ng-template #footer>
          <app-auth-buttons />
      </ng-template>
    </p-card>
  `,
  styles: ``,
})
export class Profile {
  #auth = inject(AuthService);
  user = toSignal(this.#auth.user$) as Signal<Auth0User | null | undefined>;
  role = computed(() => (this.user()?.[ROLES_CLAIM] ?? []).join(', '));
}
