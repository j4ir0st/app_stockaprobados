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
    // Si es una URL completa o parcial que ya incluye el endpoint o comienza con filtros directos
    if (urlOrSearch && (urlOrSearch.includes('StockAprobado') || urlOrSearch.includes('/api/') || urlOrSearch.startsWith('&'))) {
      let finalUrl = this.fixUrl(urlOrSearch);

      // Si solo son filtros (comienza con &), anteponemos el endpoint
      if (finalUrl.startsWith('&')) {
        finalUrl = 'StockAprobado/?' + finalUrl.substring(1);
      }

      // Si la URL es relativa, le ponemos la base
      if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
        finalUrl = this.baseUrl + finalUrl;
      }

      // Asegurar parámetros necesarios
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
   * Obtiene el detalle de stock ERP filtrado por código de producto y tipo de almacenaje.
   * Incluye el parámetro top para cargar la mayor cantidad posible en una sola consulta.
   * @param codigoProducto Código del producto a consultar.
   * @param tipoAlmacenaje Tipo de almacenaje (ej: 'CONSIGNACION').
   * @param top Límite de resultados por página (por defecto 1000).
   */
  getStockERP(codigoProducto: string, tipoAlmacenaje: string, top: number = 1000): Observable<any> {
    const params = new HttpParams()
      .set('format', 'json')
      .set('codigo_producto', codigoProducto)
      .set('tipo_almacenaje', tipoAlmacenaje)
      .set('top', top.toString());
    return this.http.get<any>(`${this.baseUrl}Stock_ERP/`, { params });
  }

  /**
   * Obtiene todos los registros de Stock_ERP para un código de producto sin filtro de tipo de almacenaje.
   * Usado para vistas que requieren todos los movimientos (ej: Equipos VAC).
   * @param codigoProducto Código del producto a consultar.
   * @param top Límite de resultados por página (por defecto 1000).
   * @param soloGuias Si es verdadero, agrega el filtro solo_guias=true.
   */
  getStockERPTodos(codigoProducto: string, top: number = 1000, soloGuias: boolean = false): Observable<any> {
    let params = new HttpParams()
      .set('format', 'json')
      .set('codigo_producto', codigoProducto)
      .set('top', top.toString());
    
    if (soloGuias) {
      params = params.set('solo_guias', 'true');
    }
    
    return this.http.get<any>(`${this.baseUrl}Stock_ERP/`, { params });
  }

  /**
   * Obtiene todos los registros de EquiposVAC con soporte para límite de resultados.
   * @param top Límite de resultados (por defecto 1000 para cargar todo en una sola consulta).
   */
  getEquiposVAC(top: number = 1000): Observable<any> {
    const params = new HttpParams()
      .set('format', 'json')
      .set('top', top.toString());
    return this.http.get<any>(`${this.baseUrl}EquiposVAC/`, { params });
  }

  /**
   * Obtiene una página adicional de Stock_ERP usando la URL 'next' devuelta por la API.
   * @param urlNext URL de la siguiente página (relativa o absoluta).
   */
  getStockERPPagina(urlNext: string): Observable<any> {
    let finalUrl = this.fixUrl(urlNext);
    if (!finalUrl.startsWith('/') && !finalUrl.startsWith('http')) {
      finalUrl = this.baseUrl + finalUrl;
    }
    if (!finalUrl.includes('format=json')) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'format=json';
    }
    return this.http.get<any>(finalUrl);
  }

  /**
   * Obtiene la información de mercancía en tránsito desde la API SI_Transito.
   * Acepta una URL completa de paginación, un límite numérico (top) o un objeto de parámetros (ordering, page, etc.).
   */
  getSITransito(paramsOrUrl?: any): Observable<any> {
    if (typeof paramsOrUrl === 'string') {
      let finalUrl = this.fixUrl(paramsOrUrl);
      if (!finalUrl.includes('format=json')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'format=json';
      }
      return this.http.get<any>(finalUrl);
    }

    let params = new HttpParams().set('format', 'json');
    if (typeof paramsOrUrl === 'number') {
      params = params.set('top', paramsOrUrl.toString());
    } else if (typeof paramsOrUrl === 'object' && paramsOrUrl !== null) {
      if (paramsOrUrl.top) {
        params = params.set('top', paramsOrUrl.top.toString());
      }
      if (paramsOrUrl.ordering) {
        params = params.set('ordering', paramsOrUrl.ordering);
      }
      if (paramsOrUrl.buscar) {
        params = params.set('buscar', paramsOrUrl.buscar);
      }
      if (paramsOrUrl.page) {
        params = params.set('page', paramsOrUrl.page.toString());
      }
    }
    return this.http.get<any>(`${this.baseUrl}SI_Transito/`, { params });
  }

  /**
   * Ajusta una URL absoluta (del backend) para que use el proxy local '/api-proxy/'.
   * Esto evita problemas de CORS y "localhost" en desarrollo y producción.
   */
  public fixUrl(url: string): string {
    if (!url) return '';

    return url.replace(/^https?:\/\/[^\/]+/, '');
  }
}
