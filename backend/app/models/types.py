"""Cross-database compatible column types.

Uses SQLAlchemy's generic types that adapt to the dialect:
- PostgreSQL: UUID, ARRAY, JSONB, Geography (native)
- SQLite: CHAR(36), JSON, JSON, String (compatible fallbacks)

This allows the same models to work with both PostgreSQL (production)
and SQLite (testing) without any code changes.
"""

import re
import uuid

from sqlalchemy import String, Text, types
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID type."""

    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(str(value))
            return value


class ArrayJSON(TypeDecorator):
    """Platform-independent ARRAY type."""

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
            return dialect.type_descriptor(PG_ARRAY(Text))
        return dialect.type_descriptor(types.JSON)


class JSONBCompat(TypeDecorator):
    """Platform-independent JSONB type."""

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
            return dialect.type_descriptor(PG_JSONB)
        return dialect.type_descriptor(types.JSON)


class GeographyCompat(TypeDecorator):
    """Platform-independent Geography/POINT type.

    On PostgreSQL: uses GeoAlchemy2's Geography(POINT,4326).
    The key insight is that TypeDecorator.process_bind_param replaces
    the inner type's bind processor entirely. Since WKTElement objects
    cannot be serialized to plain strings by asyncpg, we must convert
    them to the SRID-prefixed WKT format that PostgreSQL's
    ST_GeogFromText() expects when used with the Geography type.

    On SQLite: stores as JSON {"lat": float, "lng": float}.
    """

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from geoalchemy2 import Geography
            return dialect.type_descriptor(Geography("POINT", srid=4326))
        return dialect.type_descriptor(types.JSON)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            # Convert WKTElement to SRID-prefixed WKT string
            # that the Geography type's bind processor can handle.
            # GeoAlchemy2 Geography expects: "SRID=4326;POINT(lng lat)"
            if hasattr(value, "desc") and hasattr(value, "srid"):
                srid = value.srid or 4326
                return f"SRID={srid};{value.desc}"
            # If it's already a string in WKT format
            if isinstance(value, str):
                if not value.startswith("SRID="):
                    return f"SRID=4326;{value}"
                return value
            # Dict with lat/lng
            if isinstance(value, dict) and "lat" in value and "lng" in value:
                return f"SRID=4326;POINT({value['lng']} {value['lat']})"
            return value
        # For SQLite: convert to JSON dict
        if hasattr(value, "desc"):
            match = re.match(r"POINT\(([-\d.]+) ([-\d.]+)\)", value.desc)
            if match:
                return {"lng": float(match.group(1)), "lat": float(match.group(2))}
        if isinstance(value, dict):
            return value
        return value

    def process_result_value(self, value, dialect):
        return value  # Return as-is; schemas handle conversion
