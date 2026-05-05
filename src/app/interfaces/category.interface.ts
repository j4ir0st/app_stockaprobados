/**
 * Interfaz que representa una categoría de productos.
 * Se relaciona con Family a través de familia_id.
 */
export interface Category {
  url: string;
  nombre: string;
  familia_id: string | any; // URL de la familia relacionada o el objeto completo
}
