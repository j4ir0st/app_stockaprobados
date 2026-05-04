import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // Estado del sidebar (colapsado o no)
  isCollapsed = signal(false);

  toggle() {
    this.isCollapsed.update(v => !v);
  }
}
