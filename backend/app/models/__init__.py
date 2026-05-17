"""SQLAlchemy ORM models — MotoYa platform."""

from app.models.users import User
# Client model is DEPRECATED — clients now use User with role='client'.
# Kept for Alembic migration reference only; will be removed after migration.
from app.models.clients import Client  # noqa: F401
from app.models.drivers import Driver, DriverSelfie
from app.models.driver_location import DriverLocation
from app.models.motorcycles import Motorcycle
from app.models.trips import Trip, TripStatusHistory
from app.models.shipments import Shipment
from app.models.finances import Earning
from app.models.rankings import Ranking
from app.models.emergency import EmergencyLog
from app.models.settings import PlatformSettings

__all__ = [
    "User",
    "Client",
    "Driver",
    "DriverSelfie",
    "DriverLocation",
    "Motorcycle",
    "Trip",
    "TripStatusHistory",
    "Shipment",
    "Earning",
    "Ranking",
    "EmergencyLog",
    "PlatformSettings",
]
