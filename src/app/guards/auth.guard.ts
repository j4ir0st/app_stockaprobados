import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guardia que protege las rutas privadas de la aplicación.
 * Verifica si el usuario está autenticado usando el AuthService.
 */
export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // Si el usuario es de Distribución, solo puede acceder a Equipos VAC (typeKey=VAC)
    if (authService.esUsuarioDistribucion()) {
      if (route.queryParams['typeKey'] !== 'VAC') {
        return router.createUrlTree(['/inventory'], { queryParams: { typeKey: 'VAC' } });
      }
    }
    return true;
  }

  // Redirigir al login si no hay sesión
  router.navigate(['/login']);
  return false;
};
