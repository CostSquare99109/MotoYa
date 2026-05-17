"""Pydantic schemas for platform settings."""

from typing import Optional
from pydantic import BaseModel


class GeneralSettings(BaseModel):
    platformName: str = "MotoYa"
    city: str = "Carepa"
    department: str = "Antioquia"
    timezone: str = "america_bogota"
    currency: str = "cop"
    darkMode: bool = False


class NotificationSettings(BaseModel):
    newTrips: bool = True
    emergencies: bool = True
    maintenance: bool = True
    dailyReports: bool = False


class SecuritySettings(BaseModel):
    openrouterKey: Optional[str] = None  # None = no cambiar
    selfieValidation: bool = True
    emergencyStream: bool = True


class DispatchSettings(BaseModel):
    searchRadius: int = 3
    maxResponseTime: int = 5
    autoAssign: bool = True
    voiceCommands: bool = True


class PlatformSettingsIn(BaseModel):
    general: GeneralSettings = GeneralSettings()
    notifications: NotificationSettings = NotificationSettings()
    security: SecuritySettings = SecuritySettings()
    dispatch: DispatchSettings = DispatchSettings()


class PlatformSettingsOut(BaseModel):
    general: dict
    notifications: dict
    security: dict  # openrouterKey omitido en la respuesta
    dispatch: dict
