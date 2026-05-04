import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Estado del tema: 'light' o 'dark'
  private theme = signal<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  public currentTheme = this.theme.asReadonly();

  constructor() {
    // Persistencia automática
    effect(() => {
      localStorage.setItem('theme', this.theme());
    });
  }

  toggleTheme() {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }
}
