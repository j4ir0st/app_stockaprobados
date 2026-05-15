import { Component, inject, computed, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { FamilyService } from '../../services/family.service';
import { ConfigService } from '../../services/config.service';
import { ThemeService } from '../../services/theme.service';
import { RefreshService } from '../../services/refresh.service';
import { Category } from '../../interfaces/category.interface';

/**
 * Componente de barra lateral para la navegación principal.
 * Sigue los lineamientos de diseño premium con temática oscura.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  private configService = inject(ConfigService);
  public sidebarService = inject(SidebarService);
  public familyService = inject(FamilyService);
  public themeService = inject(ThemeService);
  private refreshService = inject(RefreshService);
  private router = inject(Router);
  private eRef = inject(ElementRef);
  private route = inject(ActivatedRoute);

  logoUrl = '/NewAPI/static/avatars/LogoSurgiC_SinFondo.png';
  
  // Señal para detectar si estamos en Stock General (sin filtros)
  public isStockGeneralActive = signal(true);
  
  // Señal para la familia activa según los filtros
  public activeTypeKey = signal<string | null>(null);

  // Estado para la familia seleccionada, hover y categoría seleccionada
  public selectedTypeKey = signal<string | null>(null);
  public hoveredFamilyUrl = signal<string | null>(null);
  public selectedCategoryUrl = signal<string | null>(null);

  constructor() {
    // Escuchar cambios en los parámetros de consulta para actualizar el estado del sidebar
    this.route.queryParams.subscribe(params => {
      const hasFilters = Object.keys(params).length > 0;
      this.isStockGeneralActive.set(!hasFilters);

      if (hasFilters) {
        // Buscar a qué familia pertenece el filtro aplicado
        const familiaNombre = params['prod_id__cat_id__familia_id__nombre'];
        const categoriaNombre = params['prod_id__cat_id__nombre'];
        const tipoCategoria = params['prod_id__cat_id__tipo_id__nombre'] || params['prod_id__cat_id__tipo'];
        
        if (familiaNombre || categoriaNombre || tipoCategoria) {
          // Necesitamos saber a qué typeKey corresponde.
          this.updateActiveTypeKey(familiaNombre, categoriaNombre, tipoCategoria);
        } else {
          this.activeTypeKey.set(null);
        }
      } else {
        this.activeTypeKey.set(null);
      }
    });
  }

  private updateActiveTypeKey(familiaNombre?: string, categoriaNombre?: string, tipoCategoria?: string) {
    let targetFamilia: any = null;
    
    if (familiaNombre) {
      targetFamilia = this.familyService.families().find(f => f.nombre === familiaNombre);
    } else if (categoriaNombre) {
      const cat = this.familyService.categories().find(c => c.nombre === categoriaNombre);
      if (cat && cat.familia_id) {
        const famUrl = typeof cat.familia_id === 'string' ? cat.familia_id : cat.familia_id.url;
        targetFamilia = this.familyService.families().find(f => f.url === famUrl);
      }
    } else if (tipoCategoria) {
      const cat = this.familyService.categories().find(c => c.tipo === tipoCategoria);
      if (cat && cat.familia_id) {
        const famUrl = typeof cat.familia_id === 'string' ? cat.familia_id : cat.familia_id.url;
        targetFamilia = this.familyService.families().find(f => f.url === famUrl);
      }
    }

    if (targetFamilia && targetFamilia.tipo) {
      // Encontrar qué typeKey de nuestro menuItems coincide con el tipo de la familia
      const typeKey = Object.keys(targetFamilia.tipo)[0]; // Asumimos que tiene uno
      this.activeTypeKey.set(typeKey);
    } else {
      this.activeTypeKey.set(null);
    }
  }

  /**
   * Obtiene las categorías de la familia que tiene el hover.
   */
  public hoveredCategories = computed(() => {
    const url = this.hoveredFamilyUrl();
    if (!url) return [];
    
    // Normalizar URLs para comparación robusta (sin protocolo y sin barra final)
    const normalize = (u: string) => u ? u.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    const targetUrl = normalize(url);

    let cats = this.familyService.categories().filter(c => {
      if (!c.familia_id) return false;
      // Manejar tanto si familia_id es una URL (string) como si es un objeto
      const famUrl = typeof c.familia_id === 'string' ? c.familia_id : c.familia_id.url;
      return normalize(famUrl) === targetUrl;
    });

    // Caso especial para Traumatología: Mostrar TIPOS de categoría ordenados y sin duplicados
    if (this.selectedTypeKey() === 'TR') {
      // 1. Ordenar por ID de menor a mayor
      cats.sort((a, b) => (a.id || 0) - (b.id || 0));

      // 2. Hacer distinct por el campo 'tipo' (resiliente a objetos o strings)
      const uniqueTypes = new Map<string, any>();
      cats.forEach(c => {
        // El backend puede enviar 'tipo' como string (SlugRelatedField) o como objeto
        const tipoValue = (c as any).tipo || (c as any).tipo_id;
        const tipoName = typeof tipoValue === 'string' ? tipoValue : tipoValue?.nombre;
        
        if (tipoName && !uniqueTypes.has(tipoName)) {
          uniqueTypes.set(tipoName, {
            ...c,
            nombre: tipoName, // El nombre a mostrar es el tipo
            url: `type-${tipoName}`, // URL ficticia para selección
            activeTipo: tipoName // Campo auxiliar para saber qué tipo se clickeó
          });
        }
      });
      return Array.from(uniqueTypes.values());
    }

    return cats;
  });

  /**
   * Obtiene las familias filtradas por el tipo seleccionado.
   */
  public filteredFamilies = computed(() => {
    const key = this.selectedTypeKey();
    if (!key) return [];

    return this.familyService.families().filter(f => f.tipo && f.tipo.hasOwnProperty(key));
  });

  /**
   * Obtiene el ítem de menú activo actualmente en el flyout.
   */
  public activeMenuItem = computed(() => {
    const key = this.selectedTypeKey();
    return this.configService.menuItems.find(item => item.typeKey === key);
  });

  get menuItems() {
    return this.configService.menuItems;
  }

  /**
   * Maneja el clic en un ítem del menú.
   */
  onItemClick(event: Event, item: any) {
    // Prevenir que el clic se propague al HostListener del documento
    event.stopPropagation();

    console.log('Sidebar onItemClick:', item.label);
    
    // Limpiar búsqueda por código al interactuar con el sidebar
    this.refreshService.solicitarLimpiarBusqueda();

    if (item.label === 'Stock General') {
      this.selectedTypeKey.set(null);
      this.router.navigate(['/inventory'], { queryParams: {} });
      return;
    }

    // Si ya está seleccionado, lo cerramos. Si no, abrimos el nuevo.
    if (this.selectedTypeKey() === item.typeKey) {
      this.selectedTypeKey.set(null);
    } else {
      this.selectedTypeKey.set(item.typeKey);
      // Se omite la carga de datos al hacer click en los iconos de categorías, solo se abre el menú.
    }
  }

  /**
   * Filtra la tabla por el tipo de familia (ej: HQ, TR, etc) al hacer clic en el título del flyout.
   */
  onTypeHeaderClick() {
    const item = this.activeMenuItem();
    if (!item || !item.typeKey) return;

    console.log('Filtrando por tipo de familia:', item.typeKey);
    this.refreshService.solicitarLimpiarBusqueda();
    this.router.navigate(['/inventory'], {
      queryParams: { prod_id__cat_id__familia_id__tipo: item.typeKey }
    });
    this.closeFlyout();
  }

  /**
   * Filtra la tabla por el nombre de la familia seleccionada.
   */
  onFamilyHeaderClick(event: Event, family: any) {
    event.stopPropagation();
    
    // Funcionalidad exclusiva para Traumatología: No se permite filtrar por familia directamente
    if (this.selectedTypeKey() === 'TR') {
      return;
    }

    this.selectedCategoryUrl.set(null); // Reset categoría si se filtra por familia
    this.router.navigate(['/inventory'], {
      queryParams: { prod_id__cat_id__familia_id__nombre: family.nombre }
    });
    this.closeFlyout();
  }

  /**
   * Cierra la lista flotante.
   */
  closeFlyout() {
    this.selectedTypeKey.set(null);
    this.hoveredFamilyUrl.set(null);
    this.selectedCategoryUrl.set(null);
  }

  /**
   * Filtra la tabla por el nombre de la categoría seleccionada.
   * Incluye el filtro de familia para evitar mezclas de registros en HQ, NR y TS.
   */
  onCategoryClick(category: Category, family: any) {
    this.selectedCategoryUrl.set(category.url);
    
    const typeKey = this.selectedTypeKey();

    // Para Traumatología (TR) filtramos por tipo de categoría en lugar de nombre
    if (typeKey === 'TR' && (category as any).activeTipo) {
      this.router.navigate(['/inventory'], {
        queryParams: { prod_id__cat_id__tipo_id__nombre: (category as any).activeTipo }
      });
    } else {
      const queryParams: any = { prod_id__cat_id__nombre: category.nombre };
      
      // Aplicar filtro de familia para HQ, NR y TS para evitar que se mezclen registros de diferentes familias
      if (typeKey === 'HQ' || typeKey === 'NR' || typeKey === 'TS') {
        queryParams.prod_id__cat_id__familia_id__nombre = family.nombre;
      }

      this.router.navigate(['/inventory'], { queryParams });
    }
    this.closeFlyout();
  }

  /**
   * Detecta clics fuera del componente para cerrar la lista flotante.
   */
  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.closeFlyout();
    }
  }

  footerItems = [
    { label: '', route: null, icon: 'assets/images/valores.png', isAsset: true },
  ];
}
