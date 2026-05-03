import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAuth0,authHttpInterceptorFn } from '@auth0/auth0-angular';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { environment } from '@/environments/environment';
import { MessageService } from 'primeng/api';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authHttpInterceptorFn, errorInterceptor])),
    provideRouter(routes),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience,
        scope: 'openid profile email'
      },
      httpInterceptor: {
        allowedList: [`${environment.apiUrl}/*`]
      }
    }),
    MessageService
  ]
};
