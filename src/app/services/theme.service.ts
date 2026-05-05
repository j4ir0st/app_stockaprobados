import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Estado del tema: 'light' o 'dark'
  private theme = signal<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  // Colores base personalizables (Valores por defecto: azul vibrante y verde petróleo)
  private primaryColor = signal<string>(
    localStorage.getItem('primaryColor') || '#007bff'
  );
  
  private secondaryColor = signal<string>(
    localStorage.getItem('secondaryColor') || '#417690'
  );

  public currentTheme = this.theme.asReadonly();
  public currentPrimaryColor = this.primaryColor.asReadonly();
  public currentSecondaryColor = this.secondaryColor.asReadonly();

  constructor() {
    // Persistencia automática del tema
    effect(() => {
      localStorage.setItem('theme', this.theme());
    });

    // Aplicación y persistencia de colores personalizados
    effect(() => {
      const primary = this.primaryColor();
      const secondary = this.secondaryColor();
      
      localStorage.setItem('primaryColor', primary);
      localStorage.setItem('secondaryColor', secondary);
      
      this.applyColors(primary, secondary);
    });
  }

  toggleTheme() {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }

  /**
   * Actualiza los colores base de la aplicación.
   * @param primary Color primario (ej. para el sidebar y códigos)
   * @param secondary Color secundario (ej. para encabezados y modo oscuro)
   */
  setColors(primary: string, secondary: string) {
    this.primaryColor.set(primary);
    this.secondaryColor.set(secondary);
  }

  /**
   * Aplica los colores seleccionados a las variables CSS globales.
   */
  private applyColors(primary: string, secondary: string) {
    const root = document.documentElement;
    root.style.setProperty('--primary-blue', primary);
    root.style.setProperty('--secondary-color', secondary);
    
    // Actualizar colores derivados o específicos si es necesario
    root.style.setProperty('--table-header-text', secondary);
  }
}
