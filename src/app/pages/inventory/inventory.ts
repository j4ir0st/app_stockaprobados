import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { RefreshService } from '../../services/refresh.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class InventoryComponent implements OnInit, OnDestroy {
  private configService = inject(ConfigService);
  private apiService = inject(ApiService);
  public themeService = inject(ThemeService);
  private refreshService = inject(RefreshService);

  private suscripcionRefresco?: Subscription;

  // Estado de la búsqueda
  searchTerm = signal('');

  // Lista de items de stock
  stockItems = signal<any[]>([]);

  // Estado de carga y paginación
  loading = signal(false);
  nextUrl = signal<string | null>(null);
  prevUrl = signal<string | null>(null);
  totalCount = signal(0);
  paginaActual = signal(1);
  loadingExport = signal(false);
  exportProgress = signal(0);

  ngOnInit(): void {
    this.cargarStock();

    // Escuchar eventos de refresco desde el header
    this.suscripcionRefresco = this.refreshService.refresco$.subscribe(() => {
      console.log('Refrescando Stock Aprobado desde el Header...');
      this.cargarStock();
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripción para evitar fugas de memoria
    this.suscripcionRefresco?.unsubscribe();
  }

  /**
   * Carga los datos de stock desde la API.
   * @param urlOrSearch URL opcional para paginación (next/prev) o término de búsqueda.
   */
  cargarStock(urlOrSearch?: string): void {
    this.loading.set(true);
    this.stockItems.set([]);

    const search = urlOrSearch || this.searchTerm();

    // Extraer página si es una URL de paginación
    if (urlOrSearch && urlOrSearch.includes('page=')) {
      const match = urlOrSearch.match(/page=(\d+)/);
      if (match) this.paginaActual.set(parseInt(match[1]));
    } else if (!urlOrSearch || !urlOrSearch.includes('StockAprobado')) {
      // Si es una búsqueda nueva o carga inicial, resetear a página 1
      this.paginaActual.set(1);
    }

    this.apiService.getStockAprobado(search).subscribe({
      next: (data) => this.procesarResultados(data),
      error: (err) => this.manejarError(err)
    });
  }

  private procesarResultados(data: any): void {
    console.log('Procesando resultados:', data);
    const results = data.results || (Array.isArray(data) ? data : []);

    this.stockItems.set(results);
    this.nextUrl.set(data.next || null);
    this.prevUrl.set(data.previous || null);
    this.totalCount.set(data.count || results.length);
    this.loading.set(false);
    console.log('Carga finalizada. Items:', results.length, 'Total:', data.count);
  }

  private manejarError(err: any): void {
    console.error('Error en cargarStock:', err);
    this.loading.set(false);
    this.generarDatosDemo();
  }

  /**
   * Navega a la página siguiente.
   */
  nextPage(): void {
    if (this.nextUrl()) {
      this.cargarStock(this.nextUrl()!);
    }
  }

  /**
   * Navega a la página anterior.
   */
  prevPage(): void {
    if (this.prevUrl()) {
      this.cargarStock(this.prevUrl()!);
    }
  }

  /**
   * Descarga todos los registros de la búsqueda actual en un archivo Excel.
   * Optimizado: Carga páginas en paralelo y muestra progreso.
   */
  async descargarExcel() {
    if (this.loadingExport()) return;

    this.loadingExport.set(true);
    this.exportProgress.set(0);
    console.log('Iniciando exportación a Excel paralela...');

    try {
      const search = this.searchTerm();
      const top = 1000;

      // Primera llamada para obtener el conteo total y la primera página
      const firstResponse: any = await this.apiService.getStockAprobado(search, top).toPromise();
      
      if (!firstResponse) {
        throw new Error('No se recibió respuesta del servidor');
      }

      const totalRecords = firstResponse.count || 0;
      let allData = [...(firstResponse.results || [])];
      
      if (totalRecords === 0) {
        alert('No hay datos para exportar');
        this.loadingExport.set(false);
        return;
      }

      const totalPages = Math.ceil(totalRecords / top);
      this.exportProgress.set(Math.round((1 / totalPages) * 100));

      if (totalPages > 1) {
        const promises: Promise<any>[] = [];
        // Empezamos desde la página 2
        for (let i = 2; i <= totalPages; i++) {
          // Construimos la URL manualmente para asegurar el número de página y el top
          const pageUrl = `StockAprobado/?page=${i}&top=${top}${search ? '&buscar=' + encodeURIComponent(search) : ''}`;
          
          const p = this.apiService.getStockAprobado(pageUrl).toPromise().then((resp: any) => {
            // Actualizar progreso conforme terminan las peticiones
            const currentProgress = this.exportProgress();
            this.exportProgress.set(Math.min(99, currentProgress + Math.round((1 / totalPages) * 100)));
            return resp.results || [];
          });
          promises.push(p);
        }

        const additionalResults = await Promise.all(promises);
        additionalResults.forEach(results => {
          allData = [...allData, ...results];
        });
      }

      this.exportProgress.set(100);

      // Formatear los datos para el Excel
      const dataToExport = allData.map(item => ({
        'TIPO': item.prod_id?.tipo || '',
        'CÓDIGO': item.prod_id?.codigo || '',
        'DESCRIPCIÓN': item.prod_id?.descripcion || '',
        'DISPONIBLE': item.disponible || 0,
        'IMPORTACION': item.importacion || 0,
        'ACONDICIONADO': item.acondicionado || 0,
        'REESTERILIZADO': item.reesterilizado || 0,
        'OBSERVADOS': item.observados || 0,
        'CONSIGNACION': item.consignacion || 0,
        'VENTA SUJETA': item.venta_sujeta || 0,
        'STOCK TOTAL': item.stock_total || item.stock || 0
      }));

      // Crear el libro de Excel
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Inventario');

      // Generar el archivo y descargarlo
      const fileName = `Stock_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log('Exportación completada con', allData.length, 'registros.');
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      alert('Error al generar el archivo Excel');
    } finally {
      this.loadingExport.set(false);
    }
  }

  /**
   * Realiza la búsqueda de productos.
   */
  buscar(): void {
    console.log('Botón buscar clickeado. Término:', this.searchTerm());
    this.cargarStock();
  }

  /**
   * Genera datos de prueba para cuando no hay conexión con el servidor o errores.
   */
  private generarDatosDemo(): void {
    this.stockItems.set([
      {
        id: 6792,
        prod_id: {
          codigo: 'ZMW-120A',
          descripcion: 'UNITAPE PRODUCTO A - MOTOR AIR PRESSURE TUBING',
          tipo: 'MER'
        },
        disponible: 3,
        importacion: 0,
        acondicionado: 0,
        reesterilizado: 0,
        observados: 0,
        consignacion: 0,
        venta_sujeta: 0,
        stock_total: 3
      },
      {
        id: 6791,
        prod_id: {
          codigo: 'ZMW-11',
          descripcion: 'UNITAPE PRODUCTO B - ACCESSORY KIT',
          tipo: 'SG-IM'
        },
        disponible: 1,
        importacion: 0,
        acondicionado: 0,
        reesterilizado: 0,
        observados: 0,
        consignacion: 0,
        venta_sujeta: 0,
        stock_total: 1
      }
    ]);
  }
}
