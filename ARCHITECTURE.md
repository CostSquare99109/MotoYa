# Arquitectura de MotoYa

## Visión General

MotoYa es una plataforma de gestión de flota de mototaxis con tres portales de usuario conectados a un backend API centralizado.

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Portal Admin  │   │ Portal Conductor│   │  Portal Pasajero│
│   React + Vite  │   │   React + Vite  │   │   React + Vite  │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   FastAPI Backend   │
                    │   REST + WebSocket  │
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────▼┐  ┌──▼───────────┐
              │ PostgreSQL  │  │    Redis     │
              │  + PostGIS  │  │  (caché/RT)  │
              └─────────────┘  └──────────────┘
```

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Backend API | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0 (async) |
| Base de datos | PostgreSQL + PostGIS | 16+ |
| Caché | Redis | 7+ |
| Autenticación | JWT (python-jose + passlib) | - |
| Frontend | React + TypeScript + Vite | 19 |
| UI Framework | TailwindCSS + shadcn/ui | - |
| Tiempo real | WebSockets | - |

## Portales

### 1. Portal Admin (`/`)
Dashboard principal para administradores y despachadores.
- **Autenticación**: Email + contraseña → JWT
- **Funciones**: Gestión de conductores, flota, viajes, envíos, finanzas, rankings, emergencias, configuración, usuarios

### 2. Portal Conductor (`/worker`)
Interfaz para mototaxistas.
- **Autenticación**: Teléfono + contraseña → JWT (con `driver_id`)
- **Funciones**: Ver solicitudes de viaje, aceptar/rechazar, perfil, estadísticas, ubicación GPS en tiempo real

### 3. Portal Pasajero (`/client`)
Portal exprés para pasajeros.
- **Autenticación**: Nombre + teléfono (sin contraseña) → JWT
- **Funciones**: Solicitar viaje, tracking en vivo, historial, calificar viaje

## Modelo de Datos

### Usuarios y Roles

```
User (users)
├── id: UUID (PK)
├── email: String (unique)
├── password_hash: String (bcrypt)
├── full_name: String
├── phone: String
├── role: Enum[admin, dispatcher, worker, client]
├── is_active: Boolean
└── timestamps

Driver (drivers)
├── id: UUID (PK)
├── user_id: UUID (FK → users, nullable)
├── full_name, phone, email
├── document_id, license_number
├── status: Enum[active, pending, suspended, inactive]
├── is_online: Boolean
├── rating: Float
├── current_location: Geography(PostGIS)
└── timestamps
```

**Nota**: La relación `User → Driver` es opcional (`user_id` nullable). Un conductor puede existir en la tabla `drivers` sin cuenta de acceso, y un usuario con `role=worker` puede existir sin registro en `drivers`. El sistema sincroniza ambos registros en el login del conductor.

### Viajes y Envíos

```
Trip (trips)                    Shipment (shipments)
├── id: UUID                    ├── id: UUID
├── client_id: UUID (FK)       ├── sender/receiver info
├── driver_id: UUID (FK)       ├── driver_id: UUID (FK)
├── status: Enum                ├── status: Enum
├── pickup_location: Geography  ├── pickup_location: Geography
├── dropoff_location: Geography ├── delivery_location: Geography
├── fare, distance              ├── weight, description
└── timestamps                  └── timestamps
```

## Seguridad

- **Contraseñas**: bcrypt via passlib
- **JWT**: RS256/HS256 con expiración configurable
- **Validación de entrada**: Pydantic con validadores estrictos (regex para teléfonos, EmailStr para emails)
- **CORS**: Orígenes configurables, sin wildcard en producción
- **Protección de producción**: `APP_ENV=production` exige JWT_SECRET cambiado y DATABASE_URL sin localhost

## WebSockets

| Endpoint | Propósito |
|----------|-----------|
| `/ws/location/{driver_id}` | Tracking GPS en tiempo real |
| `/ws/emergency` | Stream de alertas de emergencia |

## Decisiones de Diseño

1. **SQLAlchemy async** — FastAPI es asíncrono, el ORM debe serlo también
2. **PostGIS** — Las ubicaciones GPS se almacenan como Geography points para queries espaciales eficientes (conductores cercanos, distancia de viaje)
3. **Login exprés para pasajeros** — Sin contraseña para reducir fricción; el teléfono es el identificador
4. **Sincronización User-Driver en login** — Los conductores pueden crearse desde el admin panel antes de tener cuenta de acceso
5. **Gestión de flota pura** — El sistema se enfoca 100% en operación de mototaxis; sin dependencias externas innecesarias
