# App Stock - Atenciones

Proyecto para el control de inventario y gestión de atenciones de Surgicorp. Este proyecto consiste en un frontend desarrollado en **Angular** que se conecta a una API existente en **Django Rest Framework (DRF)**.

## Propósito del Proyecto
El objetivo principal es proporcionar una interfaz moderna, intuitiva y eficiente para la administración de stock aprobado, permitiendo búsquedas rápidas por descripción de producto y código de producto, así como la visualización detallada de las existencias en diferentes estados (Disponible, Importación, Acondicionado, etc.).

## Estructura del Proyecto
- **Frontend**: Aplicación Angular (v19+) utilizando Componentes Independientes (Standalone), Señales (Signals) y una arquitectura limpia.
- **Backend**: API externa en Django Rest Framework (acceso restringido).
- **Despliegue**: Contenerizado mediante Docker y orquestado con Docker Compose para facilitar la instalación en el servidor de producción.

## Implementación con Docker
Para desplegar la aplicación en un servidor, se utiliza Docker. El proceso compila la aplicación Angular y la sirve mediante un servidor Nginx optimizado.

### Requisitos
- Docker
- Docker Compose

### Pasos para la instalación
1. Clonar el repositorio.
2. Crear un archivo `.env` basado en la documentación interna (no incluido en el repositorio por seguridad).
3. Ejecutar el comando:
   ```bash
   docker-compose up -d --build
   ```

## Registro de Mejoras y Versiones

| Versión | Fecha | Descripción de Cambios |
| :--- | :--- | :--- |
| **1.4.1** | 2026-05-14 | **Corrección de Autenticación y Proxy**: Se corrigieron los errores 404 y de falta de credenciales al acceder a las tablas `SA_Familia`, `SA_Categoria` y `SA_TipoCategoria`. Se actualizó el interceptor de autenticación, la configuración del proxy de desarrollo y la plantilla de Nginx para producción. |
| **1.4.0** | 2026-05-14 | **Mejora de Precisión en Filtros y UX**: Implementación de filtrado combinado (Categoría + Familia) para evitar la mezcla de registros. Se añadió la limpieza automática del buscador por código al interactuar con el sidebar o seleccionar filtros, mejorando la experiencia de navegación. |
| **1.3.0** | 2026-05-14 | **Optimización de Categorías y Traumatología**: Soporte para relación Many-to-Many entre Productos y Categorías. Filtrado inteligente en tabla para mostrar solo categorías relevantes al filtro activo. Mejora del flujo en Traumatología con filtrado por 'Tipo de Categoría' (distinct), títulos dinámicos y restricción de clics en cabeceras de familia. Exportación a Excel ahora respeta filtros aplicados. |
| **1.2.0** | 2026-05-06 | Refinamiento de UX y Navegación: Botón de cierre (X) en selector de colores, cierre automático de menús al hacer clic fuera, y sincronización total de hovers/scrollbars con la paleta dinámica. Optimización de lógica en Sidebar para resaltar familias/categorías según filtros de URL y limpieza inteligente en 'Stock General'. |
| **1.1.0** | 2026-05-05 | Personalización estética: Selector de colores primario y secundario en el header, con persistencia en caché local. |
| **1.0.0** | 2026-05-04 | Separación definitiva de la aplicación de Stock Inventario (Almacenaje). Se eliminó todo lo relativo a almacenaje en este proyecto, dejando solo el acceso a Stock Aprobado. |

## Notas Técnicas Recientes

- **Seguridad y Proxy Unificado**: Se centralizaron las rutas de la API (`/api`, `/StockAprobado`, `/SA_`) tanto en `proxy.conf.js` como en `nginx.conf.template`. El `authInterceptor` fue optimizado para inyectar automáticamente el token JWT en todas las peticiones internas, asegurando que las tablas maestras de familias y categorías carguen correctamente con los permisos necesarios.
- **Limpieza Automática de Búsqueda**: Se implementó una suscripción en `InventoryComponent` que resetea el término de búsqueda (`searchTerm`) cada vez que se detecta una navegación desde el sidebar o se dispara el evento `limpiarBusqueda$` desde `RefreshService`. Esto evita que filtros de búsqueda antiguos interfieran con la nueva selección de familias o categorías.
- **Filtrado Combinado**: Se optimizó la navegación para que, al seleccionar una categoría, se envíe automáticamente el nombre de la familia asociada como parámetro de filtro (`prod_id__cat_id__familia_id__nombre`). Esto garantiza la unicidad de los registros mostrados en familias que comparten nombres de categorías (ej: HQ vs NR).
- **Soporte Many-to-Many (M2M)**: El sistema ahora procesa productos vinculados a múltiples categorías. Se implementó una lógica de visualización inteligente que concatena categorías únicas y filtra la lista mostrada en la tabla según el contexto de búsqueda del usuario (Tipo o Nombre de Categoría).
- **Filtrado Avanzado (Trauma)**: Se habilitó el filtrado por `tipo_id__nombre` para la sección de Traumatología, permitiendo agrupaciones lógicas ("Clavos", "Prótesis", etc.) independientes del nombre comercial de la categoría.
- **Optimización de Reportes**: La función de descarga de Excel fue refactorizada para utilizar `firstValueFrom` (RxJS 7+) y ahora aplica los filtros activos de la tabla a la petición del servidor, reduciendo drásticamente el tamaño de los archivos generados.
- **Sistema de Temas Dinámicos**: Se utiliza la función CSS `color-mix(in srgb, ...)` para generar variantes de transparencia y contraste en tiempo real basadas en las variables `--primary-blue` y `--secondary-color`. Esto asegura que la interfaz sea legible y estética independientemente de los colores elegidos.
| **0.2.0** | 2026-04-30 | Implementación de refresco global desde el header con animaciones y actualización de contexto (Stock Aprobado / Inventario). |
| **0.1.0** | 2026-04-24 | Inicialización del proyecto Angular, configuración de Docker y estructura base. |

---
*Este documento se mantendrá actualizado con cada mejora significativa del sistema.*
