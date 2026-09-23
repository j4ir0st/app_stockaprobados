import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, User } from '../interfaces/auth.interface';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private configService = inject(ConfigService);

  // Señales reactivas para el estado del usuario
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor() {
    this.checkSession();
  }

  /**
   * Obtiene el token de acceso desde el almacenamiento local.
   */
  get token(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Intenta iniciar sesión con las credenciales proporcionadas.
   * Utiliza el endpoint '/api-proxy/api/token/' configurado en el proxy.
   */
  async login(username: string, password: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.configService.apiUrl()}api/token/`, { username, password })
      );

      if (response && response.access) {
        this.saveSession(response);
      }
    } catch (error) {
      console.error('Error en AuthService.login:', error);
      throw error;
    }
  }

  /**
   * Cierra la sesión y limpia el almacenamiento local.
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');

    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    this.router.navigate(['/login']);
  }

  /**
   * Guarda la sesión en el almacenamiento local y actualiza las señales.
   */
  private saveSession(data: AuthResponse): void {
    console.log('Saving session with data:', data);

    // Corregir ruta del avatar usando la variable API_URL para evitar hardcodeo de dominios
    if (data.user.avatar && !data.user.avatar.startsWith('http')) {
      const avatarPath = data.user.avatar.startsWith('/') ? data.user.avatar : `/${data.user.avatar}`;
      data.user.avatar = `${avatarPath}`;
    }

    localStorage.setItem('token', data.access);
    localStorage.setItem('refresh', data.refresh);
    localStorage.setItem('user', JSON.stringify(data.user));

    this.currentUser.set(data.user);
    this.isAuthenticated.set(true);
  }

  /**
   * Verifica si existe una sesión activa al iniciar el servicio.
   */
  private checkSession(): void {
    try {
      const userJson = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      // Solo intentar parsear si ambos existen y no son "undefined" (string)
      if (userJson && userJson !== 'undefined' && token) {
        const user = JSON.parse(userJson);
        if (user) {
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
        }
      }
    } catch (error) {
      console.error('Error recuperando sesión:', error);
      this.logout(); // Limpiar datos corruptos
    }
  }

  /**
   * Determina si el usuario pertenece al área de Distribución.
   * @param user Objeto de usuario opcional (usa currentUser() por defecto).
   */
  esUsuarioDistribucion(user?: User | null): boolean {
    const usuario = user !== undefined ? user : this.currentUser();
    if (!usuario) return false;
    const areaId = (usuario.area_id || '').toString();
    const area = (usuario.area || '').toString();
    const normalize = (str: string) =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return normalize(areaId) === 'distribucion' || normalize(area) === 'distribucion';
  }

  /**
   * Obtiene el ID numérico del usuario actual, buscando en currentUser() o decodificando el token JWT.
   */
  getUserId(): number | null {
    const user = this.currentUser();
    if (user && (user as any).id) return Number((user as any).id);
    if (user && (user as any).pk) return Number((user as any).pk);
    if (user && (user as any).user_id) return Number((user as any).user_id);

    const token = this.token;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length > 1) {
          const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson);
          if (payload.user_id) return Number(payload.user_id);
          if (payload.id) return Number(payload.id);
        }
      } catch (e) {
        console.warn('No se pudo decodificar el token JWT para obtener el user_id:', e);
      }
    }
    return null;
  }
}
