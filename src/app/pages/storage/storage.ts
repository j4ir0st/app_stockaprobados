import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { RefreshService } from '../../services/refresh.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-storage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './storage.html',
  styleUrl: './storage.css'
})
export class StorageComponent implements OnInit, OnDestroy {
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
      console.log('Refrescando Stock Inventario desde el Header...');
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
    } else if (!urlOrSearch || !urlOrSearch.includes('StockInventario')) {
      // Si es una búsqueda nueva o carga inicial, resetear a página 1
      this.paginaActual.set(1);
    }

    this.apiService.getStockInventario(search).subscribe({
      next: (data) => this.procesarResultados(data),
      error: (err) => this.manejarError(err)
    });
  }

  private procesarResultados(data: any): void {
    console.log('Procesando resultados StockInventario:', data);
    const results = data.results || (Array.isArray(data) ? data : []);

    this.stockItems.set(results);
    this.nextUrl.set(data.next || null);
    this.prevUrl.set(data.previous || null);
    this.totalCount.set(data.count || results.length);
    this.loading.set(false);
  }

  private manejarError(err: any): void {
    console.error('Error en cargarStockInventario:', err);
    this.loading.set(false);
  }

  nextPage(): void {
    if (this.nextUrl()) {
      this.cargarStock(this.nextUrl()!);
    }
  }

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
    console.log('Iniciando exportación a Excel paralela (Almacenaje)...');

    try {
      const search = this.searchTerm();
      const top = 1000;

      // Primera llamada para obtener el conteo total y la primera página
      const firstResponse: any = await this.apiService.getStockInventario(search, top).toPromise();

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
          const pageUrl = `StockInventario/?page=${i}&top=${top}${search ? '&buscar=' + encodeURIComponent(search) : ''}`;

          const p = this.apiService.getStockInventario(pageUrl).toPromise().then((resp: any) => {
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
        'ALMACENAJE': item.almacenaje || '',
        'PROVEEDOR': item.prod_id?.prov_id || '',
        'STOCK': item.stock || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Almacenaje');

      const fileName = `Stock_Almacenaje_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      alert('Error al generar el archivo Excel');
    } finally {
      this.loadingExport.set(false);
    }
  }

  buscar(): void {
    this.cargarStock();
  }
}
