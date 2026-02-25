"""
MESS Platform — Fleet Models
Vehicles, vehicle types, and documents.
"""
from django.db import models

from core.models import BaseModel


class VehicleType(BaseModel):
    """Catalog of vehicle types (Camion 10T, Remorque, etc.)."""
    name = models.CharField(max_length=100, unique=True)
    name_fr = models.CharField(max_length=100, blank=True, help_text="French name")
    name_wo = models.CharField(max_length=100, blank=True, help_text="Wolof name")
    description = models.TextField(blank=True)
    max_payload_kg = models.PositiveIntegerField(help_text="Maximum payload in kg")
    volume_m3 = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    icon = models.CharField(max_length=100, blank=True, help_text="Icon name for frontend")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Vehicle Type"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (max {self.max_payload_kg} kg)"


class Vehicle(BaseModel):
    """A vehicle registered on the platform."""

    class FuelType(models.TextChoices):
        DIESEL = "DIESEL", "Diesel"
        PETROL = "PETROL", "Petrol"
        CNG = "CNG", "CNG"

    owner = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT,
        related_name="vehicles", limit_choices_to={"role__in": ["DRIVER", "FLEET_MANAGER"]}
    )
    vehicle_type = models.ForeignKey(VehicleType, on_delete=models.PROTECT, related_name="vehicles")

    # Identity
    registration_number = models.CharField(max_length=50, unique=True, db_index=True)
    make = models.CharField(max_length=100, blank=True, help_text="e.g. Mercedes-Benz")
    model = models.CharField(max_length=100, blank=True, help_text="e.g. Actros")
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    fuel_type = models.CharField(max_length=10, choices=FuelType.choices, default=FuelType.DIESEL)
    color = models.CharField(max_length=50, blank=True)

    # Capacity (may differ from VehicleType defaults for this specific vehicle)
    payload_kg = models.PositiveIntegerField(null=True, blank=True)
    volume_m3 = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False, help_text="Verified by admin")

    # Photos
    photo = models.ImageField(upload_to="vehicles/photos/", null=True, blank=True)

    class Meta:
        verbose_name = "Vehicle"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.registration_number} — {self.vehicle_type.name}"

    @property
    def effective_payload_kg(self):
        return self.payload_kg or self.vehicle_type.max_payload_kg


class VehicleDocument(BaseModel):
    """Documents attached to a vehicle (insurance, carte grise, etc.)."""

    class DocumentType(models.TextChoices):
        REGISTRATION = "REGISTRATION", "Carte Grise"
        INSURANCE = "INSURANCE", "Assurance"
        INSPECTION = "INSPECTION", "Visite Technique"
        PERMIT = "PERMIT", "Permis de Transport"
        OTHER = "OTHER", "Autre"

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    file = models.FileField(upload_to="vehicles/documents/")
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Vehicle Document"
        ordering = ["document_type"]

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.vehicle.registration_number}"

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        from django.utils import timezone
        return timezone.now().date() > self.expiry_date
