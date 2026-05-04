import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private sujetoRefresco = new Subject<void>();

  // Observable al que los componentes se suscribirán para saber cuándo refrescar
  refresco$ = this.sujetoRefresco.asObservable();

  /**
   * Dispara un evento de refresco.
   */
  solicitarRefresco() {
    this.sujetoRefresco.next();
  }
}
