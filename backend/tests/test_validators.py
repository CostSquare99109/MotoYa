"""Tests for Pydantic schema validators."""

import pytest
from pydantic import ValidationError

from app.schemas.validators import validate_phone, validate_name
from app.schemas.client import ClientRegisterSchema, ClientLoginSchema, ClientQuickLoginSchema


# ── validate_phone ────────────────────────────────────────────────────────────

class TestValidatePhone:
    def test_valid_international(self):
        assert validate_phone("+573001234567") == "+573001234567"

    def test_valid_national(self):
        assert validate_phone("3001234567") == "3001234567"

    def test_valid_short(self):
        assert validate_phone("1234567") == "1234567"

    def test_invalid_letters(self):
        with pytest.raises(ValueError, match="Teléfono inválido"):
            validate_phone("abc12345")

    def test_invalid_too_short(self):
        with pytest.raises(ValueError, match="Teléfono inválido"):
            validate_phone("12345")

    def test_invalid_too_long(self):
        with pytest.raises(ValueError, match="Teléfono inválido"):
            validate_phone("+1234567890123456")

    def test_strips_whitespace(self):
        assert validate_phone("  +573001234567  ") == "+573001234567"


# ── validate_name ─────────────────────────────────────────────────────────────

class TestValidateName:
    def test_valid_name(self):
        assert validate_name("Jhon Montalvo") == "Jhon Montalvo"

    def test_valid_accents(self):
        assert validate_name("María José") == "María José"

    def test_valid_hyphen(self):
        assert validate_name("Ana-María") == "Ana-María"

    def test_invalid_numbers(self):
        with pytest.raises(ValueError, match="Nombre inválido"):
            validate_name("Jhon123")

    def test_invalid_special_chars(self):
        with pytest.raises(ValueError, match="Nombre inválido"):
            validate_name("Jhon<script>")

    def test_strips_whitespace(self):
        assert validate_name("  Jhon  ") == "Jhon"


# ── ClientRegisterSchema ─────────────────────────────────────────────────────

class TestClientRegisterSchema:
    def test_valid_registration(self):
        data = {
            "full_name": "María García",
            "phone": "+573001234567",
            "email": "maria@test.com",
            "password": "secret123",
        }
        schema = ClientRegisterSchema(**data)
        assert schema.full_name == "María García"
        assert schema.phone == "+573001234567"

    def test_invalid_phone_rejected(self):
        data = {
            "full_name": "Test User",
            "phone": "not-a-phone",
            "password": "secret123",
        }
        with pytest.raises(ValidationError):
            ClientRegisterSchema(**data)

    def test_invalid_name_rejected(self):
        data = {
            "full_name": "User123<script>",
            "phone": "+573001234567",
            "password": "secret123",
        }
        with pytest.raises(ValidationError):
            ClientRegisterSchema(**data)

    def test_short_password_rejected(self):
        data = {
            "full_name": "Test User",
            "phone": "+573001234567",
            "password": "12345",
        }
        with pytest.raises(ValidationError):
            ClientRegisterSchema(**data)


# ── ClientLoginSchema ─────────────────────────────────────────────────────────

class TestClientLoginSchema:
    def test_valid_login(self):
        schema = ClientLoginSchema(phone="+573001234567", password="secret")
        assert schema.phone == "+573001234567"

    def test_invalid_phone_rejected(self):
        with pytest.raises(ValidationError):
            ClientLoginSchema(phone="abc", password="secret")


# ── Config validation ─────────────────────────────────────────────────────────

class TestConfigSecurity:
    def test_development_allows_default_jwt(self):
        """In development mode, default JWT_SECRET should be allowed."""
        import os
        os.environ["APP_ENV"] = "development"
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost/test"
        os.environ["JWT_SECRET"] = "change-me-in-production"
        # Should not raise
        from app.config import Settings
        s = Settings(
            APP_ENV="development",
            DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
            JWT_SECRET="change-me-in-production",
        )
        assert s.JWT_SECRET == "change-me-in-production"

    def test_production_rejects_default_jwt(self):
        """In production mode, default JWT_SECRET should be rejected."""
        from app.config import Settings
        with pytest.raises(ValueError, match="JWT_SECRET must be changed"):
            Settings(
                APP_ENV="production",
                DATABASE_URL="postgresql+asyncpg://prod:pass@db.host/motoya",
                JWT_SECRET="change-me-in-production",
            )

    def test_staging_rejects_default_jwt(self):
        """In staging mode, default JWT_SECRET should also be rejected."""
        from app.config import Settings
        with pytest.raises(ValueError, match="JWT_SECRET must be changed"):
            Settings(
                APP_ENV="staging",
                DATABASE_URL="postgresql+asyncpg://staging:pass@db.host/motoya",
                JWT_SECRET="change-me-in-production",
            )

    def test_production_rejects_localhost_db(self):
        """In production, DATABASE_URL should not point to localhost."""
        from app.config import Settings
        with pytest.raises(ValueError, match="localhost"):
            Settings(
                APP_ENV="production",
                DATABASE_URL="postgresql+asyncpg://user:pass@localhost/motoya",
                JWT_SECRET="a-real-secret-key-here",
            )
