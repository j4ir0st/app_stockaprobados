/**
 * Interfaz que representa una categoría de productos.
 * Se relaciona con Family a través de familia_id.
 */
export interface Category {
  id: number;
  url: string;
  nombre: string;
  tipo?: string; // Regresamos a string simple (ForeignKey en Backend)
  familia_id: string | any; // URL de la familia relacionada o el objeto completo
}
