import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { concatMap, filter, take } from 'rxjs';

/**
 * Auth0 error codes meaning the cached session can no longer mint tokens:
 * the refresh token expired or was revoked, and the iframe fallback found
 * no Auth0 session either. Anything else (network blips, a cancelled login,
 * `access_denied`) is left alone.
 */
const DEAD_SESSION_ERRORS = new Set([
  'login_required',
  'invalid_grant',
  'missing_refresh_token',
  'consent_required',
  'interaction_required',
]);

export function isDeadSessionError(error: unknown): boolean {
  const code = (error as { error?: unknown } | null)?.error;
  return typeof code === 'string' && DEAD_SESSION_ERRORS.has(code);
}

/**
 * With tokens cached in localStorage, the SDK treats "has a cached ID token"
 * as authenticated, so a dead refresh token leaves the app looking signed in
 * while every API call fails in the auth interceptor. When that happens,
 * clear the stale local session and send the user through Universal Login,
 * returning them to the page they were on.
 *
 * `take(1)` keeps a burst of concurrent failing requests from triggering
 * more than one redirect.
 */
export function provideAuthSessionRecovery(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const auth = inject(AuthService);
    const router = inject(Router);
    auth.error$
      .pipe(
        filter(isDeadSessionError),
        take(1),
        concatMap(() => auth.logout({ openUrl: false })),
        concatMap(() => auth.loginWithRedirect({ appState: { target: router.url } }))
      )
      .subscribe();
  });
}
