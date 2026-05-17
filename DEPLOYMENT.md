# Guía de Despliegue — MotoYa

## Requisitos

- Python 3.12+
- PostgreSQL 15+ con extensión PostGIS
- Redis 7+
- Node.js 20+ (solo para construir el frontend)
- Nginx (proxy reverso)

## 1. Preparar el servidor

```bash
# Instalar PostGIS
sudo apt install postgresql-15-postgis-3

# Crear base de datos y usuario
sudo -u postgres psql
CREATE USER motoya_user WITH PASSWORD 'TU_PASSWORD_SEGURA';
CREATE DATABASE motoya OWNER motoya_user;
\c motoya
CREATE EXTENSION postgis;
\q
```

## 2. Clonar y configurar

```bash
git clone https://github.com/CostSquare99109/MotoYa.git
cd MotoYa/backend

cp .env.example .env
# Editar .env con valores reales de producción
nano .env
```

**Variables OBLIGATORIAS en producción:**
- `APP_ENV=production`
- `DATABASE_URL=postgresql+asyncpg://motoya_user:PASSWORD@HOST:5432/motoya`
- `JWT_SECRET=` (generar con `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `CORS_ORIGINS=https://tudominio.com`

## 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Ejecutar migraciones
alembic upgrade head

# Iniciar con Gunicorn + Uvicorn workers
pip install gunicorn
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

## 4. Frontend

```bash
cd frontend
npm ci
npm run build

# Los archivos estáticos quedan en dist/
# Servir con Nginx
```

## 5. Nginx (proxy reverso)

```nginx
server {
    listen 80;
    server_name tudominio.com;

    # Frontend estático
    location / {
        root /var/www/motoya/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket para ubicación en tiempo real
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Archivos subidos
    location /uploads/ {
        alias /var/www/motoya/backend/uploads/;
    }
}
```

## 6. HTTPS con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

## 7. Systemd service (opcional)

```ini
# /etc/systemd/system/motoya.service
[Unit]
Description=MotoYa API
After=network.target postgresql.service redis.service

[Service]
User=www-data
WorkingDirectory=/var/www/motoya/backend
Environment="PATH=/var/www/motoya/backend/venv/bin"
ExecStart=/var/www/motoya/backend/venv/bin/gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable motoya
sudo systemctl start motoya
```

## 8. Verificación

- API: `curl https://tudominio.com/api/docs` → Swagger UI
- Health: `curl https://tudominio.com/api/auth/me` → 401 (esperado, significa que responde)
- Frontend: Navegar a `https://tudominio.com`

## Notas

- **Rate limiting**: Los endpoints de auth limitan a 5-10 intentos/minuto por IP
- **Lockout**: 5 intentos fallidos → bloqueo de 15 minutos
- **Migraciones**: Siempre ejecutar `alembic upgrade head` después de cada pull
- **Backups**: Configurar pg_dump cron para la base de datos PostgreSQL
