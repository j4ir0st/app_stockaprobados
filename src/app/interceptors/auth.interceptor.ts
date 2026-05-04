import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor funcional para la gestión de autenticación JWT.
 * Añade el token Bearer a todas las peticiones dirigidas al proxy de la API.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token;

  // Solo interceptamos peticiones que van hacia nuestro proxy para evitar enviar tokens a dominios externos
  if (req.url.includes(window.location.origin) || req.url.startsWith('/api/') || req.url.includes('StockAprobado')) {
    let headers = req.headers;
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Clonar la petición con los nuevos headers
    const authReq = req.clone({ headers });

    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si recibimos un 401 Unauthorized, el token ha expirado o no es válido
        if (error.status === 401) {
          console.warn('Sesión expirada detectada por el interceptor');
          // Podríamos implementar refresco automático aquí, pero por ahora redirigimos al login
          authService.logout();
        }
        return throwError(() => error);
      })
    );
  }

  // Si no es una petición al proxy, continuar normalmente
  return next(req);
};
