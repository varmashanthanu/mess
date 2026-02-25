from django.contrib import admin
from .models import Vehicle, VehicleDocument, VehicleType


@admin.register(VehicleType)
class VehicleTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "max_payload_kg", "volume_m3", "is_active"]
    list_filter = ["is_active"]


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["registration_number", "owner", "vehicle_type", "is_active", "is_verified"]
    list_filter = ["is_active", "is_verified", "vehicle_type"]
    search_fields = ["registration_number", "owner__phone_number"]
    actions = ["verify_vehicles"]

    def verify_vehicles(self, request, queryset):
        queryset.update(is_verified=True)
        self.message_user(request, f"{queryset.count()} vehicles verified.")
    verify_vehicles.short_description = "Mark selected vehicles as verified"


@admin.register(VehicleDocument)
class VehicleDocumentAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "document_type", "expiry_date", "is_expired"]
    list_filter = ["document_type"]
