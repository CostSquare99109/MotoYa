-- ═══════════════════════════════════════════════════════════════════════════════
-- MotoYa — Script de inicialización de base de datos
-- Ejecutar como superusuario de PostgreSQL:
--   sudo -u postgres psql -f database/setup.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Crear usuario de la aplicación ────────────────────────────────────────
-- Cambia el password antes de ejecutar en producción
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'motoya_user') THEN
    CREATE ROLE motoya_user WITH LOGIN PASSWORD '<TU_PASSWORD_DB>';
  END IF;
END
$$;

-- ── 2. Crear base de datos ───────────────────────────────────────────────────
SELECT 'CREATE DATABASE motoya OWNER motoya_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'motoya')\gexec

-- ── 3. Habilitar PostGIS ─────────────────────────────────────────────────────
\c motoya

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 4. Otorgar permisos ──────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON DATABASE motoya TO motoya_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO motoya_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO motoya_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO motoya_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO motoya_user;

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTA: Las tablas se crean automáticamente por SQLAlchemy al arrancar el
-- backend (Base.metadata.create_all en main.py lifespan).
-- Solo necesitas ejecutar este script UNA VEZ antes de levantar el backend.
-- ═══════════════════════════════════════════════════════════════════════════════
