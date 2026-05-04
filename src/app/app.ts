import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar';
import { HeaderComponent } from './components/header/header';
import { filter } from 'rxjs/operators';
import { SidebarService } from './services/sidebar.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    SidebarComponent, 
    HeaderComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  title = 'Surgicorp Stock';
  isLoginPage = false;
  public sidebarService = inject(SidebarService);
  public authService = inject(AuthService);

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url;
      // Solo ocultar header/sidebar si estamos explícitamente en login
      this.isLoginPage = url.includes('/login');
      console.log('Route changed:', url, 'isLoginPage:', this.isLoginPage);
      
      // Verificamos el usuario actual
      const user = this.authService.currentUser();
      console.log('Current User in App:', user);
    });
  }
}
