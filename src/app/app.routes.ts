import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';

import { authGuard } from './guards/auth.guard';

/**
 * Configuración de rutas de la aplicación.
 * Se utiliza carga perezosa (lazy loading) para optimizar el rendimiento.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/inventory/inventory').then(m => m.InventoryComponent)
  },
  {
    path: '**',
    redirectTo: 'inventory'
  }
];
