import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  // Usamos el patrón de proxy inverso para mayor seguridad y consistencia
  // Tanto Nginx como Angular Proxy redirigirán '/api-proxy/' al backend real
  private readonly apiBase = signal(window.location.origin + '/');

  /**
   * Expone la URL base de la API.
   */
  public readonly API_URL = this.apiBase;

  /**
   * Obtiene la señal con la URL base de la API.
   */
  apiUrl() {
    return this.apiBase();
  }

  /**
   * Método de inicialización (mantenido por compatibilidad con el flujo actual).
   */
  async loadConfig(): Promise<void> {
    return Promise.resolve();
  }
}
