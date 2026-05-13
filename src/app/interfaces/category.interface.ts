/**
 * Interfaz que representa una categoría de productos.
 * Se relaciona con Family a través de familia_id.
 */
export interface Category {
  id: number;
  url: string;
  nombre: string;
  tipos?: string[]; // Cambiado a array para soportar múltiples tipos por categoría
  familia_id: string | any; // URL de la familia relacionada o el objeto completo
}
