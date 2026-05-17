# MotoYa — Plataforma Omni-MotoTaxy

Sistema de gestión de flota de mototaxis con portal admin, portal conductor y portal pasajero.

## Arquitectura

- **Backend**: FastAPI + PostgreSQL + SQLAlchemy (async)
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Tiempo real**: WebSockets para tracking GPS y emergencias

## Requisitos

- Python 3.11+
- Node.js 20+
- PostgreSQL 16+ con extensión PostGIS
- Redis 7+

## Inicio rápido

### Backend

```bash
cd backend
cp .env.example .env  # Editar con tus valores
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Estructura

```
motoya/
├── backend/
│   ├── app/
│   │   ├── main.py          # Entry point FastAPI
│   │   ├── config.py        # Configuración (env vars)
│   │   ├── database.py      # Conexión PostgreSQL
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # API endpoints
│   │   └── schemas/         # Pydantic schemas
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/           # Páginas (Admin, Worker, Client)
│   │   ├── sections/        # Componentes de sección
│   │   ├── components/      # UI components (shadcn)
│   │   ├── hooks/           # Custom hooks
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Portales

1. **Admin** (`/`) — Dashboard, conductores, flota, envíos, finanzas, rankings, emergencias, configuración
2. **Conductor** (`/worker`) — Dashboard, perfil, estadísticas
3. **Pasajero** (`/client`) — Solicitar viaje, tracking, historial

## API Docs

Con el backend corriendo: `http://localhost:8000/docs`
