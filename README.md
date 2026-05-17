# 🏍️ MotoYa — Plataforma Omni-MotoTaxy

Sistema de gestión de flota de mototaxis con portal admin, portal conductor y portal pasajero.

## Arquitectura

- **Backend**: FastAPI + PostgreSQL + SQLAlchemy 2.0 (async)
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Tiempo real**: WebSockets para tracking GPS y emergencias
- **Geolocalización**: PostGIS para columnas Geography (ubicaciones GPS)
- **Caché**: Redis 7+ para sesiones y datos en tiempo real

## Requisitos

- Python 3.11+
- Node.js 20+
- PostgreSQL 16+ con extensión PostGIS
- Redis 7+

## Instalación completa

### 1. Base de datos

```bash
# Crear rol, base de datos y habilitar PostGIS
sudo -u postgres psql -f database/setup.sql

# Iniciar el backend (SQLAlchemy crea las tablas automáticamente)
cd backend
cp .env.example .env    # Editar con tus valores
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Insertar datos iniciales (admin + dispatcher + configuración)
sudo -u postgres psql -d motoya -f database/seed.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # Editar con tus valores
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`

## Credenciales por defecto

| Portal | Email | Contraseña |
|--------|-------|------------|
| **Admin** | `admin@motoya.co` | `admin123` |
| **Despacho** | `despacho@motoya.co` | `despacho123` |

> ⚠️ **Cambia estas contraseñas en producción.**

## Estructura del proyecto

```
motoya/
├── backend/
│   ├── app/
│   │   ├── main.py            # Entry point FastAPI + lifespan
│   │   ├── config.py          # Configuración (env vars con Pydantic)
│   │   ├── database.py        # Conexión PostgreSQL async
│   │   ├── models/            # SQLAlchemy ORM models
│   │   │   ├── users.py       # Usuarios (admin, dispatcher, worker, client)
│   │   │   ├── drivers.py     # Conductores + ubicación GPS
│   │   │   ├── clients.py     # Pasajeros
│   │   │   ├── motorcycles.py # Motocicletas de la flota
│   │   │   ├── trips.py       # Viajes + historial de estados
│   │   │   ├── shipments.py   # Envíos/paquetes
│   │   │   ├── finances.py    # Ganancias y transacciones
│   │   │   ├── rankings.py    # Rankings de conductores
│   │   │   ├── emergency.py   # Botón de pánico
│   │   │   └── settings.py    # Configuración de plataforma
│   │   ├── routers/           # API endpoints
│   │   │   ├── auth.py        # JWT login (admin + worker + client)
│   │   │   ├── users.py       # CRUD usuarios
│   │   │   ├── drivers.py     # CRUD conductores
│   │   │   ├── dispatch.py    # Despacho de viajes
│   │   │   ├── trips.py       # Gestión de viajes
│   │   │   ├── shipments.py   # Gestión de envíos
│   │   │   ├── finances.py    # Finanzas y reportes
│   │   │   ├── rankings.py    # Rankings
│   │   │   ├── emergency.py   # Emergencias
│   │   │   ├── motorcycles.py # Flota de motos
│   │   │   ├── location.py    # Tracking GPS
│   │   │   ├── settings.py    # Configuración global
│   │   │   ├── worker.py      # Portal conductor
│   │   │   └── client.py      # Portal pasajero
│   │   └── schemas/           # Pydantic validation schemas
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Panel principal admin
│   │   │   ├── Drivers.tsx      # Gestión conductores
│   │   │   ├── Fleet.tsx        # Flota de motos
│   │   │   ├── Finances.tsx     # Finanzas
│   │   │   ├── Shipments.tsx    # Envíos
│   │   │   ├── Users.tsx        # Usuarios
│   │   │   ├── LiveMap.tsx      # Mapa en tiempo real
│   │   │   ├── Settings.tsx     # Configuración
│   │   │   ├── Login.tsx        # Login admin
│   │   │   ├── worker/          # Portal conductor
│   │   │   └── client/          # Portal pasajero
│   │   ├── sections/            # Paneles y componentes de sección
│   │   ├── components/ui/       # shadcn/ui components
│   │   ├── hooks/               # Custom hooks (useApi, useStore, useWebSocket)
│   │   └── types/               # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── database/
│   ├── setup.sql               # Crear DB, rol, PostGIS
│   └── seed.sql                # Datos iniciales (usuarios + config)
└── README.md
```

## Portales

1. **Admin** (`/`) — Dashboard, conductores, flota, envíos, finanzas, rankings, emergencias, configuración, usuarios
2. **Conductor** (`/worker`) — Dashboard, perfil, solicitudes de viaje, estadísticas
3. **Pasajero** (`/client`) — Login exprés, solicitar viaje, tracking en vivo, historial

## API Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login admin/dispatcher (email) |
| `POST` | `/api/auth/worker/login` | Login conductor (teléfono) |
| `POST` | `/api/auth/client/quick-login` | Login exprés pasajero (nombre + teléfono) |
| `GET` | `/api/auth/me` | Usuario autenticado actual |
| `GET` | `/api/drivers` | Listar conductores |
| `POST` | `/api/drivers` | Crear conductor |
| `GET` | `/api/trips` | Listar viajes |
| `POST` | `/api/dispatch/assign` | Asignar viaje a conductor |
| `POST` | `/api/emergency/trigger` | Activar botón de pánico |
| `GET` | `/api/settings` | Configuración de plataforma |
| `WS` | `/ws/location/{driver_id}` | Tracking GPS en tiempo real |
| `WS` | `/ws/emergency` | Stream de emergencias |

## API Docs

Con el backend corriendo: `http://localhost:8000/docs` (Swagger UI)

## Variables de entorno (.env)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión PostgreSQL async | `postgresql+asyncpg://motoya_user:motoya2024@localhost:5432/motoya` |
| `REDIS_URL` | Conexión Redis | `redis://localhost:6379/0` |
| `JWT_SECRET` | Clave secreta para tokens | `change-me-in-production` |
| `JWT_ALGORITHM` | Algoritmo JWT | `HS256` |
| `JWT_EXPIRATION_MINUTES` | Expiración del token | `1440` (24h) |
| `CORS_ORIGINS` | Orígenes permitidos | `http://localhost:3000,http://localhost:5173` |

## Licencia

Privado — todos los derechos reservados.
