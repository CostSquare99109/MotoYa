# Contribuir a MotoYa

Gracias por tu interés en contribuir. Sigue estas guías para mantener la calidad del proyecto.

## Flujo de trabajo

1. **Fork** el repositorio
2. Crea una **rama** desde `master`: `git checkout -b feature/nombre-descriptivo`
3. Haz tus cambios con **commits atómicos** siguiendo [Conventional Commits](https://www.conventionalcommits.org/)
4. **Ejecuta los tests** antes de hacer push: `pytest` (backend) y `npm test` (frontend)
5. Abre un **Pull Request** contra `master`

## Convención de Commits

```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formato (sin cambios de lógica)
refactor: refactorización
test: agregar o corregir tests
chore: mantenimiento (deps, config)
```

## Requisitos antes de PR

- [ ] Los tests pasan (`pytest` y `npm test`)
- [ ] Sin errores de linter (`ruff check .` y `eslint .`)
- [ ] No hay secretos o credenciales en el código
- [ ] Los schemas de Pydantic validan estrictamente los datos de entrada
- [ ] Si agregas un endpoint, incluye test de integración

## Entorno de desarrollo

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # pytest, ruff, etc.

# Frontend
cd frontend
npm install
```

## Estructura del proyecto

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para detalles de diseño.

## Reportar Bugs

Abre un [Issue](https://github.com/CostSquare99109/MotoYa/issues) con:
- Pasos para reproducir
- Comportamiento esperado vs actual
- Logs o capturas de pantalla
