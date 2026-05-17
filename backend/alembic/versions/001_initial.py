"""Initial schema — all MotoYa tables

Revision ID: 001_initial
Revises: None
Create Date: 2026-05-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Users (unified: admin, dispatcher, worker, client) ──────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("role", sa.String(20), default="dispatcher"),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("is_verified", sa.Boolean, default=False),
        sa.Column("rating", sa.Numeric(2, 1), default=5.0),
        sa.Column("total_trips", sa.Integer, default=0),
        sa.Column("wallet_balance", sa.Numeric(10, 2), default=0.00),
        sa.Column("preferred_payment", sa.String(20), default="cash"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Drivers ─────────────────────────────────────────────────────────
    op.create_table(
        "drivers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("license_number", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("rating", sa.Numeric(2, 1), default=5.0),
        sa.Column("total_trips", sa.Integer, default=0),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Driver Selfies ──────────────────────────────────────────────────
    op.create_table(
        "driver_selfies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("image_url", sa.Text, nullable=False),
        sa.Column("verified", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Driver Locations ────────────────────────────────────────────────
    op.create_table(
        "driver_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("is_online", sa.Boolean, default=False),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Motorcycles ─────────────────────────────────────────────────────
    op.create_table(
        "motorcycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("plate", sa.String(20), unique=True, nullable=False),
        sa.Column("brand", sa.String(50), nullable=True),
        sa.Column("model", sa.String(50), nullable=True),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column("color", sa.String(30), nullable=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Trips ───────────────────────────────────────────────────────────
    op.create_table(
        "trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("passenger_name", sa.String(100), nullable=True),
        sa.Column("passenger_phone", sa.String(20), nullable=True),
        sa.Column("pickup_location", sa.Text, nullable=True),
        sa.Column("pickup_address", sa.String(500), nullable=True),
        sa.Column("dropoff_location", sa.Text, nullable=True),
        sa.Column("dropoff_address", sa.String(500), nullable=True),
        sa.Column("fare", sa.Numeric(10, 2), nullable=True),
        sa.Column("commission", sa.Numeric(10, 2), nullable=True),
        sa.Column("distance_km", sa.Numeric(6, 2), nullable=True),
        sa.Column("payment_method", sa.String(20), default="cash"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Trip Status History ─────────────────────────────────────────────
    op.create_table(
        "trip_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Shipments ───────────────────────────────────────────────────────
    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=True),
        sa.Column("sender_name", sa.String(100), nullable=False),
        sa.Column("sender_phone", sa.String(20), nullable=False),
        sa.Column("receiver_name", sa.String(100), nullable=False),
        sa.Column("receiver_phone", sa.String(20), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("pickup_address", sa.String(500), nullable=True),
        sa.Column("dropoff_address", sa.String(500), nullable=True),
        sa.Column("fare", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Earnings ────────────────────────────────────────────────────────
    op.create_table(
        "earnings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("type", sa.String(20), default="trip"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Rankings ────────────────────────────────────────────────────────
    op.create_table(
        "rankings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("total_trips", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Emergency Logs ──────────────────────────────────────────────────
    op.create_table(
        "emergency_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drivers.id"), nullable=False),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id"), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("resolved", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Platform Settings ───────────────────────────────────────────────
    op.create_table(
        "platform_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), unique=True, nullable=False),
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
    op.drop_table("emergency_logs")
    op.drop_table("rankings")
    op.drop_table("earnings")
    op.drop_table("shipments")
    op.drop_table("trip_status_history")
    op.drop_table("trips")
    op.drop_table("motorcycles")
    op.drop_table("driver_locations")
    op.drop_table("driver_selfies")
    op.drop_table("drivers")
    op.drop_table("users")
