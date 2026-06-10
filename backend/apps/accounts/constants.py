"""
MESS Platform — Accounts Constants
"""
from django.db import models


class UserRole(models.TextChoices):
    SHIPPER = "SHIPPER", "Shipper"
    DRIVER = "DRIVER", "Driver"
    CARRIER = "CARRIER", "Carrier"
    ADMIN = "ADMIN", "Admin"


class DrugTestingStatus(models.TextChoices):
    COMPLIANT = "COMPLIANT", "Compliant"
    NOT_COMPLIANT = "NOT_COMPLIANT", "Non-Compliant"
    PENDING = "PENDING", "Pending"


class OperatingAuthority(models.TextChoices):
    INTERSTATE = "INTERSTATE", "Interstate"
    INTRASTATE = "INTRASTATE", "Intrastate"
    BOTH = "BOTH", "Both"


class PaymentMethod(models.TextChoices):
    ACH = "ACH", "ACH / Bank Transfer"
    CHECK = "CHECK", "Check"
    WAVE = "WAVE", "Wave"
    ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"


class Language(models.TextChoices):
    FRENCH = "fr", "Français"
    WOLOF = "wo", "Wolof"
    PULAAR = "ff", "Pulaar"
    ENGLISH = "en", "English"
