import { ApplicationConfig, ErrorHandler, isDevMode, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';
import { GlobalErrorHandler } from './global-error-handler';
import { PROVING_GROUNDS_DEV_MODE_CHECK } from './proving-grounds-access.guard';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: PROVING_GROUNDS_DEV_MODE_CHECK, useValue: isDevMode }
  ]
};
