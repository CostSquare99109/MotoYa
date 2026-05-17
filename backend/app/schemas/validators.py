"""Shared validators for Pydantic schemas."""

import re
from pydantic import field_validator

# Regex para teléfonos internacionales: +573001234567 o 3001234567
PHONE_REGEX = re.compile(r'^\+?\d{7,15}$')

# Regex para nombres (letras, espacios, acentos, guiones)
NAME_REGEX = re.compile(r'^[\p{L}\s\-\']+$', re.UNICODE)


def validate_phone(v: str) -> str:
    """Validate phone number format."""
    phone = v.strip()
    if not PHONE_REGEX.match(phone):
        raise ValueError(
            'Teléfono inválido. Use formato internacional: +573001234567'
        )
    return phone


def validate_name(v: str) -> str:
    """Validate that a name contains only letters, spaces, hyphens."""
    name = v.strip()
    if not NAME_REGEX.match(name):
        raise ValueError(
            'Nombre inválido. Solo se permiten letras, espacios y guiones.'
        )
    return name


def sanitize_string(v: str) -> str:
    """Strip whitespace and normalize for general text fields."""
    return v.strip()
