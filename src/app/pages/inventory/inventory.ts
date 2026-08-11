import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { forkJoin, of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { RefreshService } from '../../services/refresh.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class InventoryComponent implements OnInit, OnDestroy {
  private configService = inject(ConfigService);
  private apiService = inject(ApiService);
  public themeService = inject(ThemeService);
  private refreshService = inject(RefreshService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  private suscripcionRefresco?: Subscription;

  // Estado de la búsqueda
  searchTerm = signal('');

  // Lista de items de stock
  stockItems = signal<any[]>([]);

  // Estado de carga y paginación
  loading = signal(false);
  cargandoTransito = signal(false);
  nextUrl = signal<string | null>(null);
  prevUrl = signal<string | null>(null);
  totalCount = signal(0);
  paginaActual = signal(1);
  loadingExport = signal(false);

  // Calcula dinámicamente el total de páginas en base al count y al parámetro top de la URL
  totalPaginas = computed(() => {
    const top = this.obtenerTopDeUrl();
    return Math.ceil(this.totalCount() / top) || 1;
  });
  exportProgress = signal(0);

  // Título para filtros específicos (Traumatología)
  tipoCategoriaTitle = signal<string | null>(null);

  // Almacena la query de filtros activos (categoría, familia, tipo) para exportación y búsqueda
  currentFiltersQuery = signal<string>('');

  // Indica si el modo actual es de códigos fijos (ej: Equipos VAC) — habilita clic en toda la fila
  modoCodigosFijos = signal(false);

  // Estado de la vista de detalle CSG
  vistaDetalle = signal(false);
  productoSeleccionado = signal<any>(null);
  itemsConsignacion = signal<any[]>([]);       // Registros agregados con cantidad > 0
  itemsConsignacionCeros = signal<any[]>([]);  // Registros agregados que quedaron en cero
  itemsConsignacionRaw = signal<any[]>([]);    // Registros originales del kardex sin procesar
  equiposVACData = signal<any[]>([]);          // Registros consolidados de Equipos VAC de la API
  mostrarTablaActualVAC = signal(false);       // Controla si se visualiza la tabla principal en Equipos VAC

  // Permite verificar si el usuario tiene permiso para ver la tabla actual de Equipos VAC
  puedeVerTablaActualVAC = computed(() => {
    const usuario = this.authService.currentUser();
    if (!usuario) return false;
    const areaId = (usuario.area_id || '').toLowerCase();
    const areaNombre = (usuario.area || '').toLowerCase();
    return areaId === 'atenciones' || areaNombre === 'atenciones' || areaId === 'desarrollo software' || areaNombre === 'desarrollo software';
  });

  ordenResumenColumna = signal<'cantidad' | 'representante'>('cantidad');
  ordenResumenDireccion = signal<'asc' | 'desc'>('desc'); // default: de mayor a menor (desc)

  // Estado del ordenamiento por columna para la tabla principal (StockAprobado)
  ordenStockColumna = signal<'disponible' | 'stock' | null>(null);
  ordenStockDireccion = signal<'asc' | 'desc' | null>(null);

  /**
   * Alterna el ordenamiento por las columnas 'disponible' o 'stock'.
   * Estado 1: desc (flecha abajo) -> ordering=-disponible / ordering=-stock
   * Estado 2: asc (flecha arriba) -> ordering=disponible / ordering=stock
   * Estado 3: deshabilitado (flecha doble) -> sin parámetro ordering
   * @param columna Columna seleccionada ('disponible' | 'stock')
   */
  toggleOrdenStock(columna: 'disponible' | 'stock'): void {
    if (this.ordenStockColumna() === columna) {
      if (this.ordenStockDireccion() === 'desc') {
        this.ordenStockDireccion.set('asc');
      } else {
        // Si estaba en asc, se deshabilita el ordenamiento
        this.ordenStockColumna.set(null);
        this.ordenStockDireccion.set(null);
      }
    } else {
      this.ordenStockColumna.set(columna);
      this.ordenStockDireccion.set('desc');
    }
    this.cargarStock();
  }

  toggleOrdenResumen(columna: 'cantidad' | 'representante'): void {
    if (this.ordenResumenColumna() === columna) {
      this.ordenResumenDireccion.set(this.ordenResumenDireccion() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenResumenColumna.set(columna);
      this.ordenResumenDireccion.set(columna === 'cantidad' ? 'desc' : 'asc');
    }
  }

  // Agrupa los equipos consolidados de VAC por representante (solo los "internados")
  resumenEquiposVAC = computed(() => {
    if (!this.modoCodigosFijos()) {
      return [];
    }

    const mapa = new Map<string, number>();
    const todosLosEquipos = this.equiposVACData();

    todosLosEquipos.forEach((reg: any) => {
      const cantidad = Math.round(reg.cantidad || 0);
      if (cantidad > 0) {
        const deposito = (reg.deposito || '').trim();
        if (deposito.endsWith('-VS') || deposito.endsWith('-C')) {
          const representante = (reg.representante || '').trim() || '—';
          const acumulado = mapa.get(representante) || 0;
          mapa.set(representante, acumulado + cantidad);
        }
      }
    });

    const resultado = Array.from(mapa.entries()).map(([representante, cantidad]) => ({
      representante,
      cantidad
    }));

    // Ordenar en memoria según columna y dirección
    const col = this.ordenResumenColumna();
    const dir = this.ordenResumenDireccion();

    resultado.sort((a: any, b: any) => {
      if (col === 'cantidad') {
        return dir === 'desc' ? b.cantidad - a.cantidad : a.cantidad - b.cantidad;
      } else {
        const comp = a.representante.localeCompare(b.representante);
        return dir === 'desc' ? -comp : comp;
      }
    });

    return resultado;
  });

  // Calcula el total general de los equipos asignados a los representantes
  totalEquiposVAC = computed(() => {
    return this.resumenEquiposVAC().reduce((acumulado, fila) => acumulado + fila.cantidad, 0);
  });
  loadingDetalle = signal(false);
  errorDetalle = signal<string | null>(null);

  // Modos de visualización del detalle
  mostrarKardexOriginal = signal(false);  // Muestra el kardex sin agregar
  mostrarCeros = signal(false);           // Muestra también los registros que quedaron en cero
  ordenFechaAscendente = signal(false);   // Orden de fecha: false = descendente (por defecto, igual que API)
  filtroSerie = signal('');               // Filtro de texto por número de serie
  filtroDeposito = signal('');            // Filtro de texto por nombre de depósito
  filtroRepresentante = signal('');       // Filtro de texto por representante
  filtroDisponibilidad = signal('');      // Filtro de texto por disponibilidad (sólo para Equipos VAC)
  filtroPaciente = signal('');            // Filtro de texto por paciente (sólo para Equipos VAC en vista detalle general)
  ordenRepresentante = signal<'asc' | 'desc' | null>(null); // Orden por representante: asc, desc o deshabilitado (null)
  mostrarCodigoProductoDetalle = signal(true); // Controla la visibilidad de la columna Código Producto en detalle
  tiempoRestanteActualizacion = signal(60); // Segundos restantes para la actualización automática de Equipos VAC
  private intervaloActualizacion: any;    // Referencia al intervalo del temporizador


  // Items a mostrar según el modo activo, con filtrado y ordenamiento en memoria
  itemsVisibles = computed(() => {
    let items: any[];
    if (this.mostrarKardexOriginal()) items = this.itemsConsignacionRaw();
    else if (this.mostrarCeros()) items = [...this.itemsConsignacion(), ...this.itemsConsignacionCeros()];
    else items = this.itemsConsignacion();

    // Filtrar por número de serie en memoria (búsqueda parcial sin distinción de mayúsculas)
    const filtroPorSerie = this.filtroSerie().trim().toLowerCase();
    if (filtroPorSerie) {
      items = items.filter(reg => (reg.numero_serie || '').toLowerCase().includes(filtroPorSerie));
    }

    // Filtrar por nombre de depósito en memoria (búsqueda parcial sin distinción de mayúsculas)
    const filtroPorDeposito = this.filtroDeposito().trim().toLowerCase();
    if (filtroPorDeposito) {
      items = items.filter(reg => (reg.nombre_deposito || '').toLowerCase().includes(filtroPorDeposito));
    }
    // Filtrar por representante en memoria (búsqueda parcial sin distinción de mayúsculas)
    const filtroPorRepresentante = this.filtroRepresentante().trim().toLowerCase();
    if (filtroPorRepresentante) {
      items = items.filter(reg => (reg.representante || '').toLowerCase().includes(filtroPorRepresentante));
    }

    // Filtrar por disponibilidad en memoria (búsqueda parcial sin distinción de mayúsculas)
    const filtroPorDisponibilidad = this.filtroDisponibilidad().trim().toLowerCase();
    if (filtroPorDisponibilidad) {
      items = items.filter(reg => (reg.disponibilidad || '').toLowerCase().includes(filtroPorDisponibilidad));
    }

    // Filtrar por paciente en memoria (búsqueda parcial sin distinción de mayúsculas)
    const filtroPorPaciente = this.filtroPaciente().trim().toLowerCase();
    if (filtroPorPaciente) {
      items = items.filter(reg => (reg.paciente || '').toLowerCase().includes(filtroPorPaciente));
    }

    // Ordenar en memoria sin hacer consultas al servidor
    return [...items].sort((a, b) => {
      // Orden compuesto: representante primero (si está activo)
      if (this.modoCodigosFijos() && this.ordenRepresentante() !== null) {
        const repA = (a.representante || '').trim().toLowerCase();
        const repB = (b.representante || '').trim().toLowerCase();
        if (repA !== repB) {
          const factor = this.ordenRepresentante() === 'asc' ? 1 : -1;
          return repA.localeCompare(repB) * factor;
        }
      }

      // Orden secundario o principal por fecha de movimiento
      const fechaA = new Date(a.fecha_movimiento || 0).getTime();
      const fechaB = new Date(b.fecha_movimiento || 0).getTime();
      return this.ordenFechaAscendente() ? fechaA - fechaB : fechaB - fechaA;
    });
  });

  ngOnInit(): void {
    // Escuchar eventos de refresco desde el header
    this.suscripcionRefresco = this.refreshService.refresco$.subscribe(() => {
      console.log('Refrescando Stock Aprobado desde el Header...');
      this.tiempoRestanteActualizacion.set(60);
      this.cargarStock();
    });

    // Escuchar evento para limpiar la búsqueda
    this.refreshService.limpiarBusqueda$.subscribe(() => {
      console.log('Limpiando búsqueda por evento externo...');
      this.searchTerm.set('');
    });

    // Escuchar cambios en los parámetros de consulta (para filtrado por categoría o familia)
    this.route.queryParams.subscribe(params => {
      // Cerrar la vista detalle si el usuario navega a otra sección
      if (this.vistaDetalle()) {
        this.regresarATabla();
      }

      // Resetear la visibilidad de la tabla actual de Equipos VAC al cambiar de filtros
      this.mostrarTablaActualVAC.set(false);

      // Limpiar el buscador cada vez que cambien los filtros de la URL (navegación desde sidebar)
      this.searchTerm.set('');

      // Deshabilitar por defecto el parámetro ordering al cambiar de ruta/opción de menú
      this.ordenStockColumna.set(null);
      this.ordenStockDireccion.set(null);

      const categoria = params['prod_id__cat_id__nombre'];
      const tipoCategoria = params['prod_id__cat_id__tipo_id__nombre'] || params['prod_id__cat_id__tipo'];
      const familia = params['prod_id__cat_id__familia_id__nombre'];
      const familiaTipo = params['prod_id__cat_id__familia_id__tipo'];
      const buscarParam = params['buscar']; // Nuevo: chequear si viene búsqueda en URL
      const typeKey = params['typeKey'];    // Nuevo: chequear si es modo de códigos fijos

      let filterQuery = '';

      // --- Modo de códigos fijos (ej: Equipos VAC) ---
      if (typeKey) {
        const codigosFijos = this.configService.getCodigosFijos(typeKey);
        if (codigosFijos) {
          this.tiempoRestanteActualizacion.set(60);
          this.modoCodigosFijos.set(true);
          const label = this.configService.getMenuLabelByType(typeKey);
          this.tipoCategoriaTitle.set(label);
          this.currentFiltersQuery.set('');
          this.cargarStockCodigosFijos(codigosFijos);
          return;
        }
      }

      // Modo normal: limpiar estado de códigos fijos si se navega a otra sección
      this.modoCodigosFijos.set(false);

      // Construir la query acumulando filtros si están presentes
      if (tipoCategoria) {
        console.log('Filtrando por tipo de categoría:', tipoCategoria);
        filterQuery += `&prod_id__cat_id__tipo_id__nombre=${encodeURIComponent(tipoCategoria)}`;
        this.tipoCategoriaTitle.set(tipoCategoria);
      } else if (familiaTipo) {
        console.log('Filtrando por tipo de familia:', familiaTipo);
        filterQuery += `&prod_id__cat_id__familia_id__tipo=${encodeURIComponent(familiaTipo)}`;

        // Obtener el label legible del tipo de familia
        const label = this.configService.getMenuLabelByType(familiaTipo);
        this.tipoCategoriaTitle.set(label);
      } else {
        this.tipoCategoriaTitle.set(null);
      }

      if (categoria) {
        console.log('Filtrando por categoría:', categoria);
        filterQuery += `&prod_id__cat_id__nombre=${encodeURIComponent(categoria)}`;
      }

      if (familia) {
        console.log('Filtrando por familia:', familia);
        filterQuery += `&prod_id__cat_id__familia_id__nombre=${encodeURIComponent(familia)}`;
      }

      if (!tipoCategoria && !categoria && !familia && !familiaTipo) {
        console.log('Cargando Stock General (sin filtros en URL)...');
        this.searchTerm.set(''); // Limpiar buscador al volver a Stock General
        filterQuery = '';
      }

      this.currentFiltersQuery.set(filterQuery);
      this.cargarStock();
    });

    this.iniciarIntervaloVAC();
  }

  ngOnDestroy(): void {
    // Limpiar suscripción para evitar fugas de memoria
    this.suscripcionRefresco?.unsubscribe();
    if (this.intervaloActualizacion) {
      clearInterval(this.intervaloActualizacion);
    }
  }

  /**
   * Obtiene la query combinada de búsqueda, filtros activos y parámetro de ordenamiento.
   */
  private getCombinedQuery(): string {
    const term = this.searchTerm();
    const filters = this.currentFiltersQuery();
    const columna = this.ordenStockColumna();
    const direccion = this.ordenStockDireccion();

    let query = (term ? `&buscar=${encodeURIComponent(term)}` : '') + filters;

    if (columna && direccion) {
      const valorOrdering = direccion === 'desc' ? `-${columna}` : columna;
      query += `&ordering=${encodeURIComponent(valorOrdering)}`;
    }

    return query;
  }

  /**
   * Carga en paralelo el stock de una lista de códigos fijos (ej: Equipos VAC).
   * Une los resultados de todas las búsquedas y los procesa como si fueran una sola respuesta.
   * @param codigos Lista de códigos a consultar.
   */
  async cargarStockCodigosFijos(codigos: string[]): Promise<void> {
    this.loading.set(true);
    this.stockItems.set([]);
    this.paginaActual.set(1);

    try {
      // 1. Obtener todos los registros consolidados desde la API de EquiposVAC con top=1000
      const respuesta = await firstValueFrom(this.apiService.getEquiposVAC(1000));
      const todosLosEquipos = respuesta?.results || (Array.isArray(respuesta) ? respuesta : []);

      // Guardar en la señal para su uso en la vista detalle
      this.equiposVACData.set(todosLosEquipos);

      // 2. Procesar y agrupar por código de producto (prod) para armar la tabla resumen
      const itemsAgrupadosMap = new Map<string, any>();

      // Inicializar los códigos fijos para asegurar que aparezcan en la tabla principal
      codigos.forEach(codigo => {
        itemsAgrupadosMap.set(codigo, {
          id: Math.random(),
          displayCategory: codigo === 'A4-S0002' ? 'VAC' : (codigo === 'A4-S0003' ? 'VAC PLUS' : 'Equipos VAC'),
          prod_id: {
            codigo: codigo,
            descripcion: codigo === 'A4-S0002'
              ? 'EQUIPO VAC XLR8'
              : 'EQUIPO VAC XLR8 + PLUS',
            tipo: 'SG-IM'
          },
          disponible: 0,
          importacion: 0,
          inkjet: 0,
          acondicionado: 0,
          reesterilizado: 0,
          observados: 0,
          consignacion: 0,
          venta_sujeta: 0,
          stock_total: 0,

          // Columnas específicas para Equipos VAC
          stock_cx: 0,
          pendiente_revision: 0,
          ingenieria: 0,
          nueva_importacion: 0,
          internados: 0
        });
      });

      // Recorrer los registros de la base de datos para acumular cantidades reales
      todosLosEquipos.forEach((reg: any) => {
        const prodCodigo = (reg.prod || '').trim();
        if (!prodCodigo) return;

        // Asegurar que procesamos solo los códigos que nos interesan
        if (!itemsAgrupadosMap.has(prodCodigo)) {
          itemsAgrupadosMap.set(prodCodigo, {
            id: Math.random(),
            displayCategory: prodCodigo === 'A4-S0002' ? 'VAC' : (prodCodigo === 'A4-S0003' ? 'VAC PLUS' : 'Equipos VAC'),
            prod_id: {
              codigo: prodCodigo,
              descripcion: reg.descripcion || 'EQUIPO VAC',
              tipo: reg.tipo_producto || 'SG-IM'
            },
            disponible: 0,
            importacion: 0,
            inkjet: 0,
            acondicionado: 0,
            reesterilizado: 0,
            observados: 0,
            consignacion: 0,
            venta_sujeta: 0,
            stock_total: 0,

            // Columnas específicas para Equipos VAC
            stock_cx: 0,
            pendiente_revision: 0,
            ingenieria: 0,
            nueva_importacion: 0,
            internados: 0
          });
        }

        const itemObjeto = itemsAgrupadosMap.get(prodCodigo);
        const cantidad = Math.round(reg.cantidad || 0);

        // Actualizar descripción si viene en el registro
        if (reg.descripcion && itemObjeto.prod_id.descripcion === prodCodigo) {
          itemObjeto.prod_id.descripcion = reg.descripcion;
        }

        // Sumar al total y clasificar según las nuevas condiciones
        if (cantidad > 0) {
          const deposito = (reg.deposito || '').trim();
          const sector = (reg.sector || '').trim();

          // 1. Stock para Cx: (deposito=SG-APR || deposito=RRM-APR) && sector<>AN-ING && sector<>R82.A
          if ((deposito === 'SG-APR' || deposito === 'RRM-APR') && sector !== 'AN-ING' && sector !== 'PRI-R82.A') {
            itemObjeto.stock_cx += cantidad;
          }

          // 2. Pendiente de Revision: deposito=SG-DEV || deposito=RRM-DEV
          if (deposito === 'SG-DEV' || deposito === 'RRM-DEV') {
            itemObjeto.pendiente_revision += cantidad;
          }

          // 3. Ingeniería - 6to Piso: (deposito=SG-APR || deposito=RRM-APR) && sector=AN-ING
          if ((deposito === 'SG-APR' || deposito === 'RRM-APR') && sector === 'AN-ING') {
            itemObjeto.ingenieria += cantidad;
          }

          // 4. Nueva Importación: deposito=RRM-APR && sector=R82.A
          if (deposito === 'RRM-APR' && sector === 'PRI-R82.A') {
            itemObjeto.nueva_importacion += cantidad;
          }

          // 5. Internados: deposito contiene -VS o -C (equivalente a like '%-VS' o like '%-C')
          if (deposito.endsWith('-VS') || deposito.endsWith('-C')) {
            itemObjeto.internados += cantidad;
          }

          // Sumar al total general de stock (SOLO si no es depósito de baja)
          if (!deposito.endsWith('-BAJ') && !deposito.endsWith('-VAF') && !deposito.endsWith('-CSA')) {
            itemObjeto.stock_total += cantidad;

            // Compatibilidad: mantener los campos originales
            const tieneCliente = reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----';
            if (tieneCliente) {
              itemObjeto.consignacion += cantidad;
            } else {
              itemObjeto.disponible += cantidad;
            }
          }
        }
      });

      const todosLosResultados = Array.from(itemsAgrupadosMap.values());

      // Reutilizar el procesador de resultados con la estructura esperada
      this.procesarResultados({ results: todosLosResultados, count: todosLosResultados.length, next: null, previous: null });
    } catch (err) {
      console.error('Error al cargar stock por códigos fijos (Equipos VAC):', err);
      this.loading.set(false);
    }
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

  /**
   * Carga asíncronamente la mercancía en tránsito desde la API SI_Transito con top=1000.
   * Suma el campo 'cantidad' por código de producto coincidente y actualiza la lista stockItems.
   */
  cargarTransito(): void {
    this.cargandoTransito.set(true);

    this.apiService.getSITransito(1000).subscribe({
      next: (data) => {
        const transitoList = data?.results || (Array.isArray(data) ? data : []);
        const mapaTransito = new Map<string, number>();

        transitoList.forEach((reg: any) => {
          let fullCode = reg.prod || reg.codigo || reg.prod_id?.codigo || '';
          let cleanCode = fullCode.includes(':') ? fullCode.split(':')[1].trim() : fullCode.trim();
          if (cleanCode) {
            const cant = Math.round(Number(reg.cant_pend || 0));
            mapaTransito.set(cleanCode, (mapaTransito.get(cleanCode) || 0) + cant);
          }
        });

        // Actualizar la lista actual de stockItems con el valor de tránsito (o 0 si no tiene)
        const updatedItems = this.stockItems().map(item => {
          const code = item.prod_id?.codigo || '';
          const transitoSum = mapaTransito.get(code) || 0;
          return { ...item, trans: transitoSum };
        });

        this.stockItems.set(updatedItems);
        this.cargandoTransito.set(false);
        console.log('Tránsito cargado exitosamente. Ítems procesados:', transitoList.length);
      },
      error: (err) => {
        console.error('Error al cargar mercancía en tránsito (SI_Transito):', err);
        this.cargandoTransito.set(false);
      }
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
      // Asignar displayCategory, respetando etiquetas fijas para Equipos VAC
      if (this.modoCodigosFijos()) {
        item.displayCategory = cleanCode === 'A4-S0002' ? 'VAC' : (cleanCode === 'A4-S0003' ? 'VAC PLUS' : 'Equipos VAC');
      } else {
        item.displayCategory = catDisplay;
      }

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
        existing.stock = (existing.stock || 0) + (item.stock || 0);

        // Sumar columnas específicas de VAC
        existing.stock_cx = (existing.stock_cx || 0) + (item.stock_cx || 0);
        existing.pendiente_revision = (existing.pendiente_revision || 0) + (item.pendiente_revision || 0);
        existing.ingenieria = (existing.ingenieria || 0) + (item.ingenieria || 0);
        existing.nueva_importacion = (existing.nueva_importacion || 0) + (item.nueva_importacion || 0);
        existing.internados = (existing.internados || 0) + (item.internados || 0);
      } else {
        // Clonar y limpiar el código
        const newItem = { ...item, trans: 0 };
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

    // Cargar información de mercancía en tránsito asíncronamente si no está en modo de códigos fijos
    if (!this.modoCodigosFijos()) {
      this.cargarTransito();
    }
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
    console.log('Iniciando exportación a Excel...');

    try {
      // Si estamos en modo de códigos fijos (Equipos VAC), exportar la data local acumulada
      if (this.modoCodigosFijos()) {
        let dataEquipos = this.equiposVACData();
        const tablaOculta = !this.mostrarTablaActualVAC() || !this.puedeVerTablaActualVAC();

        if (tablaOculta) {
          // Filtrar solo equipos internados (deposito termina en -VS o -C y cantidad > 0)
          dataEquipos = dataEquipos.filter((reg: any) => {
            const dep = (reg.deposito || '').trim();
            const cant = Math.round(reg.cantidad || 0);
            return cant > 0 && (dep.endsWith('-VS') || dep.endsWith('-C'));
          });
        } else {
          // Filtrar excluyendo depósitos de baja, CSA o VAF
          dataEquipos = dataEquipos.filter((reg: any) => {
            const dep = (reg.deposito || '').trim();
            return !dep.endsWith('-BAJ') && !dep.endsWith('-CSA') && !dep.endsWith('-VAF');
          });
        }

        const datosExportar = dataEquipos.map((reg: any) => {
          const codigoDoc = (reg.codigo || '').trim();
          let documentoFormateado = '—';
          if (codigoDoc) {
            let codigoModificado = codigoDoc;
            if (codigoDoc.startsWith('SGRG')) {
              codigoModificado = codigoDoc.replace('SGRG', 'T00');
            } else if (codigoDoc.startsWith('RRRG')) {
              codigoModificado = codigoDoc.replace('RRRG', 'T00');
            }
            documentoFormateado = `${codigoModificado}-${reg.numero || ''}`;
          }

          return {
            'CÓDIGO PRODUCTO': (reg.prod || '').trim(),
            'N° SERIE': (reg.serie || '').trim() || (reg.activo || '').trim() || '—',
            'REPRESENTANTE': (reg.representante || '').trim() || '—',
            'CLIENTE': (reg.cliente || '').trim() || '—',
            'PACIENTE': (reg.paciente || '').trim() || '—',
            'DOCUMENTO': documentoFormateado,
            'FECHA MOVIMIENTO': reg.fecha_mov || '—',
            // 'DEPÓSITO': (reg.deposito || '').trim() || '—',
            // 'SECTOR': (reg.sector || '').trim() || '—',
            'DÍAS EMPLEADOS': this.calcularDiasEmpleados(reg.fecha_mov),
            'DISPONIBILIDAD': this.obtenerDisponibilidad(reg.deposito, reg.sector)
          };
        });

        // Ordenar alfabéticamente por representante en el frontend
        datosExportar.sort((a: any, b: any) => a['REPRESENTANTE'].localeCompare(b['REPRESENTANTE']));

        const worksheet = XLSX.utils.json_to_sheet(datosExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipos VAC');

        const fileName = `Equipos_VAC_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        this.loadingExport.set(false);
        return;
      }

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

      // Obtener mercancía en tránsito para la exportación a Excel
      let mapaTransitoExcel = new Map<string, number>();
      try {
        const transitoResp: any = await firstValueFrom(this.apiService.getSITransito(1000));
        const transitoResults = transitoResp?.results || (Array.isArray(transitoResp) ? transitoResp : []);
        transitoResults.forEach((reg: any) => {
          let fullCode = reg.prod || reg.codigo || reg.prod_id?.codigo || '';
          let cleanCode = fullCode.includes(':') ? fullCode.split(':')[1].trim() : fullCode.trim();
          if (cleanCode) {
            const cant = Math.round(Number(reg.cant_pend || 0));
            mapaTransitoExcel.set(cleanCode, (mapaTransitoExcel.get(cleanCode) || 0) + cant);
          }
        });
      } catch (e) {
        console.warn('No se pudieron obtener datos de tránsito para Excel:', e);
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
          'TRANSITO': mapaTransitoExcel.get(cleanCode) || item.trans || 0,
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
          ex['TRANSITO'] += item['TRANSITO'];
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
   * Abre la tarjeta de detalle CSG consultando la tabla Stock_ERP.
   * Carga todas las páginas disponibles en paralelo usando top=1000 para minimizar consultas.
   * @param item Registro del inventario con campo consignacion > 0.
   */
  async verDetalleCSG(item: any): Promise<void> {
    const codigo = item.prod_id?.codigo;
    if (!codigo || !item.consignacion) return;

    this.productoSeleccionado.set(item);
    this.itemsConsignacion.set([]);
    this.itemsConsignacionCeros.set([]);
    this.itemsConsignacionRaw.set([]);
    this.mostrarKardexOriginal.set(false);
    this.mostrarCeros.set(false);
    this.ordenFechaAscendente.set(false);
    this.filtroSerie.set('');
    this.filtroDeposito.set('');
    this.errorDetalle.set(null);
    this.loadingDetalle.set(true);
    this.vistaDetalle.set(true);

    try {
      const top = 1000;

      // Primera consulta con top=1000 para minimizar páginas necesarias
      const primeraRespuesta: any = await firstValueFrom(
        this.apiService.getStockERP(codigo, 'CONSIGNACION', top)
      );

      if (!primeraRespuesta) throw new Error('Sin respuesta del servidor');

      let todosLosResultados = [...(primeraRespuesta.results || [])];

      // Si hay más páginas, cargarlas todas en paralelo
      if (primeraRespuesta.next) {
        const totalRegistros = primeraRespuesta.count || 0;
        const totalPaginas = Math.ceil(totalRegistros / top);
        console.log(`Stock_ERP: ${totalRegistros} registros en ${totalPaginas} páginas. Cargando páginas restantes en paralelo...`);

        const promesas: Promise<any>[] = [];
        for (let pagina = 2; pagina <= totalPaginas; pagina++) {
          const urlPagina = `Stock_ERP/?page=${pagina}&top=${top}&codigo_producto=${encodeURIComponent(codigo)}&tipo_almacenaje=CONSIGNACION`;
          promesas.push(firstValueFrom(this.apiService.getStockERPPagina(urlPagina)));
        }

        const respuestasPaginadas = await Promise.all(promesas);
        respuestasPaginadas.forEach((resp: any) => {
          todosLosResultados = [...todosLosResultados, ...(resp?.results || [])];
        });
      }

      console.log(`Stock_ERP: ${todosLosResultados.length} registros totales cargados.`);

      // Guardar el kardex original con cantidades como enteros
      this.itemsConsignacionRaw.set(
        todosLosResultados.map((reg: any) => ({ ...reg, cantidad: Math.round(reg.cantidad || 0) }))
      );

      // Agregar registros por numero_serie + deposito: misma serie puede existir en varios depósitos
      const agregado = new Map<string, any>();

      todosLosResultados.forEach((reg: any) => {
        // La clave combina serie y depósito para agrupar correctamente por ubicación
        const clave = reg.numero_serie
          ? `${reg.numero_serie}|${reg.nombre_deposito || ''}`
          : `__sin_serie_${Math.random()}`;
        const cantidadActual = Math.round(reg.cantidad || 0);

        if (agregado.has(clave)) {
          const existente = agregado.get(clave);
          // Sumar cantidad
          existente.cantidad += cantidadActual;
          // Conservar los datos del registro con fecha más reciente
          const fechaExistente = new Date(existente.fecha_movimiento || 0);
          const fechaNueva = new Date(reg.fecha_movimiento || 0);
          if (fechaNueva > fechaExistente) {
            agregado.set(clave, { ...reg, cantidad: existente.cantidad });
          }
        } else {
          agregado.set(clave, { ...reg, cantidad: cantidadActual });
        }
      });

      // Separar registros con cantidad positiva de los que quedaron en cero o negativo
      const todosAgregados = Array.from(agregado.values());
      this.itemsConsignacion.set(todosAgregados.filter(reg => reg.cantidad > 0));
      this.itemsConsignacionCeros.set(todosAgregados.filter(reg => reg.cantidad <= 0));

      this.loadingDetalle.set(false);

    } catch (err) {
      console.error('Error al cargar detalle CSG:', err);
      this.errorDetalle.set('No se pudo cargar el detalle. Intente nuevamente.');
      this.loadingDetalle.set(false);
    }
  }

  /**
   * Abre la tarjeta de detalle para ítems de códigos fijos (ej: Equipos VAC).
   * Consulta todos los movimientos de Stock_ERP sin filtro de tipo de almacenaje.
   * @param item Registro del inventario a detallar.
   */
  async verDetalleTodos(item: any): Promise<void> {
    this.tiempoRestanteActualizacion.set(60);
    const codigo = item.prod_id?.codigo;
    if (!codigo) return;

    this.productoSeleccionado.set(item);
    this.itemsConsignacion.set([]);
    this.itemsConsignacionCeros.set([]);
    this.itemsConsignacionRaw.set([]);
    this.mostrarKardexOriginal.set(false);
    this.mostrarCeros.set(false);
    this.ordenFechaAscendente.set(false);
    this.filtroSerie.set('');
    this.filtroDeposito.set('');
    this.filtroRepresentante.set('');
    this.filtroDisponibilidad.set('');
    this.mostrarCodigoProductoDetalle.set(false);
    this.errorDetalle.set(null);
    this.loadingDetalle.set(true);
    this.vistaDetalle.set(true);

    try {
      // 1. Obtener la información consolidada en tiempo real de la base de datos (con top=1000)
      const respuesta = await firstValueFrom(this.apiService.getEquiposVAC(1000));
      const todosLosEquipos = respuesta?.results || (Array.isArray(respuesta) ? respuesta : []);

      // Actualizar la señal en memoria para mantener los datos frescos
      this.equiposVACData.set(todosLosEquipos);

      // 2. Filtrar los equipos que corresponden al código seleccionado
      const equiposFiltrados = todosLosEquipos.filter((reg: any) => (reg.prod || '').trim() === codigo);

      // 3. Mapear cada equipo al formato consumido por la tabla de detalle
      const todosLosResultados = equiposFiltrados.map((reg: any) => {
        const cantidadActual = Math.round(reg.cantidad || 0);

        // Formatear el documento y determinar la empresa
        const codigoDoc = (reg.codigo || '').trim();
        let documentoFormateado = '—';
        let empresaNombre = '';

        if (codigoDoc) {
          let codigoModificado = codigoDoc;
          if (codigoDoc.startsWith('SGRG')) {
            codigoModificado = codigoDoc.replace('SGRG', 'T00');
            empresaNombre = 'SURGICORP S.R.L.';
          } else if (codigoDoc.startsWith('RRRG')) {
            codigoModificado = codigoDoc.replace('RRRG', 'T00');
            empresaNombre = 'RR MEDICAL S.R.L.';
          } else {
            // Reglas alternativas por código de empresa
            if (reg.empresa === '01') empresaNombre = 'SURGICORP S.R.L.';
            else if (reg.empresa === '04') empresaNombre = 'RR MEDICAL S.R.L.';
          }

          documentoFormateado = `${codigoModificado}-${reg.numero || ''}`;
        }

        // Lógica de cálculo de tipo_almacenaje específica para Equipos VAC
        let tipoAlmacenaje = 'STOCK DISPONIBLE';
        const dep = (reg.deposito || '').trim();
        const sec = (reg.sector || '').trim();

        if (dep.endsWith('-BAJ')) {
          tipoAlmacenaje = 'BAJA';
        } else if (dep.endsWith('-DEV')) {
          tipoAlmacenaje = 'DEVOLUCION EN PROCESO';
        } else if (dep.endsWith('-CSA')) {
          tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR ATENCIONES';
        } else if (dep.endsWith('-VAF')) {
          tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR FACTURACION';
        } else if (dep.endsWith('-APR')) {
          if (sec.endsWith('-ING') || sec === 'AN-ING') {
            tipoAlmacenaje = 'INGENIERIA';
          } else if (sec === 'R82.A') {
            tipoAlmacenaje = 'IMPORTACION EN PROCESO DE APROBACION';
          } else {
            tipoAlmacenaje = 'STOCK DISPONIBLE';
          }
        } else if (reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----') {
          tipoAlmacenaje = 'CONSIGNACION';
        } else if (dep.endsWith('-VS') || dep.endsWith('-C')) {
          tipoAlmacenaje = 'CONSIGNACION';
        }

        return {
          tipo_producto: (reg.tipo_producto || '').trim(),
          numero_serie: (reg.serie || '').trim() || (reg.activo || '').trim() || '—', // Usamos el campo serie de EquiposVAC con fallback a activo
          representante: (reg.representante || '').trim() || '—',
          cliente: (reg.cliente || '').trim() || '—',
          paciente: (reg.paciente || '').trim() || '—',
          documento: documentoFormateado,
          empresa_nombre: empresaNombre, // Nombre para el tooltip
          fecha_movimiento: reg.fecha_mov || null,
          nombre_deposito: dep || '—',
          sector: sec || '—',
          cantidad: cantidadActual,
          tipo_almacenaje: tipoAlmacenaje,
          codigo_producto: (reg.prod || '').trim(),
          disponibilidad: this.obtenerDisponibilidad(dep, sec)
        };
      });

      console.log(`Equipos VAC Detalle: ${todosLosResultados.length} registros cargados.`);

      // Guardar en las señales de detalle (Raw tiene todos los registros)
      this.itemsConsignacionRaw.set(todosLosResultados);

      // Filtrar para excluir los equipos que se encuentran en depósitos de baja, VAF o CSA
      const sinBajas = todosLosResultados.filter((reg: any) => {
        const dep = reg.nombre_deposito || '';
        return !dep.endsWith('-BAJ') && !dep.endsWith('-VAF') && !dep.endsWith('-CSA');
      });
      this.itemsConsignacion.set(sinBajas);
      this.itemsConsignacionCeros.set([]);

      this.loadingDetalle.set(false);

    } catch (err) {
      console.error('Error al cargar detalle VAC:', err);
      this.errorDetalle.set('No se pudo cargar el detalle. Intente nuevamente.');
      this.loadingDetalle.set(false);
    }
  }

  // Abre el detalle de todos los equipos VAC internados, agrupados/ordenados por representante en el frontend
  async verDetalleTotalGeneralVAC(): Promise<void> {
    this.tiempoRestanteActualizacion.set(60);
    // Definimos un producto seleccionado ficticio para mostrar en la cabecera
    this.productoSeleccionado.set({
      prod_id: {
        codigo: 'TOTAL GENERAL',
        descripcion: 'TODOS LOS EQUIPOS VAC INTERNADOS'
      }
    });
    this.itemsConsignacion.set([]);
    this.itemsConsignacionCeros.set([]);
    this.itemsConsignacionRaw.set([]);
    this.mostrarKardexOriginal.set(false);
    this.mostrarCeros.set(false);
    this.ordenFechaAscendente.set(false);
    this.filtroSerie.set('');
    this.filtroDeposito.set('');
    this.filtroRepresentante.set('');
    this.filtroDisponibilidad.set('');
    this.mostrarCodigoProductoDetalle.set(true);
    this.errorDetalle.set(null);
    this.loadingDetalle.set(true);
    this.vistaDetalle.set(true);

    try {
      // 1. Obtener toda la información consolidada de Equipos VAC
      const respuesta = await firstValueFrom(this.apiService.getEquiposVAC(1000));
      const todosLosEquipos = respuesta?.results || (Array.isArray(respuesta) ? respuesta : []);

      // Actualizar la señal en memoria
      this.equiposVACData.set(todosLosEquipos);

      // 2. Filtrar solo los registros que están como internados (deposito termina en -VS o -C) y cantidad > 0
      const equiposFiltrados = todosLosEquipos.filter((reg: any) => {
        const dep = (reg.deposito || '').trim();
        const cant = Math.round(reg.cantidad || 0);
        return cant > 0 && (dep.endsWith('-VS') || dep.endsWith('-C'));
      });

      // 3. Mapear cada equipo al formato consumido por la tabla de detalle
      const todosLosResultados = equiposFiltrados.map((reg: any) => {
        const cantidadActual = Math.round(reg.cantidad || 0);

        // Formatear el documento y determinar la empresa
        const codigoDoc = (reg.codigo || '').trim();
        let documentoFormateado = '—';
        let empresaNombre = '';

        if (codigoDoc) {
          let codigoModificado = codigoDoc;
          if (codigoDoc.startsWith('SGRG')) {
            codigoModificado = codigoDoc.replace('SGRG', 'T00');
            empresaNombre = 'SURGICORP S.R.L.';
          } else if (codigoDoc.startsWith('RRRG')) {
            codigoModificado = codigoDoc.replace('RRRG', 'T00');
            empresaNombre = 'RR MEDICAL S.R.L.';
          } else {
            if (reg.empresa === '01') empresaNombre = 'SURGICORP S.R.L.';
            else if (reg.empresa === '04') empresaNombre = 'RR MEDICAL S.R.L.';
          }

          documentoFormateado = `${codigoModificado}-${reg.numero || ''}`;
        }

        // Lógica de cálculo de tipo_almacenaje específica para Equipos VAC
        let tipoAlmacenaje = 'STOCK DISPONIBLE';
        const dep = (reg.deposito || '').trim();
        const sec = (reg.sector || '').trim();

        if (dep.endsWith('-BAJ')) {
          tipoAlmacenaje = 'BAJA';
        } else if (dep.endsWith('-DEV')) {
          tipoAlmacenaje = 'DEVOLUCION EN PROCESO';
        } else if (dep.endsWith('-CSA')) {
          tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR ATENCIONES';
        } else if (dep.endsWith('-VAF')) {
          tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR FACTURACION';
        } else if (dep.endsWith('-APR')) {
          if (sec.endsWith('-ING') || sec === 'AN-ING') {
            tipoAlmacenaje = 'INGENIERIA';
          } else if (sec === 'R82.A') {
            tipoAlmacenaje = 'IMPORTACION EN PROCESO DE APROBACION';
          } else {
            tipoAlmacenaje = 'STOCK DISPONIBLE';
          }
        } else if (reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----') {
          tipoAlmacenaje = 'CONSIGNACION';
        } else if (dep.endsWith('-VS') || dep.endsWith('-C')) {
          tipoAlmacenaje = 'CONSIGNACION';
        }

        return {
          tipo_producto: (reg.tipo_producto || '').trim(),
          numero_serie: (reg.serie || '').trim() || (reg.activo || '').trim() || '—',
          representante: (reg.representante || '').trim() || '—',
          cliente: (reg.cliente || '').trim() || '—',
          paciente: (reg.paciente || '').trim() || '—',
          documento: documentoFormateado,
          empresa_nombre: empresaNombre,
          fecha_movimiento: reg.fecha_mov || null,
          nombre_deposito: dep || '—',
          sector: sec || '—',
          cantidad: cantidadActual,
          tipo_almacenaje: tipoAlmacenaje,
          codigo_producto: (reg.prod || '').trim(),
          disponibilidad: this.obtenerDisponibilidad(dep, sec)
        };
      });

      // Ordenar por representante en el frontend
      todosLosResultados.sort((a: any, b: any) => a.representante.localeCompare(b.representante));

      console.log(`Equipos VAC Detalle Total General: ${todosLosResultados.length} registros cargados.`);

      this.itemsConsignacionRaw.set(todosLosResultados);
      this.itemsConsignacion.set(todosLosResultados);
      this.itemsConsignacionCeros.set([]);

      this.loadingDetalle.set(false);
    } catch (err) {
      console.error('Error al cargar detalle total general VAC:', err);
      this.errorDetalle.set('No se pudo cargar el detalle. Intente nuevamente.');
      this.loadingDetalle.set(false);
    }
  }

  regresarATabla(): void {
    this.tiempoRestanteActualizacion.set(60);
    this.vistaDetalle.set(false);
    this.productoSeleccionado.set(null);
    this.itemsConsignacion.set([]);
    this.itemsConsignacionCeros.set([]);
    this.itemsConsignacionRaw.set([]);
    this.mostrarKardexOriginal.set(false);
    this.mostrarCeros.set(false);
    this.ordenFechaAscendente.set(false);
    this.filtroSerie.set('');
    this.filtroDeposito.set('');
    this.filtroRepresentante.set('');
    this.filtroDisponibilidad.set('');
    this.filtroPaciente.set('');
    this.ordenRepresentante.set(null);
    this.errorDetalle.set(null);

    // Si estamos en modo de códigos fijos (Equipos VAC), refrescar la tabla principal al regresar
    if (this.modoCodigosFijos()) {
      const codigosFijos = this.configService.getCodigosFijos('VAC');
      if (codigosFijos) {
        this.cargarStockCodigosFijos(codigosFijos);
      }
    }
  }

  // Alterna la visibilidad de la tabla actual de Equipos VAC si el usuario está autorizado
  toggleTablaActualVAC(): void {
    if (this.modoCodigosFijos() && this.puedeVerTablaActualVAC()) {
      this.mostrarTablaActualVAC.set(!this.mostrarTablaActualVAC());
    }
  }

  /**
   * Alterna el orden de fecha entre ascendente y descendente en memoria.
   */
  /**
   * Extrae el parámetro top de la URL actual de paginación.
   * Si no se encuentra, retorna 60 como valor predeterminado de la API.
   */
  private obtenerTopDeUrl(): number {
    const next = this.nextUrl();
    const prev = this.prevUrl();
    const urlRef = next || prev || '';
    const match = urlRef.match(/[?&]top=(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
  }

  /**
   * Retorna la clase CSS correspondiente al tipo de almacenaje para colorear el badge.
   * @param tipoAlmacenaje Valor del campo tipo_almacenaje del registro.
   */
  obtenerClaseAlmacenaje(tipoAlmacenaje: string): string {
    const tipo = (tipoAlmacenaje || '').toUpperCase().trim();
    const mapaClases: Record<string, string> = {
      'STOCK DISPONIBLE': 'almacenaje-disponible',
      'MUESTRA': 'almacenaje-muestra',
      'PRODUCTOS EN ACONDICIONADO': 'almacenaje-acondicionado',
      'BAJA': 'almacenaje-baja',
      'DEVOLUCION EN PROCESO': 'almacenaje-devolucion',
      'INKJET': 'almacenaje-inkjet',
      'IMPORTACION EN PROCESO DE APROBACION': 'almacenaje-importacion',
      'PRESTAMO': 'almacenaje-prestamo',
      'COMPRA LOCAL EN PROCESO DE REVISION': 'almacenaje-compra-local',
      'PROVISIONAL': 'almacenaje-provisional',
      'PRODUCTO REESTERILIZADO': 'almacenaje-reesterilizado',
      'CONSUMO INTERNO': 'almacenaje-consumo',
      'FUERA DEL STOCK': 'almacenaje-fuera-stock',
      'PRODUCTOS OBSERVADOS POR CALIDAD': 'almacenaje-observados',
      'PRODUCTOS POR REGULARIZAR ATENCIONES': 'almacenaje-reg-atenciones',
      'VTA. SUJET. A CONF(MER)/BIENES DE USO': 'almacenaje-vta-sujeta',
      'RESERVADO PARA OC': 'almacenaje-reservado',
      'CONSIGNACION': 'almacenaje-consignacion',
      'PRODUCTOS POR REGULARIZAR FACTURACION': 'almacenaje-reg-facturacion',
      'INGENIERIA': 'almacenaje-ingenieria',
    };
    return mapaClases[tipo] || 'almacenaje-default';
  }


  /**
   * Retorna la disponibilidad calculada del equipo VAC según el depósito y sector.
   * @param deposito Nombre del depósito del registro.
   * @param sector Nombre del sector del registro.
   */
  obtenerDisponibilidad(deposito: string, sector: string): string {
    const dep = (deposito || '').trim();
    const sec = (sector || '').trim();

    if ((dep === 'SG-APR' || dep === 'RRM-APR') && sec !== 'AN-ING' && sec !== 'PRI-R82.A') {
      return 'STOCK PARA CX';
    }
    if (dep === 'SG-DEV' || dep === 'RRM-DEV') {
      return 'PEND. REVISIÓN';
    }
    if ((dep === 'SG-APR' || dep === 'RRM-APR') && sec === 'AN-ING') {
      return 'INGENIERÍA - 6TO PISO';
    }
    if (dep === 'RRM-APR' && sec === 'PRI-R82.A') {
      return 'NUEVA IMPORTACIÓN';
    }
    if (dep.endsWith('-VS') || dep.endsWith('-C')) {
      return 'INTERNADO';
    }
    return '—';
  }

  /**
   * Retorna la clase CSS correspondiente al estado de disponibilidad para colorear el badge.
   * @param disponibilidad Valor del campo disponibilidad del registro.
   */
  obtenerClaseDisponibilidad(disponibilidad: string): string {
    const disp = (disponibilidad || '').toUpperCase().trim();
    const mapaClases: Record<string, string> = {
      'STOCK PARA CX': 'disponibilidad-stock',
      'PEND. REVISIÓN': 'disponibilidad-pendiente',
      'INGENIERÍA - 6TO PISO': 'disponibilidad-ingenieria',
      'NUEVA IMPORTACIÓN': 'disponibilidad-nueva',
      'INTERNADO': 'disponibilidad-internados'
    };
    return mapaClases[disp] || 'disponibilidad-default';
  }

  /**
   * Alterna el orden de fecha entre ascendente y descendente en memoria.
   */
  toggleOrdenFecha(): void {
    this.ordenFechaAscendente.set(!this.ordenFechaAscendente());
  }

  /**
   * Alterna entre el kardex original y la vista agrupada, limpiando el filtro de depósito, disponibilidad y paciente si se oculta en el Total General.
   */
  toggleKardexOriginal(): void {
    const nuevoValor = !this.mostrarKardexOriginal();
    this.mostrarKardexOriginal.set(nuevoValor);
    if (!nuevoValor) {
      this.filtroDeposito.set('');
      if (this.productoSeleccionado()?.prod_id?.codigo === 'TOTAL GENERAL') {
        this.filtroDisponibilidad.set('');
        this.filtroPaciente.set('');
      }
    }
  }

  /**
   * Alterna el orden por representante en memoria: deshabilitado (null) -> asc -> desc -> deshabilitado (null).
   */
  toggleOrdenRepresentante(): void {
    const actual = this.ordenRepresentante();
    if (actual === null) {
      this.ordenRepresentante.set('asc');
    } else if (actual === 'asc') {
      this.ordenRepresentante.set('desc');
    } else {
      this.ordenRepresentante.set(null);
    }
  }

  /**
   * Inicia el intervalo de actualización automática de Equipos VAC cada segundo para descontar el contador.
   */
  iniciarIntervaloVAC(): void {
    if (this.intervaloActualizacion) {
      clearInterval(this.intervaloActualizacion);
    }

    this.intervaloActualizacion = setInterval(() => {
      if (this.modoCodigosFijos()) {
        const seg = this.tiempoRestanteActualizacion();
        if (seg <= 1) {
          this.tiempoRestanteActualizacion.set(60);
          this.actualizarDatosVAC();
        } else {
          this.tiempoRestanteActualizacion.set(seg - 1);
        }
      } else {
        if (this.tiempoRestanteActualizacion() !== 60) {
          this.tiempoRestanteActualizacion.set(60);
        }
      }
    }, 1000);
  }

  /**
   * Actualiza silenciosamente los datos de stock y detalles de Equipos VAC.
   */
  async actualizarDatosVAC(): Promise<void> {
    console.log('Iniciando recarga automática silenciosa de Equipos VAC...');
    const codigosFijos = this.configService.getCodigosFijos('VAC');
    if (!codigosFijos || codigosFijos.length === 0) return;

    try {
      console.log('Consultando API getEquiposVAC(1000)...');
      const respuesta = await firstValueFrom(this.apiService.getEquiposVAC(1000));
      const todosLosEquipos = respuesta?.results || (Array.isArray(respuesta) ? respuesta : []);
      console.log(`API getEquiposVAC retornó ${todosLosEquipos.length} registros.`);

      this.equiposVACData.set(todosLosEquipos);

      if (this.vistaDetalle()) {
        const prodSel = this.productoSeleccionado();
        if (prodSel) {
          const codigo = prodSel.prod_id?.codigo;
          if (codigo === 'TOTAL GENERAL') {
            const equiposFiltrados = todosLosEquipos.filter((reg: any) => {
              const dep = (reg.deposito || '').trim();
              const cant = Math.round(reg.cantidad || 0);
              return cant > 0 && (dep.endsWith('-VS') || dep.endsWith('-C'));
            });

            const todosLosResultados = equiposFiltrados.map((reg: any) => {
              const cantidadActual = Math.round(reg.cantidad || 0);
              const codigoDoc = (reg.codigo || '').trim();
              let documentoFormateado = '—';
              let empresaNombre = '';

              if (codigoDoc) {
                let codigoModificado = codigoDoc;
                if (codigoDoc.startsWith('SGRG')) {
                  codigoModificado = codigoDoc.replace('SGRG', 'T00');
                  empresaNombre = 'SURGICORP S.R.L.';
                } else if (codigoDoc.startsWith('RRRG')) {
                  codigoModificado = codigoDoc.replace('RRRG', 'T00');
                  empresaNombre = 'RR MEDICAL S.R.L.';
                } else {
                  if (reg.empresa === '01') empresaNombre = 'SURGICORP S.R.L.';
                  else if (reg.empresa === '04') empresaNombre = 'RR MEDICAL S.R.L.';
                }
                documentoFormateado = `${codigoModificado}-${reg.numero || ''}`;
              }

              let tipoAlmacenaje = 'STOCK DISPONIBLE';
              const dep = (reg.deposito || '').trim();
              const sec = (reg.sector || '').trim();

              if (dep.endsWith('-BAJ')) {
                tipoAlmacenaje = 'BAJA';
              } else if (dep.endsWith('-DEV')) {
                tipoAlmacenaje = 'DEVOLUCION EN PROCESO';
              } else if (dep.endsWith('-CSA')) {
                tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR ATENCIONES';
              } else if (dep.endsWith('-VAF')) {
                tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR FACTURACION';
              } else if (dep.endsWith('-APR')) {
                if (sec.endsWith('-ING') || sec === 'AN-ING') {
                  tipoAlmacenaje = 'INGENIERIA';
                } else if (sec === 'R82.A') {
                  tipoAlmacenaje = 'IMPORTACION EN PROCESO DE APROBACION';
                } else {
                  tipoAlmacenaje = 'STOCK DISPONIBLE';
                }
              } else if (reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----') {
                tipoAlmacenaje = 'CONSIGNACION';
              } else if (dep.endsWith('-VS') || dep.endsWith('-C')) {
                tipoAlmacenaje = 'CONSIGNACION';
              }

              return {
                tipo_producto: (reg.tipo_producto || '').trim(),
                numero_serie: (reg.serie || '').trim() || (reg.activo || '').trim() || '—',
                representante: (reg.representante || '').trim() || '—',
                cliente: (reg.cliente || '').trim() || '—',
                paciente: (reg.paciente || '').trim() || '—',
                documento: documentoFormateado,
                empresa_nombre: empresaNombre,
                fecha_movimiento: reg.fecha_mov || null,
                nombre_deposito: dep || '—',
                sector: sec || '—',
                cantidad: cantidadActual,
                tipo_almacenaje: tipoAlmacenaje,
                codigo_producto: (reg.prod || '').trim(),
                disponibilidad: this.obtenerDisponibilidad(dep, sec)
              };
            });

            todosLosResultados.sort((a: any, b: any) => a.representante.localeCompare(b.representante));
            this.itemsConsignacionRaw.set(todosLosResultados);
            this.itemsConsignacion.set(todosLosResultados);
            this.itemsConsignacionCeros.set([]);
          } else if (codigo) {
            const equiposFiltrados = todosLosEquipos.filter((reg: any) => (reg.prod || '').trim() === codigo);
            const todosLosResultados = equiposFiltrados.map((reg: any) => {
              const cantidadActual = Math.round(reg.cantidad || 0);
              const codigoDoc = (reg.codigo || '').trim();
              let documentoFormateado = '—';
              let empresaNombre = '';

              if (codigoDoc) {
                let codigoModificado = codigoDoc;
                if (codigoDoc.startsWith('SGRG')) {
                  codigoModificado = codigoDoc.replace('SGRG', 'T00');
                  empresaNombre = 'SURGICORP S.R.L.';
                } else if (codigoDoc.startsWith('RRRG')) {
                  codigoModificado = codigoDoc.replace('RRRG', 'T00');
                  empresaNombre = 'RR MEDICAL S.R.L.';
                } else {
                  if (reg.empresa === '01') empresaNombre = 'SURGICORP S.R.L.';
                  else if (reg.empresa === '04') empresaNombre = 'RR MEDICAL S.R.L.';
                }
                documentoFormateado = `${codigoModificado}-${reg.numero || ''}`;
              }

              let tipoAlmacenaje = 'STOCK DISPONIBLE';
              const dep = (reg.deposito || '').trim();
              const sec = (reg.sector || '').trim();

              if (dep.endsWith('-BAJ')) {
                tipoAlmacenaje = 'BAJA';
              } else if (dep.endsWith('-DEV')) {
                tipoAlmacenaje = 'DEVOLUCION EN PROCESO';
              } else if (dep.endsWith('-CSA')) {
                tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR ATENCIONES';
              } else if (dep.endsWith('-VAF')) {
                tipoAlmacenaje = 'PRODUCTOS POR REGULARIZAR FACTURACION';
              } else if (dep.endsWith('-APR')) {
                if (sec.endsWith('-ING') || sec === 'AN-ING') {
                  tipoAlmacenaje = 'INGENIERIA';
                } else if (sec === 'R82.A') {
                  tipoAlmacenaje = 'IMPORTACION EN PROCESO DE APROBACION';
                } else {
                  tipoAlmacenaje = 'STOCK DISPONIBLE';
                }
              } else if (reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----') {
                tipoAlmacenaje = 'CONSIGNACION';
              } else if (dep.endsWith('-VS') || dep.endsWith('-C')) {
                tipoAlmacenaje = 'CONSIGNACION';
              }

              return {
                tipo_producto: (reg.tipo_producto || '').trim(),
                numero_serie: (reg.serie || '').trim() || (reg.activo || '').trim() || '—',
                representante: (reg.representante || '').trim() || '—',
                cliente: (reg.cliente || '').trim() || '—',
                paciente: (reg.paciente || '').trim() || '—',
                documento: documentoFormateado,
                empresa_nombre: empresaNombre,
                fecha_movimiento: reg.fecha_mov || null,
                nombre_deposito: dep || '—',
                sector: sec || '—',
                cantidad: cantidadActual,
                tipo_almacenaje: tipoAlmacenaje,
                codigo_producto: (reg.prod || '').trim(),
                disponibilidad: this.obtenerDisponibilidad(dep, sec)
              };
            });

            this.itemsConsignacionRaw.set(todosLosResultados);
            const sinBajas = todosLosResultados.filter((reg: any) => {
              const dep = reg.nombre_deposito || '';
              return !dep.endsWith('-BAJ') && !dep.endsWith('-VAF') && !dep.endsWith('-CSA');
            });
            this.itemsConsignacion.set(sinBajas);
            this.itemsConsignacionCeros.set([]);
          }
        }
      }

      const itemsAgrupadosMap = new Map<string, any>();
      codigosFijos.forEach(codigo => {
        itemsAgrupadosMap.set(codigo, {
          id: Math.random(),
          displayCategory: codigo === 'A4-S0002' ? 'VAC' : (codigo === 'A4-S0003' ? 'VAC PLUS' : 'Equipos VAC'),
          prod_id: {
            codigo: codigo,
            descripcion: codigo === 'A4-S0002' ? 'EQUIPO VAC XLR8' : 'EQUIPO VAC XLR8 + PLUS',
            tipo: 'SG-IM'
          },
          disponible: 0,
          importacion: 0,
          inkjet: 0,
          acondicionado: 0,
          reesterilizado: 0,
          observados: 0,
          consignacion: 0,
          venta_sujeta: 0,
          stock_total: 0,
          stock_cx: 0,
          pendiente_revision: 0,
          ingenieria: 0,
          nueva_importacion: 0,
          internados: 0
        });
      });

      todosLosEquipos.forEach((reg: any) => {
        const prodCodigo = (reg.prod || '').trim();
        if (!prodCodigo) return;

        if (!itemsAgrupadosMap.has(prodCodigo)) {
          itemsAgrupadosMap.set(prodCodigo, {
            id: Math.random(),
            displayCategory: prodCodigo === 'A4-S0002' ? 'VAC' : (prodCodigo === 'A4-S0003' ? 'VAC PLUS' : 'Equipos VAC'),
            prod_id: {
              codigo: prodCodigo,
              descripcion: reg.descripcion || 'EQUIPO VAC',
              tipo: reg.tipo_producto || 'SG-IM'
            },
            disponible: 0,
            importacion: 0,
            inkjet: 0,
            acondicionado: 0,
            reesterilizado: 0,
            observados: 0,
            consignacion: 0,
            venta_sujeta: 0,
            stock_total: 0,
            stock_cx: 0,
            pendiente_revision: 0,
            ingenieria: 0,
            nueva_importacion: 0,
            internados: 0
          });
        }

        const itemObjeto = itemsAgrupadosMap.get(prodCodigo);
        const cantidad = Math.round(reg.cantidad || 0);

        if (reg.descripcion && itemObjeto.prod_id.descripcion === prodCodigo) {
          itemObjeto.prod_id.descripcion = reg.descripcion;
        }

        if (cantidad > 0) {
          const deposito = (reg.deposito || '').trim();
          const sector = (reg.sector || '').trim();

          if ((deposito === 'SG-APR' || deposito === 'RRM-APR') && sector !== 'AN-ING' && sector !== 'PRI-R82.A') {
            itemObjeto.stock_cx += cantidad;
          }
          if (deposito === 'SG-DEV' || deposito === 'RRM-DEV') {
            itemObjeto.pendiente_revision += cantidad;
          }
          if ((deposito === 'SG-APR' || deposito === 'RRM-APR') && sector === 'AN-ING') {
            itemObjeto.ingenieria += cantidad;
          }
          if (deposito === 'RRM-APR' && sector === 'PRI-R82.A') {
            itemObjeto.nueva_importacion += cantidad;
          }
          if (deposito.endsWith('-VS') || deposito.endsWith('-C')) {
            itemObjeto.internados += cantidad;
          }

          if (!deposito.endsWith('-BAJ') && !deposito.endsWith('-VAF') && !deposito.endsWith('-CSA')) {
            itemObjeto.stock_total += cantidad;
            const tieneCliente = reg.cliente && reg.cliente.trim() !== '' && reg.cliente.trim() !== '----';
            if (tieneCliente) {
              itemObjeto.consignacion += cantidad;
            } else {
              itemObjeto.disponible += cantidad;
            }
          }
        }
      });

      const todosItems = Array.from(itemsAgrupadosMap.values());
      this.stockItems.set(todosItems);
      this.totalCount.set(todosItems.length);
      console.log('Recarga automática silenciosa de Equipos VAC completada.');

    } catch (err) {
      console.error('Error en actualizarDatosVAC:', err);
    }
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

  /**
   * Calcula los días transcurridos desde la fecha de movimiento hasta el día de hoy.
   * @param fechaMovimiento Fecha de movimiento.
   */
  calcularDiasEmpleados(fechaMovimiento: string | Date | null | undefined): number {
    if (!fechaMovimiento) return 0;

    let fechaMov: Date;
    if (typeof fechaMovimiento === 'string') {
      const fechaStr = fechaMovimiento.includes('T') ? fechaMovimiento.split('T')[0] : fechaMovimiento;
      const partes = fechaStr.includes('-') ? fechaStr.split('-') : fechaStr.split('/');
      if (partes.length === 3) {
        const part0 = parseInt(partes[0], 10);
        const part1 = parseInt(partes[1], 10) - 1;
        const part2 = parseInt(partes[2], 10);
        if (part0 > 1000) {
          fechaMov = new Date(part0, part1, part2);
        } else {
          fechaMov = new Date(part2, part1, part0);
        }
      } else {
        fechaMov = new Date(fechaMovimiento);
      }
    } else {
      fechaMov = new Date(fechaMovimiento);
    }

    const hoy = new Date();
    fechaMov.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diffTime = hoy.getTime() - fechaMov.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  }

  /**
   * Calcula la suma de stock a mostrar en el círculo/badge del encabezado del detalle.
   * Si es modo Equipos VAC y mostrarKardexOriginal es verdadero, suma todos (incluyendo bajas).
   * Si mostrarKardexOriginal es falso, suma solo los activos (excluyendo bajas).
   * Para otros modos, retorna la cantidad consignada del producto.
   */
  obtenerSumaIconoDetalle(): number {
    if (!this.productoSeleccionado()) return 0;
    if (!this.modoCodigosFijos()) {
      return this.productoSeleccionado()?.consignacion || 0;
    }

    if (this.mostrarKardexOriginal()) {
      // Suma total de todos los registros (incluyendo depósitos de baja)
      return this.itemsConsignacionRaw().reduce((acumulador, reg) => acumulador + (reg.cantidad || 0), 0);
    } else {
      // Suma de los registros simplificados (excluyendo depósitos de baja)
      return this.itemsConsignacion().reduce((acumulador, reg) => acumulador + (reg.cantidad || 0), 0);
    }
  }

  /**
   * Obtiene la cantidad en valor absoluto (positivo).
   * @param cantidad Cantidad numérica.
   */
  obtenerCantidadAbsoluta(cantidad: number | null | undefined): number {
    return Math.abs(cantidad || 0);
  }
}

