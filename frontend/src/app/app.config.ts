import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withPreloading } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAuth0,authHttpInterceptorFn } from '@auth0/auth0-angular';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { environment } from '@/environments/environment';
import { MessageService } from 'primeng/api';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { SelectivePreloadStrategy } from './core/selective-preload.strategy';
import { provideChunkLoadRecovery } from './core/chunk-load-recovery';
import { provideAuthSessionRecovery } from './core/auth/session-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authHttpInterceptorFn, errorInterceptor])),
    // Preload commonly-visited lazy chunks (data: { preload: true }) in the
    // background right after bootstrap so slow connections don't stall
    // mid-navigation waiting for route bundles.
    provideRouter(routes, withPreloading(SelectivePreloadStrategy)),
    // After a deploy, tabs holding a stale index.html can 404 on lazy-route
    // chunks; this reloads once to pick up the fresh manifest.
    provideChunkLoadRecovery(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience,
        scope: 'openid profile email'
      },
      // Keep tokens across reloads, new tabs and browser restarts, and renew
      // them with a rotating refresh token (offline_access is added to the
      // scope automatically) instead of hidden-iframe silent auth, which needs
      // a live Auth0 session cookie and breaks under third-party cookie blocking.
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      // No cached refresh token (first visit after this change, or the API
      // isn't granting offline access): try iframe silent auth before giving up.
      useRefreshTokensFallback: true,
      // Lifetime of the SDK's "was signed in" hint cookie, which gates the
      // startup session check. Default is 1 day; match the Auth0 app's
      // maximum refresh token lifetime.
      sessionCheckExpiryDays: 30,
      httpInterceptor: {
        allowedList: [`${environment.apiUrl}/*`]
      }
    }),
    // Sends the user to Universal Login once the refresh token finally expires.
    provideAuthSessionRecovery(),
    MessageService
  ]
};
