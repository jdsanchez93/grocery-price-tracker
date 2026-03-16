import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "@auth0/auth0-angular";
import { map } from "rxjs";
import { Auth0User, ROLES_CLAIM } from "./auth.constants";

export const roleGuard = (expectedRole: string) => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.user$.pipe(
      map(user => {
        const roles = (user as Auth0User | null | undefined)?.[ROLES_CLAIM] ?? [];
        if (roles.includes(expectedRole)) return true;

        // Redirect unauthorized users
        return router.parseUrl('/unauthorized');
      })
    );
  };
};