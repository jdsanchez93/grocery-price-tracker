import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Observable } from 'rxjs';
import { Auth0User, ROLES_CLAIM } from '../auth/auth.constants';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private user = toSignal(inject(AuthService).user$ as Observable<Auth0User | null>);

  isPowerUser = computed(() => {
    const roles = this.user()?.[ROLES_CLAIM] ?? [];
    return roles.includes('power_user') || roles.includes('admin');
  });

  isAdmin = computed(() => this.user()?.[ROLES_CLAIM]?.includes('admin') ?? false);
}
