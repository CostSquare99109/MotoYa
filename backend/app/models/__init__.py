"""SQLAlchemy ORM models — MotoYa platform."""

# Client model is DEPRECATED — clients now use User with role='client'.
# Kept for Alembic migration reference only; will be removed after migration.
from app.models.clients import Client
from app.models.driver_location import DriverLocation
from app.models.drivers import Driver, DriverSelfie
from app.models.emergency import EmergencyLog
from app.models.finances import Earning
from app.models.motorcycles import Motorcycle
from app.models.notifications import Notification
from app.models.rankings import Ranking
from app.models.settings import PlatformSettings
from app.models.shipments import Shipment
from app.models.trips import Trip, TripStatusHistory
from app.models.users import User

__all__ = [
 "Client",
 "Driver",
 "DriverLocation",
 "DriverSelfie",
 "Earning",
 "EmergencyLog",
 "Motorcycle",
 "Notification",
 "PlatformSettings",
 "Ranking",
 "Shipment",
 "Trip",
 "TripStatusHistory",
 "User",
]
