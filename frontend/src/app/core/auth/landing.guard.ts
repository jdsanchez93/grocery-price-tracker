import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap, map, catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { ProfileService } from '@/app/core/services/profile.service';

export const landingGuard = () => {
  const auth = inject(AuthService);
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return auth.isAuthenticated$.pipe(
    take(1),
    switchMap(isAuthenticated => {
      if (!isAuthenticated) return of(true as const);
      return profileService.loadProfile().pipe(
        map(profile => router.parseUrl(profile.onboarded ? '/dashboard' : '/onboarding')),
        catchError(() => of(router.parseUrl('/dashboard')))
      );
    })
  );
};
