import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

/**
 * Servicio centralizado para las consultas a la API de Django Rest Framework.
 * Sigue las buenas prácticas de reutilización de código.
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  /**
   * Obtiene la base de la URL de la API desde el servicio de configuración.
   */
  private get baseUrl(): string {
    return this.fixUrl(this.configService.apiUrl());
  }

  /**
   * Método genérico para peticiones GET.
   * @param endpoint Ruta del recurso.
   * @param params Parámetros de consulta opcionales.
   */
  get<T>(endpoint: string, params?: HttpParams): Observable<T> {
    let finalParams = params || new HttpParams();
    if (!finalParams.has('format')) {
      finalParams = finalParams.set('format', 'json');
    }
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params: finalParams });
  }

  /**
   * Obtiene el stock aprobado con soporte para búsqueda unificada y límite de resultados.
   * @param urlOrSearch URL de paginación o término de búsqueda.
   * @param top Límite de resultados opcional (ej: 1000).
   */
  getStockAprobado(urlOrSearch?: string, top?: number): Observable<any> {
    if (urlOrSearch && (urlOrSearch.includes('StockAprobado') || urlOrSearch.includes('/api/'))) {
      let finalUrl = this.fixUrl(urlOrSearch);

      // Si la URL es relativa (ej: "StockAprobado/?page=2"), le ponemos la base
      if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
        finalUrl = this.baseUrl + finalUrl;
      }

      // Asegurar parámetros necesarios en URL de paginación
      if (top && !finalUrl.includes('top=')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + `top=${top}`;
      }
      if (!finalUrl.includes('format=json')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + `format=json`;
      }

      return this.http.get<any>(finalUrl);
    }

    let params = new HttpParams();
    if (urlOrSearch) {
      params = params.set('buscar', urlOrSearch);
    }
    if (top) {
      params = params.set('top', top.toString());
    }
    return this.get('StockAprobado/', params);
  }

  /**
   * Obtiene el inventario de almacenaje con soporte para búsqueda unificada y límite de resultados.
   * @param urlOrSearch URL de paginación o término de búsqueda.
   * @param top Límite de resultados opcional (ej: 1000).
   */
  getStockInventario(urlOrSearch?: string, top?: number): Observable<any> {
    if (urlOrSearch && (urlOrSearch.includes('StockInventario') || urlOrSearch.includes('/api/'))) {
      let finalUrl = this.fixUrl(urlOrSearch);

      // Si la URL es relativa, le ponemos la base
      if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
        finalUrl = this.baseUrl + finalUrl;
      }

      // Asegurar parámetros necesarios en URL de paginación
      if (top && !finalUrl.includes('top=')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + `top=${top}`;
      }
      if (!finalUrl.includes('format=json')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + `format=json`;
      }

      return this.http.get<any>(finalUrl);
    }

    let params = new HttpParams();
    if (urlOrSearch) {
      params = params.set('buscar', urlOrSearch);
    }
    if (top) {
      params = params.set('top', top.toString());
    }
    return this.get('StockInventario/', params);
  }

  /**
   * Ajusta una URL absoluta (del backend) para que use el proxy local '/api-proxy/'.
   * Esto evita problemas de CORS y "localhost" en desarrollo y producción.
   */
  private fixUrl(url: string): string {
    if (!url) return '';

    return url.replace(/^https?:\/\/[^\/]+/, '');
  }
}
