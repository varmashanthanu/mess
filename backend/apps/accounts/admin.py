from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import BrokerProfile, DriverProfile, PhoneVerification, ShipperProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["phone_number", "get_full_name", "role", "is_verified", "is_active", "created_at"]
    list_filter = ["role", "is_verified", "is_active", "is_identity_verified"]
    search_fields = ["phone_number", "first_name", "last_name", "email"]
    ordering = ["-created_at"]
    readonly_fields = ["id", "created_at", "updated_at", "last_login"]

    fieldsets = (
        (None, {"fields": ("id", "phone_number", "password")}),
        ("Personal Info", {"fields": ("first_name", "last_name", "email", "preferred_language")}),
        ("Role & Status", {"fields": ("role", "is_verified", "is_identity_verified", "is_active", "is_staff", "is_superuser")}),
        ("Timestamps", {"fields": ("created_at", "updated_at", "last_login", "date_joined")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone_number", "first_name", "last_name", "role", "password1", "password2"),
        }),
    )


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "license_number", "is_available", "rating", "total_deliveries"]
    list_filter = ["is_available"]
    search_fields = ["user__phone_number", "user__first_name", "license_number"]


@admin.register(ShipperProfile)
class ShipperProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "company_name", "city", "rating", "total_orders"]
    search_fields = ["user__phone_number", "company_name"]


@admin.register(PhoneVerification)
class PhoneVerificationAdmin(admin.ModelAdmin):
    list_display = ["user", "phone_number", "is_used", "expires_at", "created_at"]
    list_filter = ["is_used"]
    readonly_fields = ["otp"]  # Security: mask OTP in prod logs
