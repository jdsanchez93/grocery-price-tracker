import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "@auth0/auth0-angular";
import { map } from "rxjs";
import { Auth0User, UserRole, ROLES_CLAIM } from "./auth.constants";

/**
 * Route guard that requires the user to have at least one of the specified roles.
 * Redirects to /unauthorized if none match.
 */
export const roleGuard = (...expectedRoles: UserRole[]) => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.user$.pipe(
      map(user => {
        const roles = (user as Auth0User | null | undefined)?.[ROLES_CLAIM] ?? [];
        if (expectedRoles.some(role => roles.includes(role))) return true;

        return router.parseUrl('/unauthorized');
      })
    );
  };
};