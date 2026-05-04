import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guardia que protege las rutas privadas de la aplicación.
 * Verifica si el usuario está autenticado usando el AuthService.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirigir al login si no hay sesión
  router.navigate(['/login']);
  return false;
};
