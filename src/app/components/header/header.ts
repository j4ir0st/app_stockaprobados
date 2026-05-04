import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ThemeService } from '../../services/theme.service';
import { RefreshService } from '../../services/refresh.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  public authService = inject(AuthService);
  public sidebarService = inject(SidebarService);
  public themeService = inject(ThemeService);
  private refreshService = inject(RefreshService);
  
  // Señales para el estado de refresco
  public estaRefrescando = signal(false);
  public mostrarMensajeExito = signal(false);
  
  constructor() {
    console.log('HeaderComponent initialized. Current user:', this.authService.currentUser());
  }
  
  isProfileOpen = signal(false);

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  toggleProfile() {
    this.isProfileOpen.update((v: boolean) => !v);
  }

  logout() {
    this.authService.logout();
  }

  /**
   * Ejecuta la acción de refresco de datos.
   * Dispara el evento global y activa las animaciones del header.
   */
  refrescar() {
    if (this.estaRefrescando()) return;

    this.estaRefrescando.set(true);
    
    // Disparar el refresco en el componente activo
    this.refreshService.solicitarRefresco();

    // Simular tiempo de carga y mostrar mensaje de éxito
    setTimeout(() => {
      this.estaRefrescando.set(false);
      this.mostrarMensajeExito.set(true);
      
      // El mensaje de "REGISTRO DE STOCK ACTUALIZADO" dura 3 segundos
      setTimeout(() => {
        this.mostrarMensajeExito.set(false);
      }, 3000);
    }, 1000); // El icono gira por al menos 1 segundo
  }
}
