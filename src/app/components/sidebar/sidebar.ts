import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ConfigService } from '../../services/config.service';
import { SidebarService } from '../../services/sidebar.service';

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
  logoUrl = '/NewAPI/static/avatars/LogoSurgiC_SinFondo.png';

  menuItems = [
    { label: 'Principal', route: '/inventory', icon: 'assets/images/casa-nueva.png', isAsset: true },
    { label: 'Neurocirugía', route: '/neuro', icon: 'assets/images/Neurocirugía-icon.png', isAsset: true },
    { label: 'Quemados y Heridas', route: '/quemados', icon: 'assets/images/Quemados y Heridas-icon.png', isAsset: true },
    { label: 'T. de Sueño y Apnea', route: '/sueno', icon: 'assets/images/Terapia de Sueño y Apnea-icon.png', isAsset: true },
    { label: 'Traumatología', route: '/trauma', icon: 'assets/images/Traumatología-icon.png', isAsset: true },
  ];

  footerItems = [
    { label: 'Almacenaje', route: '/storage', icon: 'assets/images/valores.png', isAsset: true },
  ];
}
