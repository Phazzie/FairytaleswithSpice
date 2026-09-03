import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { accountCredentialsInterceptor } from './account-credentials.interceptor';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([accountCredentialsInterceptor])),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
