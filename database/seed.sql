-- ═══════════════════════════════════════════════════════════════════════════════
-- MotoYa — Datos iniciales (seed)
-- Ejecutar DESPUÉS de arrancar el backend por primera vez
-- (las tablas ya deben estar creadas por SQLAlchemy)
--
-- Uso:  sudo -u postgres psql -d motoya -f database/seed.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Usuario Admin ─────────────────────────────────────────────────────────
-- Email: admin@motoya.co  |  Contraseña: admin123
INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'admin@motoya.co',
  '$2b$12$l.uifQmY.pcZM7rArOmDye3/TBVg1MactxqNclxfiZWT9uMpRflOS',
  'Administrador MotoYa',
  '+573000000001',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- ── 2. Usuario Dispatcher ────────────────────────────────────────────────────
-- Email: despacho@motoya.co  |  Contraseña: despacho123
INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'despacho@motoya.co',
  '$2b$12$d9l/LZ3F5H5nLn7tqwAyFuVEEkmQ7oiybFuHD8AsxMlvYbzNjoW72',
  'Despachador MotoYa',
  '+573000000002',
  'dispatcher',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- ── 3. Configuración global de la plataforma ─────────────────────────────────
INSERT INTO platform_settings (id, key, value, updated_at)
VALUES (
  uuid_generate_v4(),
  'global',
  '{
    "general": {
      "platformName": "MotoYa",
      "city": "Carepa",
      "department": "Antioquia",
      "timezone": "america_bogota",
      "currency": "cop",
      "darkMode": false
    },
    "notifications": {
      "newTrips": true,
      "emergencies": true,
      "maintenance": true,
      "dailyReports": false
    },
    "security": {
      "selfieValidation": true,
      "emergencyStream": true
    },
    "dispatch": {
      "searchRadius": 3,
      "maxResponseTime": 5,
      "autoAssign": true,
      "voiceCommands": true
    }
  }'::jsonb,
  NOW()
) ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREDENCIALES POR DEFECTO:
--
--   Portal Admin:
--     Email:    admin@motoya.co
--     Password: admin123
--
--   Portal Despacho:
--     Email:    despacho@motoya.co
--     Password: despacho123
--
-- ⚠️  CAMBIA ESTAS CONTRASEÑAS EN PRODUCCIÓN
-- ═══════════════════════════════════════════════════════════════════════════════
