import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "@auth0/auth0-angular";
import { map } from "rxjs";

export const roleGuard = (expectedRole: string) => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.user$.pipe(
      map(user => {
        const roles = user?.['https://jd-sanchez.com/roles'] ?? [];
        if (roles.includes(expectedRole)) return true;

        // Redirect unauthorized users
        return router.parseUrl('/unauthorized');
      })
    );
  };
};