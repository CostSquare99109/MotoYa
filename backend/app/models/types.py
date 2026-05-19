"""Cross-database compatible column types.

Uses SQLAlchemy's generic types that adapt to the dialect:
- PostgreSQL: UUID, ARRAY, JSONB, Geography (native)
- SQLite:     CHAR(36), JSON, JSON, String (compatible fallbacks)

This allows the same models to work with both PostgreSQL (production)
and SQLite (testing) without any code changes.
"""

import uuid

from sqlalchemy import String, Text, types
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL's UUID type when available, otherwise stores
    as CHAR(36) (standard UUID string format).
    """

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
    """Platform-independent ARRAY type.

    Uses PostgreSQL's ARRAY when available, otherwise stores as JSON.
    Suitable for simple lists of strings/numbers.
    """

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY

            return dialect.type_descriptor(PG_ARRAY(Text))
        return dialect.type_descriptor(types.JSON)


class JSONBCompat(TypeDecorator):
    """Platform-independent JSONB type.

    Uses PostgreSQL's JSONB when available, otherwise stores as JSON.
    """

    impl = types.JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

            return dialect.type_descriptor(PG_JSONB)
        return dialect.type_descriptor(types.JSON)


class GeographyCompat(TypeDecorator):
    """Platform-independent Geography/POINT type.

    Uses GeoAlchemy2's Geography(POINT,4326) on PostgreSQL, otherwise
    stores coordinates as a JSON string {"lat": float, "lng": float}
    on SQLite and other databases.
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
            return value  # WKTElement or native geography — pass through
        # For SQLite: store as JSON dict
        if hasattr(value, "desc"):
            # WKTElement — parse "POINT(lng lat)"
            import re
            match = re.match(r"POINT\(([\d.-]+) ([\d.-]+)\)", value.desc)
            if match:
                return {"lng": float(match.group(1)), "lat": float(match.group(2))}
        if isinstance(value, dict):
            return value
        return value

    def process_result_value(self, value, dialect):
        return value  # Return as-is; schemas handle conversion
