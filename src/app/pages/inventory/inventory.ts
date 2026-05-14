import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin, of, firstValueFrom } from 'rxjs';
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
  private route = inject(ActivatedRoute);

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

  // Título para filtros específicos (Traumatología)
  tipoCategoriaTitle = signal<string | null>(null);

  // Almacena la query de filtros activos (categoría, familia, tipo) para exportación y búsqueda
  currentFiltersQuery = signal<string>('');

  ngOnInit(): void {
    // Escuchar eventos de refresco desde el header
    this.suscripcionRefresco = this.refreshService.refresco$.subscribe(() => {
      console.log('Refrescando Stock Aprobado desde el Header...');
      this.cargarStock();
    });

    // Escuchar cambios en los parámetros de consulta (para filtrado por categoría o familia)
    this.route.queryParams.subscribe(params => {
      const categoria = params['prod_id__cat_id__nombre'];
      const tipoCategoria = params['prod_id__cat_id__tipo_id__nombre'] || params['prod_id__cat_id__tipo'];
      const familia = params['prod_id__cat_id__familia_id__nombre'];

      let filterQuery = '';
      if (tipoCategoria) {
        console.log('Filtrando por tipo de categoría:', tipoCategoria);
        this.tipoCategoriaTitle.set(tipoCategoria);
        filterQuery = `&prod_id__cat_id__tipo_id__nombre=${encodeURIComponent(tipoCategoria)}`;
      } else if (categoria) {
        console.log('Filtrando por categoría:', categoria);
        this.tipoCategoriaTitle.set(null);
        filterQuery = `&prod_id__cat_id__nombre=${encodeURIComponent(categoria)}`;
      } else if (familia) {
        console.log('Filtrando por familia:', familia);
        this.tipoCategoriaTitle.set(null);
        filterQuery = `&prod_id__cat_id__familia_id__nombre=${encodeURIComponent(familia)}`;
      } else {
        console.log('Cargando Stock General (sin filtros en URL)...');
        this.tipoCategoriaTitle.set(null);
        this.searchTerm.set(''); // Limpiar buscador al volver a Stock General
        filterQuery = '';
      }

      this.currentFiltersQuery.set(filterQuery);
      this.cargarStock();
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripción para evitar fugas de memoria
    this.suscripcionRefresco?.unsubscribe();
  }

  /**
   * Obtiene la query combinada de búsqueda y filtros activos.
   */
  private getCombinedQuery(): string {
    const term = this.searchTerm();
    const filters = this.currentFiltersQuery();
    return (term ? `&buscar=${encodeURIComponent(term)}` : '') + filters;
  }

  /**
   * Carga los datos de stock desde la API.
   * @param urlOrSearch URL opcional para paginación (next/prev) o término de búsqueda.
   */
  cargarStock(urlOrSearch?: string): void {
    this.loading.set(true);
    this.stockItems.set([]);

    const query = urlOrSearch || this.getCombinedQuery();

    // Extraer página si es una URL de paginación
    if (urlOrSearch && urlOrSearch.includes('page=')) {
      const match = urlOrSearch.match(/page=(\d+)/);
      if (match) this.paginaActual.set(parseInt(match[1]));
    } else if (!urlOrSearch || !urlOrSearch.includes('StockAprobado')) {
      // Si es una búsqueda nueva o carga inicial, resetear a página 1
      this.paginaActual.set(1);
    }

    this.apiService.getStockAprobado(query).subscribe({
      next: (data) => this.procesarResultados(data),
      error: (err) => this.manejarError(err)
    });
  }

  private procesarResultados(data: any): void {
    console.log('Procesando resultados:', data);
    const results = data.results || (Array.isArray(data) ? data : []);

    // Agregación de items por código (sin prefijo tipo: )
    const aggregated = new Map<string, any>();

    results.forEach((item: any) => {
      // Extraer código sin prefijo (ej: "MER:XF-DMDF1" -> "XF-DMDF1")
      let fullCode = item.prod_id?.codigo || '';
      let cleanCode = fullCode.includes(':') ? fullCode.split(':')[1].trim() : fullCode.trim();
      
      const key = cleanCode || fullCode;

      // Obtener filtros activos para limpiar la visualización de categorías
      const activeType = this.tipoCategoriaTitle();
      const activeCatName = this.route.snapshot.queryParams['prod_id__cat_id__nombre'];

      // Manejar múltiples categorías (M2M)
      let cats = item.prod_id?.cat_ids || item.prod_id?.cat_id;
      let catDisplay = '';
      if (Array.isArray(cats)) {
        let filteredCats = cats;
        
        if (activeType) {
          // Si filtramos por TIPO (Trauma), mostramos solo las categorías de ese tipo
          filteredCats = cats.filter(c => {
            const t = c.tipo || c.tipo_id;
            const tName = typeof t === 'string' ? t : t?.nombre;
            return tName === activeType;
          });
        } else if (activeCatName) {
          // Si filtramos por NOMBRE de categoría, mostramos solo esa
          filteredCats = cats.filter(c => c.nombre === activeCatName);
        }

        // Si el filtro no arroja resultados o no hay filtro activo, mostramos todos sin duplicar nombres
        const displayList = filteredCats.length > 0 ? filteredCats : cats;
        const uniqueNames = Array.from(new Set(displayList.map(c => c.nombre)));
        catDisplay = uniqueNames.join(', ');
      } else if (cats && cats.nombre) {
        catDisplay = cats.nombre;
      } else {
        catDisplay = '-';
      }
      item.displayCategory = catDisplay;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key);
        // Sumar cantidades en paralelo
        existing.disponible = (existing.disponible || 0) + (item.disponible || 0);
        existing.importacion = (existing.importacion || 0) + (item.importacion || 0);
        existing.acondicionado = (existing.acondicionado || 0) + (item.acondicionado || 0);
        existing.reesterilizado = (existing.reesterilizado || 0) + (item.reesterilizado || 0);
        existing.observados = (existing.observados || 0) + (item.observados || 0);
        existing.consignacion = (existing.consignacion || 0) + (item.consignacion || 0);
        existing.venta_sujeta = (existing.venta_sujeta || 0) + (item.venta_sujeta || 0);
        existing.stock_total = (existing.stock_total || 0) + (item.stock_total || item.stock || 0);
      } else {
        // Clonar y limpiar el código
        const newItem = { ...item };
        if (newItem.prod_id) {
          newItem.prod_id = { ...newItem.prod_id, codigo: cleanCode };
        }
        aggregated.set(key, newItem);
      }
    });

    const finalResults = Array.from(aggregated.values());

    this.stockItems.set(finalResults);
    this.nextUrl.set(data.next || null);
    this.prevUrl.set(data.previous || null);
    
    // Recalcular totalCount restando los duplicados eliminados en esta página
    const reduction = results.length - finalResults.length;
    const currentTotal = data.count || results.length;
    this.totalCount.set(currentTotal - reduction);

    this.loading.set(false);
    console.log('Carga finalizada. Items originales:', results.length, 'Agregados:', finalResults.length);
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
    console.log('Iniciando exportación a Excel filtrada y paralela...');

    try {
      const fullQuery = this.getCombinedQuery();
      const top = 1000;

      // Primera llamada para obtener el conteo total y la primera página usando la query combinada
      const firstResponse: any = await firstValueFrom(this.apiService.getStockAprobado(fullQuery, top));
      
      if (!firstResponse) {
        throw new Error('No se recibió respuesta del servidor');
      }

      const totalRecords = firstResponse.count || 0;
      let allData = [...(firstResponse.results || [])];
      
      if (totalRecords === 0) {
        alert('No hay datos para exportar con los filtros actuales');
        this.loadingExport.set(false);
        return;
      }

      const totalPages = Math.ceil(totalRecords / top);
      this.exportProgress.set(Math.round((1 / totalPages) * 100));

      if (totalPages > 1) {
        const promises: Promise<any>[] = [];
        // Empezamos desde la página 2
        for (let i = 2; i <= totalPages; i++) {
          // Construimos la URL manualmente para asegurar el número de página y el top, manteniendo los filtros
          const pageUrl = `StockAprobado/?page=${i}&top=${top}${fullQuery}`;
          
          const p = firstValueFrom(this.apiService.getStockAprobado(pageUrl)).then((resp: any) => {
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

      // Formatear los datos para el Excel (Usando los datos agregados si están cargados)
      // Nota: Si es exportación total, deberíamos agregar después de cargar todo
      const dataToExport = allData.map(item => {
        let fullCode = item.prod_id?.codigo || '';
        let cleanCode = fullCode.includes(':') ? fullCode.split(':')[1].trim() : fullCode.trim();
        return {
          'CATEGORÍA': item.prod_id?.cat_id?.nombre || '',
          'CÓDIGO': cleanCode,
          'DESCRIPCIÓN': item.prod_id?.descripcion || '',
          'DISPONIBLE': item.disponible || 0,
          'IMPORTACION': item.importacion || 0,
          'ACONDICIONADO': item.acondicionado || 0,
          'REESTERILIZADO': item.reesterilizado || 0,
          'OBSERVADOS': item.observados || 0,
          'CONSIGNACION': item.consignacion || 0,
          'VENTA SUJETA': item.venta_sujeta || 0,
          'STOCK TOTAL': item.stock_total || item.stock || 0
        };
      });

      // Si hay duplicados en el volcado total, agregarlos también
      const finalExcelData: any[] = [];
      const excelMap = new Map<string, any>();
      dataToExport.forEach(item => {
        const key = item['CÓDIGO'];
        if (excelMap.has(key)) {
          const ex = excelMap.get(key);
          ex['DISPONIBLE'] += item['DISPONIBLE'];
          ex['IMPORTACION'] += item['IMPORTACION'];
          ex['ACONDICIONADO'] += item['ACONDICIONADO'];
          ex['REESTERILIZADO'] += item['REESTERILIZADO'];
          ex['OBSERVADOS'] += item['OBSERVADOS'];
          ex['CONSIGNACION'] += item['CONSIGNACION'];
          ex['VENTA SUJETA'] += item['VENTA SUJETA'];
          ex['STOCK TOTAL'] += item['STOCK TOTAL'];
        } else {
          excelMap.set(key, { ...item });
        }
      });
      const finalData = Array.from(excelMap.values());

      // Crear el libro de Excel
      const worksheet = XLSX.utils.json_to_sheet(finalData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Inventario');

      // Generar el archivo y descargarlo
      const fileName = `Stock_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log('Exportación completada con', finalData.length, 'registros agregados.');
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
