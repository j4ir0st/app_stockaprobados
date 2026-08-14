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
| **1.6.1** | 2026-08-13 | **Permiso de Acceso Especial (Equipos VAC)**: Se habilitó el acceso a la tabla detallada de stock de Equipos VAC para la usuaria `nmalasquez` en la señal `puedeVerTablaActualVAC`, permitiéndole visualizar, desplegar y exportar la tabla completa de Equipos VAC independientemente de su área asignada. |
| **1.6.0** | 2026-08-10 | **Columna `TRANS.` (Mercadería en Tránsito)**: Se incorporó la columna `TRANS.` entre `VTA.` y `TOTAL` en la tabla principal de Stock Aprobados. La información se recupera asíncronamente desde `/SI_Transito/` con `top=1000`, mostrando un spinner animado (`fa-spinner fa-spin`) mientras se completa la consulta. Mapea y suma el campo de cantidad pendiente (`cant_pend`) por código coincidente o muestra `0` si no existen registros en tránsito. Incluye soporte para exportación a Excel. |
| **1.5.9** | 2026-08-10 | **Ordenamiento por Parámetro `ordering` en Tabla Principal**: Se agregaron flechas de ordenamiento interactivo (ascendente, descendente y deshabilitado) en las columnas **STOCK DISP.** y **TOTAL** para Stock General y demás opciones que consultan `StockAprobado`. La consulta envía el parámetro `?ordering=` (`disponible`, `-disponible`, `stock`, `-stock`), preservando el estado durante la paginación y manteniéndose deshabilitado por defecto al navegar entre menú. |
| **1.5.8** | 2026-08-03 | **Centrado Global de Columnas Numéricas**: Se generalizó la alineación centrada a todas las columnas numéricas de stock en la tabla estándar (Stock General, etc.), y a las columnas "Días Empleados" y "Cantidad" en la vista de detalle de todos los productos. |
| **1.5.7** | 2026-08-03 | **Actualización de Nombre de Sidebar**: Se modificó la etiqueta visual de "Heridas & Quemados" en el menú de navegación (sidebar) a "H&Q y VARIOS", y se ajustó la lista de restricciones de usuario correspondientes para mantener el control de acceso consistente. |
| **1.5.6** | 2026-08-03 | **Centrado de Columnas Numéricas (Equipos VAC)**: Se aplicó alineación centrada a todas las columnas numéricas de stock en la tabla principal y a la columna de cantidad en el resumen por representante para mejorar la legibilidad y estética visual. |
| **1.5.5** | 2026-08-03 | **Filtro por Paciente y Orden Compuesto (Equipos VAC)**: Se añadió un filtro en memoria por paciente exclusivo de la vista detallada por representante. También se habilitó el ordenamiento interactivo (asc/desc/deshabilitado) por representante con un ordenamiento compuesto dinámico en memoria (Representante + Fecha Movimiento). |
| **1.5.4** | 2026-07-31 | **Actualización Automática de Equipos VAC**: Implementación de recarga automática en segundo plano cada minuto para la sección Equipos VAC (tanto en vista principal como detallada) sin reiniciar filtros o indicadores de carga molestos. Se integró un temporizador visual sutil en la esquina inferior derecha. |
| **1.5.3** | 2026-07-31 | **Ajustes en Disponibilidad y Filtros (Equipos VAC)**: Se cambió el estado 'INTERNADOS' a 'INTERNADO' en singular. Se configuró para que el filtro de disponibilidad en el detalle del Total General de representantes se oculte por defecto y solo se muestre al ver los registros individuales (Kardex original). |
| **1.5.2** | 2026-07-31 | **Filtrado Avanzado en Detalle de Equipos VAC**: Ocultamiento dinámico del filtro de 'Depósito' para Equipos VAC (sólo se visualiza al ver el kardex original/registros). Se añadió un nuevo filtro en memoria para el campo 'Disponibilidad' con la misma estética de los filtros existentes. |
| **1.5.1** | 2026-07-31 | **Columna de Disponibilidad en Detalle de Equipos VAC**: Se agregó el campo 'Disponibilidad' en la tabla detalle por código y en el Total General para Equipos VAC. Este campo utiliza un formato de badge con colores específicos adaptados a Light y Dark mode (Verde para STOCK, Anaranjado para PEND., Azul para INGENIERIA, Morado para NUEVA y Amarillo para INTERNADOS). También se incluyó el campo en la exportación a Excel. |
| **1.5.0** | 2026-07-30 | **Resumen de Equipos VAC y Control por Rol**: Se implementó una tabla resumen agrupando los Equipos VAC por representante, mostrando cantidades asignadas (internadas) y un Total General. Se configuró el ocultamiento por defecto de la tabla detallada, la cual solo se muestra al hacer clic en el título de la sección y si el usuario pertenece al área de 'Atenciones' o 'Desarrollo Software'. |
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
