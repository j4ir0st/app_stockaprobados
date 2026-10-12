# 📱 Guía de Integración Frontend — Módulo Equipos VAC

Este documento describe la especificación técnica, endpoints masivos, auto-creación de seguimientos y ejemplos en TypeScript / Angular para el Microfrontend de **Equipos VAC**.

---

## 🌐 1. Arquitectura de URLs y Convención

- **URL Base:** `https://appsurgicorperu.com/` (en local: `http://localhost:8000/`)
- **Autenticación:** Cabecera HTTP obligatoria:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Asignación Automática de Usuario:** En todos los `POST`/`PUT`/`PATCH`, el backend toma automáticamente al usuario autenticado desde el token JWT. **No es necesario que el frontend envíe el ID de usuario.**

---

## 📋 2. Endpoints Principales

### A. Listado Masivo de Equipos VAC (Incluye `seguimiento` y `guia_info`)
- **Método:** `GET`
- **Endpoint:** `https://appsurgicorperu.com/EquiposVAC/`
- **Parámetros de consulta (Query Params):**
  | Parámetro | Tipo | Descripción | Ejemplo |
  | :--- | :--- | :--- | :--- |
  | `top` | integer | Registros por página (default: 50, max: 1000) | `?top=50` |
  | `page` | integer | Número de página | `?page=1` |
  | `search` | string | Búsqueda global (serie, producto, cliente, paciente, ruc, descripción) | `?search=REBAGLIATI` |
  | `empresa` | string | Filtro por código de empresa (`01`, `04`, etc.) | `?empresa=01` |
  | `deposito` | string | Filtro por depósito | `?deposito=SG-CSA` |
  | `serie` | string | Filtro exacto por serie | `?serie=X11065` |
  | `ordering` | string | Ordenamiento (`-fecha_mov`, `fecha_mov`, `serie`) | `?ordering=-fecha_mov` |

- **Respuesta JSON Masiva (Ejemplo):**
  ```json
  {
    "count": 120,
    "next": "https://appsurgicorperu.com/EquiposVAC/?page=2&top=50",
    "previous": null,
    "results": [
      {
        "serie": "X11065",
        "tipo_producto": "EQ",
        "prod": "A4-S0002",
        "descripcion": "BOMBA DE PRESION NEGATIVA VAC XLR8",
        "empresa": "01",
        "codigo": "SGRG3",
        "numero": 47542,
        "deposito": "SG-CSA",
        "sector": "PRI-R68.D",
        "activo": "1064",
        "fecha_mov": "2026-05-29",
        "cantidad": 1,
        "ruc": "20100123456",
        "cliente": "CLINICA JAVIER PRADO S A",
        "paciente": "WENDY QUIÑONES CORONADO",
        "representante": "FERNANDEZ ARDILES ANA CECILIA",
        "fecha_alta": "2026-05-29T07:45:00Z",
        "seguimiento": {
          "id": 1,
          "serie": "X11065",
          "volvio_almacen": false,
          "fecha_retorno": null,
          "usuario_registro_id": 5,
          "usuario_registro_nombre": "Carlos Mendoza",
          "total_comentarios": 1,
          "comentarios": [
            {
              "id": 1,
              "usuario_id": 5,
              "usuario_nombre": "Carlos Mendoza",
              "comentario": "Primer intento: El equipo continúa en uso en hospitalización.",
              "fecha_registro": "2026-06-05T10:00:00Z"
            }
          ]
        },
        "guia_info": {
          "nro_guia": "T003-47542",
          "empresa": "SURGICORP S.R.L.",
          "motivo": "OTROS - TRASLADOS BIENES EN USO (SOLO GRE)",
          "jurisdiccion": "LIMA - LIMA - SAN ISIDRO",
          "obs": "Cnt.T.: 1 // ID# 29069 // PED# 100168 //",
          "doctor": "GUTIERREZ ARANA JESSICA PAOLA",
          "fecha_cirugia": "2026-05-29T10:00:00-05:00",
          "entrega": "AV JAVIER PRADO ESTE 499 - LIMA - LIMA - SAN ISIDRO",
          "sede": "SAN ISIDRO",
          "tipo_pedido": "NORMAL",
          "estado": "ACT",
          "salida": true,
          "fecha_guia": "2026-05-29T07:45:47.303333-05:00"
        }
      }
    ]
  }
  ```

---

### B. Registrar Comentario / Intento de Recuperación (`EV_Comentario`)
> [!IMPORTANT]
> **No requiere que exista un seguimiento previo:** Puedes enviar directamente el campo `serie`. El backend creará automáticamente el registro de seguimiento base si aún no existía, y asociará el comentario al usuario que tiene iniciada la sesión.

- **Método:** `POST`
- **Endpoint:** `https://appsurgicorperu.com/EV_Comentario/`
- **Body JSON (Recomendado - Solo con `serie`):**
  ```json
  {
    "serie": "X11065",
    "comentario": "Se acudió a la clínica pero el personal de piso indica que el paciente fue dado de alta con el equipo. Se coordinará visita domiciliaria."
  }
  ```
- **Respuesta JSON (`201 Created`):**
  ```json
  {
    "id": 15,
    "seguimiento": 1,
    "comentario": "Se acudió a la clínica pero el personal de piso indica que el paciente fue dado de alta con el equipo. Se coordinará visita domiciliaria.",
    "usuario": 2,
    "usuario_nombre": "Jairo Castillo Alcas",
    "fecha_registro": "2026-09-22T20:25:00Z"
  }
  ```

---

### C. Actualizar Estado de Proceso de Recojo (`EV_Seguimiento`)
> [!IMPORTANT]
> El campo `volvio_almacen` maneja **4 etapas/estados de recojo** (`TextChoices`):
> 1. `PR`: **Por recoger** (Estado inicial / Pendiente)
> 2. `EP`: **En proceso de recojo** (En ruta o en coordinación)
> 3. `RC`: **Recogido** (Recogido de clínica / paciente)
> 4. `DV`: **Devuelto al almacén** (Ingreso físico al almacén)
>
> Si el equipo no tenía seguimiento previo, el backend lo crea automáticamente con el estado enviado.

- **Método:** `POST`
- **Endpoint:** `https://appsurgicorperu.com/EV_Seguimiento/`
- **Body JSON:**
  ```json
  {
    "serie": "X11065",
    "volvio_almacen": "EP"
  }
  ```
- **Respuesta JSON (`201 Created` / `200 OK`):**
  ```json
  {
    "id": 1,
    "serie": "X11065",
    "tipo_producto": "EQ",
    "prod": "A4-S0002",
    "empresa": "01",
    "volvio_almacen": {
      "EP": "En proceso de recojo"
    },
    "fecha_retorno": "2026-09-24T20:25:00Z",
    "usuario_registro": 2,
    "usuario_registro_nombre": "Jairo Castillo Alcas",
    "created_at": "2026-09-22T20:22:19Z",
    "updated_at": "2026-09-24T20:25:00Z",
    "total_comentarios": 1,
    "comentarios": [ ... ]
  }
  ```

---

## 💻 3. Ejemplos de Implementación en Angular / TypeScript

### `api.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GuiaInfo {
  nro_guia: string;
  empresa: string;
  motivo: string;
  jurisdiccion: string;
  obs: string;
  doctor: string;
  fecha_cirugia: string;
  entrega: string;
  sede: string;
  tipo_pedido: string;
  estado: string;
  salida: boolean;
  fecha_guia: string;
}

export interface ComentarioVAC {
  id?: number;
  comentario: string;
  usuario_nombre?: string;
  fecha_registro?: string;
}

export type EstadoRecojoTipo = 'PR' | 'EP' | 'RC' | 'DV';

export interface SeguimientoVAC {
  id?: number;
  serie: string;
  volvio_almacen: EstadoRecojoTipo | { [key: string]: string } | boolean;
  fecha_retorno?: string;
  usuario_registro_nombre?: string;
  total_comentarios?: number;
  comentarios?: ComentarioVAC[];
}

export interface EquipoVACItem {
  serie: string;
  tipo_producto: string;
  prod: string;
  descripcion: string;
  empresa: string;
  codigo: string;
  numero: number;
  deposito: string;
  sector: string;
  activo: string;
  fecha_mov: string;
  cantidad: number;
  ruc: string;
  cliente: string;
  paciente: string;
  representante: string;
  fecha_alta: string;
  seguimiento: SeguimientoVAC | null;
  guia_info: GuiaInfo | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class EquiposVacService {
  private readonly baseUrl = 'https://appsurgicorperu.com';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene el listado masivo de equipos con seguimiento y guía integrados
   */
  getEquiposVac(page: number = 1, top: number = 50, search?: string): Observable<PaginatedResponse<EquipoVACItem>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('top', top.toString())
      .set('ordering', '-fecha_mov');

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<PaginatedResponse<EquipoVACItem>>(`${this.baseUrl}/EquiposVAC/`, { params });
  }

  /**
   * Registra un comentario / intento de recuperación enviando solo serie y texto.
   * Auto-crea el seguimiento si no existía previamente.
   */
  agregarComentario(serie: string, comentario: string): Observable<ComentarioVAC> {
    return this.http.post<ComentarioVAC>(`${this.baseUrl}/EV_Comentario/`, {
      serie,
      comentario
    });
  }

  /**
   * Actualiza el estado de recojo ('PR', 'EP', 'RC', 'DV')
   */
  actualizarEstadoRetorno(serie: string, volvioAlmacen: EstadoRecojoTipo | string): Observable<SeguimientoVAC> {
    return this.http.post<SeguimientoVAC>(`${this.baseUrl}/EV_Seguimiento/`, {
      serie,
      volvio_almacen: volvioAlmacen
    });
  }
}
```

---

## 🎯 4. Resumen del Flujo UI en el Frontend

1. **Carga Inicial:** La pantalla hace una sola petición `GET /EquiposVAC/?top=50`. Cada fila de la tabla recibe de inmediato:
   - Los datos del equipo (`cliente`, `paciente`, `fecha_mov`, `serie`, etc.).
   - `item.seguimiento?.volvio_almacen` para encender o apagar el Checkbox de "Retornado".
   - `item.guia_info?.nro_guia`, `item.guia_info?.doctor`, `item.guia_info?.jurisdiccion` para mostrar la información del despacho sin hacer peticiones adicionales.
   - `item.seguimiento?.comentarios` para mostrar el contador de intentos de recojo.

2. **Acción "Check Retornado":**
   - Cuando el usuario marca el checkbox:
     ```typescript
     this.vacService.actualizarEstadoRetorno(equipo.serie, true).subscribe(seguimientoActualizado => {
       equipo.seguimiento = seguimientoActualizado;
     });
     ```

3. **Acción "Agregar Comentario / Intento de Recuperación":**
   - El usuario abre el modal de observaciones y escribe el motivo:
     ```typescript
     this.vacService.agregarComentario(equipo.serie, comentarioTexto).subscribe(nuevoComentario => {
       if (!equipo.seguimiento) {
         equipo.seguimiento = { serie: equipo.serie, volvio_almacen: false, comentarios: [] };
       }
       equipo.seguimiento.comentarios?.unshift(nuevoComentario);
     });
     ```
