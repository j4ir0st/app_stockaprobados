import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { authInterceptor } from './interceptors/auth.interceptor';

/**
 * Configuración global de la aplicación.
 * Se utiliza provideAppInitializer (v18+) para cargar la configuración de forma reactiva.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideAppInitializer(() => inject(ConfigService).loadConfig())
  ]
};

