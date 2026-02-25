"""
MESS Platform — Accounts Constants
"""
from django.db import models


class UserRole(models.TextChoices):
    SHIPPER = "SHIPPER", "Shipper"
    DRIVER = "DRIVER", "Driver"
    BROKER = "BROKER", "Broker"
    FLEET_MANAGER = "FLEET_MANAGER", "Fleet Manager"
    ADMIN = "ADMIN", "Admin"


class Language(models.TextChoices):
    FRENCH = "fr", "Français"
    WOLOF = "wo", "Wolof"
    PULAAR = "ff", "Pulaar"
    ENGLISH = "en", "English"
