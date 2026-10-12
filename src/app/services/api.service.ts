import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
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
    params = params.set('format', 'json');

    return this.http.get<any>(`${this.baseUrl}StockAprobado/`, { params });
  }


  /**
   * Obtiene el detalle de consignación (CSG) o venta sujeta (VTA) desde la API Stock_ERP.
   * @param codigoProducto Código del producto a consultar.
   * @param tipoAlmacenaje Filtro del tipo de almacenaje (ej: CONSIGNACION).
   * @param top Límite de resultados opcional (ej: 1000 para cargar todo en una sola consulta).
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
   * Obtiene todos los movimientos de Stock_ERP para un código de producto sin filtrar por tipo de almacenaje.
   * @param codigoProducto Código del producto a consultar.
   * @param top Límite de resultados opcional (ej: 1000 para cargar todo en una sola consulta).
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
   * Obtiene el detalle completo enriquecido de un Equipo VAC (incluye seguimiento y guia_info).
   * @param serie Número de serie del equipo.
   */
  getEquipoVACDetalleCompleto(serie: string): Observable<any> {
    const s = encodeURIComponent(serie.trim());
    return this.http.get<any>(`${this.baseUrl}EquiposVAC/${s}/detalle-completo/?format=json`);
  }

  /**
   * Obtiene la lista de seguimientos de equipos VAC.
   * @param serie Opcional, filtrar por número de serie.
   */
  getSeguimientosVAC(serie?: string): Observable<any> {
    let params = new HttpParams().set('format', 'json').set('top', '1000');
    if (serie) {
      params = params.set('serie', serie);
    }
    return this.http.get<any>(`${this.baseUrl}EV_Seguimiento/`, { params });
  }

  /**
   * Actualiza o crea el estado de retorno de un equipo VAC en EV_Seguimiento.
   * Envía serie y volvio_almacen ('PR', 'EP', 'RC', 'DV').
   */
  actualizarEstadoRetornoVAC(serie: string, volvioAlmacen: string | boolean): Observable<any> {
    const cleanSerie = serie.trim();
    const baseApi = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    return this.http.post<any>(`${baseApi}EV_Seguimiento/`, {
      serie: cleanSerie,
      volvio_almacen: volvioAlmacen
    });
  }

  /**
   * Crea o actualiza el registro de seguimiento para un equipo VAC.
   */
  crearSeguimientoVAC(data: any): Observable<any> {
    const serie = (typeof data === 'string' ? data : (data.serie || '')).trim();
    const volvio = typeof data === 'object' && data.volvio_almacen !== undefined ? data.volvio_almacen : 'PR';
    return this.actualizarEstadoRetornoVAC(serie, volvio);
  }

  /**
   * Actualiza el estado de retorno de un seguimiento existente.
   */
  actualizarSeguimientoVAC(idOrSerie: number | string, data: any): Observable<any> {
    const baseApi = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const volvio = data.volvio_almacen !== undefined ? data.volvio_almacen : 'PR';
    if (typeof idOrSerie === 'string') {
      return this.actualizarEstadoRetornoVAC(idOrSerie, volvio);
    }
    return this.http.patch<any>(`${baseApi}EV_Seguimiento/${idOrSerie}/`, {
      volvio_almacen: volvio
    });
  }

  /**
   * Obtiene los comentarios de seguimiento de Equipos VAC.
   * @param seguimientoId ID del seguimiento.
   * @param serie Número de serie.
   */
  getComentariosVAC(seguimientoId?: number, serie?: string): Observable<any> {
    let params = new HttpParams().set('format', 'json').set('top', '1000');
    if (seguimientoId) {
      params = params.set('seguimiento', seguimientoId.toString());
    }
    if (serie) {
      params = params.set('seguimiento__serie', serie);
    }
    return this.http.get<any>(`${this.baseUrl}EV_Comentario/`, { params });
  }

  /**
   * Registra un nuevo comentario / intento de recuperación en EV_Comentario.
   * Solo requiere serie y comentario. El backend auto-crea el seguimiento y asigna el usuario autenticado.
   */
  crearComentarioVAC(serieOrData: string | { serie?: string; seguimiento?: number | string; comentario: string; usuario?: number }, comentarioTexto?: string): Observable<any> {
    const baseApi = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    let serie = '';
    let comentario = '';

    if (typeof serieOrData === 'string') {
      serie = serieOrData.trim();
      comentario = (comentarioTexto || '').trim();
    } else {
      serie = (serieOrData.serie || '').trim();
      comentario = (serieOrData.comentario || '').trim();
      if (!serie && serieOrData.seguimiento) {
        return this.http.post<any>(`${baseApi}EV_Comentario/`, {
          seguimiento: serieOrData.seguimiento,
          comentario: comentario
        });
      }
    }

    return this.http.post<any>(`${baseApi}EV_Comentario/`, {
      serie: serie,
      comentario: comentario
    });
  }

  /**
   * Consulta directa de Guías de Remisión por número de guía.
   * @param nroGuia Número de guía a consultar (ej: T003-47542).
   */
  getGuiaRemisionPorNumero(nroGuia: string): Observable<any> {
    const params = new HttpParams().set('format', 'json').set('nro_guia', nroGuia);
    return this.http.get<any>(`${this.baseUrl}GuiasRemision/`, { params });
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
