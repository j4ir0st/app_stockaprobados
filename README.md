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
| **1.2.0** | 2026-05-06 | Refinamiento de UX y Navegación: Botón de cierre (X) en selector de colores, cierre automático de menús al hacer clic fuera, y sincronización total de hovers/scrollbars con la paleta dinámica. Optimización de lógica en Sidebar para resaltar familias/categorías según filtros de URL y limpieza inteligente en 'Stock General'. |
| **1.1.0** | 2026-05-05 | Personalización estética: Selector de colores primario y secundario en el header, con persistencia en caché local. |
| **1.0.0** | 2026-05-04 | Separación definitiva de la aplicación de Stock Inventario (Almacenaje). Se eliminó todo lo relativo a almacenaje en este proyecto, dejando solo el acceso a Stock Aprobado. |

## Notas Técnicas Recientes

- **Sistema de Temas Dinámicos**: Se utiliza la función CSS `color-mix(in srgb, ...)` para generar variantes de transparencia y contraste en tiempo real basadas en las variables `--primary-blue` y `--secondary-color`. Esto asegura que la interfaz sea legible y estética independientemente de los colores elegidos.
- **Gestión de Estado de Navegación**: El Sidebar ahora reacciona de forma reactiva a los `queryParams` de la URL, permitiendo que la selección visual persista tras recargas de página o navegaciones directas.
| **0.2.0** | 2026-04-30 | Implementación de refresco global desde el header con animaciones y actualización de contexto (Stock Aprobado / Inventario). |
| **0.1.0** | 2026-04-24 | Inicialización del proyecto Angular, configuración de Docker y estructura base. |

---
*Este documento se mantendrá actualizado con cada mejora significativa del sistema.*
