import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = signal('');
  password = signal('');
  showPassword = signal(false);
  error = signal('');
  loading = signal(false);
  currentYear = signal(new Date().getFullYear());

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  // El logo se sirve directamente desde la raíz del servidor oficial (IIS)
  logoUrl = '/NewAPI/static/avatars/LogoSurgiC_SinFondo.png';

  async onLogin() {
    if (!this.usuario() || !this.password()) {
      this.error.set('Por favor, complete todos los campos');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.authService.login(this.usuario(), this.password());
      console.log('Login exitoso');
      this.router.navigate(['/inventory']);
    } catch (e: any) {
      console.error('Error de login:', e);
      if (e.status === 401) {
        this.error.set('Usuario o contraseña incorrectos');
      } else {
        this.error.set('Error de conexión con el servidor');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
