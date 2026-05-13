import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Family } from '../interfaces/family.interface';
import { Category } from '../interfaces/category.interface';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio para gestionar las familias (SA_Familia) con caché de 24h.
 */
@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private apiService = inject(ApiService);
  private readonly CACHE_KEY_FAMILIES = 'sa_familia_cache';
  private readonly CACHE_KEY_CATEGORIES = 'sa_categoria_cache';
  private readonly CACHE_TIME = 24 * 60 * 60 * 1000; // 24 horas

  // Señales públicas para acceder a los datos
  public families = signal<Family[]>([]);
  public categories = signal<Category[]>([]);

  constructor() {
    this.init();
  }

  /**
   * Inicialización asíncrona en segundo plano.
   */
  private async init() {
    const cachedFamilies = this.getCache<Family>(this.CACHE_KEY_FAMILIES);
    const cachedCategories = this.getCache<Category>(this.CACHE_KEY_CATEGORIES);

    if (cachedFamilies) {
      this.families.set(cachedFamilies.sort((a, b) => a.id - b.id));
    } else {
      await this.refreshFamilies();
    }

    if (cachedCategories) {
      this.categories.set(cachedCategories);
    } else {
      await this.refreshCategories();
    }
  }

  /**
   * Obtiene los datos del localStorage si no han expirado.
   */
  private getCache<T>(key: string): T[] | null {
    const cachedStr = localStorage.getItem(key);
    if (!cachedStr) return null;

    try {
      const cached = JSON.parse(cachedStr);
      const now = Date.now();
      if (now - cached.timestamp < this.CACHE_TIME) {
        return cached.data;
      }
    } catch (e) {
      console.error(`Error al parsear cache de ${key}`, e);
    }
    return null;
  }

  /**
   * Limpia la caché y vuelve a descargar los datos de la API.
   */
  /**
   * Limpia la caché y vuelve a descargar las familias de la API de forma recursiva (manejando paginación).
   */
  public async refreshFamilies() {
    try {
      let allFamilies: Family[] = [];
      let nextUrl: string | null = 'SA_Familia/';

      while (nextUrl) {
        const response = await firstValueFrom(this.apiService.get<any>(nextUrl));
        const data = response.results || response;
        allFamilies = [...allFamilies, ...(Array.isArray(data) ? data : [data])];
        
        // Lógica robusta para extraer la ruta de paginación de DRF
        if (response.next) {
          try {
            const absoluteUrl: string = response.next;
            if (absoluteUrl.includes('/api/')) {
              nextUrl = absoluteUrl.split('/api/')[1];
            } else {
              const match = absoluteUrl.match(/https?:\/\/[^\/]+\/(.+)/);
              nextUrl = match ? match[1] : null;
            }
          } catch (e) {
            nextUrl = null;
          }
        } else {
          nextUrl = null;
        }
        
        if (!response.results) break;
      }

      // Ordenar familias por id de menor a mayor
      allFamilies.sort((a, b) => a.id - b.id);

      this.families.set(allFamilies);
      localStorage.setItem(this.CACHE_KEY_FAMILIES, JSON.stringify({
        data: allFamilies,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error al cargar familias desde la API:', error);
    }
  }

  /**
   * Limpia la caché y vuelve a descargar las categorías de la API de forma recursiva (manejando paginación).
   */
  public async refreshCategories() {
    try {
      let allCategories: Category[] = [];
      let nextUrl: string | null = 'SA_Categoria/';

      while (nextUrl) {
        const response = await firstValueFrom(this.apiService.get<any>(nextUrl));
        const data = response.results || response;
        allCategories = [...allCategories, ...(Array.isArray(data) ? data : [data])];
        
        // Lógica robusta para extraer la ruta de paginación de DRF
        if (response.next) {
          try {
            // Intentamos extraer solo la parte de la ruta y parámetros después de /api/ o del dominio
            const absoluteUrl: string = response.next;
            if (absoluteUrl.includes('/api/')) {
              nextUrl = absoluteUrl.split('/api/')[1];
            } else {
              // Si no contiene /api/, extraemos desde la primera barra después del dominio
              const match = absoluteUrl.match(/https?:\/\/[^\/]+\/(.+)/);
              nextUrl = match ? match[1] : null;
            }
          } catch (e) {
            nextUrl = null;
          }
        } else {
          nextUrl = null;
        }

        if (!response.results) break;
      }
      
      this.categories.set(allCategories);
      localStorage.setItem(this.CACHE_KEY_CATEGORIES, JSON.stringify({
        data: allCategories,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error al cargar categorías desde la API:', error);
    }
  }

  /**
   * Limpia toda la caché del catálogo.
   */
  public clearCache() {
    localStorage.removeItem(this.CACHE_KEY_FAMILIES);
    localStorage.removeItem(this.CACHE_KEY_CATEGORIES);
  }

  /**
   * Método de refresco global para familias y categorías.
   */
  public async refreshAll() {
    this.clearCache();
    await Promise.all([this.refreshFamilies(), this.refreshCategories()]);
  }
}
