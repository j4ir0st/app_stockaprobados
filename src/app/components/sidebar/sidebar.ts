import { Component, inject, computed, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { FamilyService } from '../../services/family.service';
import { ConfigService } from '../../services/config.service';
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
  private router = inject(Router);
  private eRef = inject(ElementRef);

  logoUrl = '/NewAPI/static/avatars/LogoSurgiC_SinFondo.png';

  // Estado para la familia seleccionada, hover y categoría seleccionada
  public selectedTypeKey = signal<string | null>(null);
  public hoveredFamilyUrl = signal<string | null>(null);
  public selectedCategoryUrl = signal<string | null>(null);

  /**
   * Obtiene las categorías de la familia que tiene el hover.
   */
  public hoveredCategories = computed(() => {
    const url = this.hoveredFamilyUrl();
    if (!url) return [];
    
    // Normalizar URLs para comparación robusta (sin protocolo y sin barra final)
    const normalize = (u: string) => u ? u.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    const targetUrl = normalize(url);

    return this.familyService.categories().filter(c => {
      if (!c.familia_id) return false;
      // Manejar tanto si familia_id es una URL (string) como si es un objeto
      const famUrl = typeof c.familia_id === 'string' ? c.familia_id : c.familia_id.url;
      return normalize(famUrl) === targetUrl;
    });
  });

  /**
   * Obtiene las familias filtradas por el tipo seleccionado.
   */
  public filteredFamilies = computed(() => {
    const key = this.selectedTypeKey();
    if (!key) return [];

    return this.familyService.families().filter(f => f.tipo && f.tipo.hasOwnProperty(key));
  });

  menuItems = [
    { label: 'Stock General', route: '/inventory', icon: 'assets/images/casa-nueva.png', isAsset: true },
    { label: 'Heridas & Quemados', route: '/quemados', icon: 'assets/images/Quemados y Heridas-icon.png', isAsset: true, typeKey: 'HQ' },
    { label: 'Traumatología', route: '/trauma', icon: 'assets/images/Traumatología-icon.png', isAsset: true, typeKey: 'TR' },
    { label: 'Neurocirugía', route: '/neuro', icon: 'assets/images/Neurocirugía-icon.png', isAsset: true, typeKey: 'NR' },
    { label: 'T. de Sueño y Apnea', route: '/sueno', icon: 'assets/images/Terapia de Sueño y Apnea-icon.png', isAsset: true, typeKey: 'TS' },
  ];

  /**
   * Maneja el clic en un ítem del menú.
   */
  onItemClick(event: Event, item: any) {
    // Prevenir que el clic se propague al HostListener del documento
    event.stopPropagation();

    if (item.label === 'Stock General') {
      this.selectedTypeKey.set(null);
      return;
    }

    // Si ya está seleccionado, lo cerramos. Si no, abrimos el nuevo.
    if (this.selectedTypeKey() === item.typeKey) {
      this.selectedTypeKey.set(null);
    } else {
      this.selectedTypeKey.set(item.typeKey);
      // Al entrar en una sección, nos aseguramos de estar en la base pero sin el estilo 'active' de Principal
      this.router.navigate(['/inventory']);
    }
  }

  /**
   * Filtra la tabla por el nombre de la familia seleccionada.
   */
  onFamilyHeaderClick(event: Event, family: any) {
    event.stopPropagation();
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
   */
  onCategoryClick(category: Category) {
    this.selectedCategoryUrl.set(category.url);
    this.router.navigate(['/inventory'], {
      queryParams: { prod_id__cat_id__nombre: category.nombre }
    });
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
