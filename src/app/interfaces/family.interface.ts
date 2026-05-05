/**
 * Interfaz que representa una familia de productos.
 */
export interface Family {
  url: string;
  nombre: string;
  tipo: { [key: string]: string };
}
