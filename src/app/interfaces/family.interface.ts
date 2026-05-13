/**
 * Interfaz que representa una familia de productos.
 */
export interface Family {
  id: number;
  url: string;
  nombre: string;
  tipo: { [key: string]: string };
}
