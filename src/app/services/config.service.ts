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

  public readonly menuItems = [
    { label: 'Stock General', route: '/inventory', icon: 'assets/images/casa-nueva.png', isAsset: true },
    { label: 'Heridas & Quemados', route: '/quemados', icon: 'assets/images/Quemados y Heridas-icon.png', isAsset: true, typeKey: 'HQ' },
    { label: 'Traumatología', route: '/trauma', icon: 'assets/images/Traumatología-icon.png', isAsset: true, typeKey: 'TR' },
    { label: 'Neurocirugía', route: '/neuro', icon: 'assets/images/Neurocirugía-icon.png', isAsset: true, typeKey: 'NR' },
    { label: 'T. de Sueño y Apnea', route: '/sueno', icon: 'assets/images/Terapia de Sueño y Apnea-icon.png', isAsset: true, typeKey: 'TS' },
  ];

  /**
   * Busca el nombre legible de un tipo de familia.
   */
  getMenuLabelByType(typeKey: string): string | null {
    const item = this.menuItems.find(i => i.typeKey === typeKey);
    return item ? item.label : null;
  }

  /**
   * Método de inicialización (mantenido por compatibilidad con el flujo actual).
   */
  async loadConfig(): Promise<void> {
    return Promise.resolve();
  }
}
