import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private sujetoRefresco = new Subject<void>();
  private sujetoLimpiarBusqueda = new Subject<void>();

  // Observable al que los componentes se suscribirán para saber cuándo refrescar o limpiar búsqueda
  refresco$ = this.sujetoRefresco.asObservable();
  limpiarBusqueda$ = this.sujetoLimpiarBusqueda.asObservable();

  /**
   * Dispara un evento de refresco.
   */
  solicitarRefresco() {
    this.sujetoRefresco.next();
  }

  /**
   * Dispara un evento para limpiar el campo de búsqueda.
   */
  solicitarLimpiarBusqueda() {
    this.sujetoLimpiarBusqueda.next();
  }
}
