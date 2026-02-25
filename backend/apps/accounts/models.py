"""
MESS Platform — Accounts Models
Phone-number-based user authentication with role differentiation.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from phonenumber_field.modelfields import PhoneNumberField

from core.models import BaseModel
from .constants import Language, UserRole


class UserManager(BaseUserManager):
    """Custom manager using phone_number as the identifier."""

    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("Phone number is required.")
        extra_fields.setdefault("is_active", True)
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        extra_fields.setdefault("role", UserRole.ADMIN)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Central user model. Phone number is the login identifier.
    One user → one role. Profiles extend this with role-specific data.
    """

    phone_number = PhoneNumberField(unique=True, region="SN", db_index=True)
    email = models.EmailField(blank=True, null=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.SHIPPER)
    preferred_language = models.CharField(
        max_length=5, choices=Language.choices, default=Language.FRENCH
    )

    # Verification
    is_verified = models.BooleanField(default=False, help_text="Phone number verified")
    is_identity_verified = models.BooleanField(
        default=False, help_text="ID document verified by admin"
    )

    # Standard Django fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    # FCM token for push notifications
    fcm_token = models.TextField(blank=True, null=True)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["first_name", "last_name", "role"]

    objects = UserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_full_name()} ({self.phone_number})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_shipper(self):
        return self.role == UserRole.SHIPPER

    @property
    def is_driver(self):
        return self.role == UserRole.DRIVER

    @property
    def is_broker(self):
        return self.role == UserRole.BROKER

    @property
    def is_fleet_manager(self):
        return self.role == UserRole.FLEET_MANAGER

    @property
    def is_admin_user(self):
        return self.role == UserRole.ADMIN


class PhoneVerification(BaseModel):
    """OTP codes for phone number verification."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verifications")
    otp = models.CharField(max_length=8)
    phone_number = PhoneNumberField(region="SN")
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = "Phone Verification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP for {self.phone_number}"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at


class ShipperProfile(BaseModel):
    """Extended profile for shippers."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="shipper_profile")
    company_name = models.CharField(max_length=255, blank=True)
    company_registration = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True, default="Dakar")
    country = models.CharField(max_length=100, default="Senegal")
    avatar = models.ImageField(upload_to="avatars/shippers/", null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_orders = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Shipper: {self.user.get_full_name()}"


class DriverProfile(BaseModel):
    """Extended profile for drivers."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=100)
    license_expiry = models.DateField(null=True, blank=True)
    license_photo = models.ImageField(upload_to="licenses/", null=True, blank=True)
    national_id = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(upload_to="avatars/drivers/", null=True, blank=True)

    # Location — updated by the mobile client
    is_available = models.BooleanField(default=False, db_index=True)
    current_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    current_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)

    # Ratings
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_deliveries = models.PositiveIntegerField(default=0)
    total_ratings = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Driver Profile"

    def __str__(self):
        return f"Driver: {self.user.get_full_name()}"

    def update_rating(self, new_score: int):
        """Recalculate running average rating."""
        total = self.rating * self.total_ratings + new_score
        self.total_ratings += 1
        self.rating = total / self.total_ratings
        self.save(update_fields=["rating", "total_ratings"])


class BrokerProfile(BaseModel):
    """Extended profile for freight brokers."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="broker_profile")
    company_name = models.CharField(max_length=255, blank=True)
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=5.00, help_text="Commission % per order"
    )
    avatar = models.ImageField(upload_to="avatars/brokers/", null=True, blank=True)
    city = models.CharField(max_length=100, blank=True, default="Dakar")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Broker: {self.user.get_full_name()}"
