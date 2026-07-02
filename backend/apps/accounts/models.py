"""
MESS Platform — Accounts Models
Phone-number-based user authentication with role differentiation.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import random
import string
import uuid
from django.db import models
from phonenumber_field.modelfields import PhoneNumberField

from core.models import BaseModel
from .constants import DrugTestingStatus, Language, OperatingAuthority, PaymentMethod, UserRole


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
        return f"{self.full_name} ({self.phone_number})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_shipper(self):
        return self.role == UserRole.SHIPPER

    @property
    def is_driver(self):
        return self.role == UserRole.DRIVER

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

    # Senegal legal identifiers
    ninea = models.CharField(max_length=50, blank=True, help_text="Numéro d'Identification National des Entreprises et Associations")
    rccm = models.CharField(max_length=100, blank=True, help_text="Registre du Commerce et du Crédit Mobilier")
    legal_form = models.CharField(max_length=50, blank=True, help_text="SA, SARL, GIE, SNC, Individuelle…")
    region = models.CharField(max_length=100, blank=True, help_text="Région administrative au Sénégal")
    professional_phone = models.CharField(max_length=30, blank=True)
    professional_email = models.EmailField(blank=True)

    def __str__(self):
        return f"Shipper: {self.user.full_name}"


class DriverProfile(BaseModel):
    """Extended profile for drivers."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    employer = models.ForeignKey(
        "CarrierProfile", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="drivers"
    )

    # Identity & license
    license_number = models.CharField(max_length=100)
    license_class = models.CharField(max_length=10, blank=True, help_text="A, B, C, etc.")
    license_expiry = models.DateField(null=True, blank=True)
    license_photo = models.ImageField(upload_to="licenses/", null=True, blank=True)
    license_state = models.CharField(max_length=100, blank=True, help_text="Issuing country/region")
    cdl_endorsements = models.CharField(max_length=255, blank=True, help_text="e.g. hazmat, tanker, doubles")
    national_id = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(upload_to="avatars/drivers/", null=True, blank=True)

    # Medical & compliance
    medical_card_expiry = models.DateField(null=True, blank=True)
    medical_card_photo = models.ImageField(upload_to="drivers/medical/", null=True, blank=True)
    drug_testing_status = models.CharField(
        max_length=20, choices=DrugTestingStatus.choices,
        default=DrugTestingStatus.PENDING, blank=True
    )

    # Experience & equipment
    home_address = models.TextField(blank=True)
    driving_experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    equipment_types = models.CharField(max_length=500, blank=True, help_text="Types of equipment handled")
    preferred_lanes = models.TextField(blank=True, help_text="Preferred routes or service area")

    # Payment & dispatch
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, blank=True
    )
    bank_account_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=100, blank=True)
    bank_routing_number = models.CharField(max_length=100, blank=True)
    dispatch_contact_name = models.CharField(max_length=255, blank=True)
    dispatch_contact_phone = models.CharField(max_length=30, blank=True)

    # Personal insurance (responsabilité civile)
    insurance_provider = models.CharField(max_length=255, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_start_date = models.DateField(null=True, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)

    # Terms
    terms_accepted = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

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
        return f"Driver: {self.user.full_name}"

    def update_rating(self, new_score: int):
        total = self.rating * self.total_ratings + new_score
        self.total_ratings += 1
        self.rating = total / self.total_ratings
        self.save(update_fields=["rating", "total_ratings"])


class CarrierProfile(BaseModel):
    """Extended profile for carriers (transport companies)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="carrier_profile")

    # Company identity
    legal_company_name = models.CharField(max_length=255, blank=True)
    dot_number = models.CharField(max_length=50, blank=True, help_text="DOT number")
    mc_number = models.CharField(max_length=50, blank=True, help_text="MC / authority number")
    operating_authority = models.CharField(
        max_length=20, choices=OperatingAuthority.choices, blank=True
    )
    tax_id = models.CharField(max_length=100, blank=True, help_text="Tax ID / NINEA")
    w9_document = models.FileField(upload_to="carriers/w9/", null=True, blank=True)
    avatar = models.ImageField(upload_to="avatars/carriers/", null=True, blank=True)

    # Company address & contacts
    company_address = models.TextField(blank=True)
    company_city = models.CharField(max_length=100, blank=True, default="Dakar")
    company_country = models.CharField(max_length=100, blank=True, default="Senegal")
    primary_contact_name = models.CharField(max_length=255, blank=True)
    primary_contact_phone = models.CharField(max_length=30, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    dispatch_contact_name = models.CharField(max_length=255, blank=True)
    dispatch_contact_phone = models.CharField(max_length=30, blank=True)

    # Insurance
    auto_liability_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cargo_insurance_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    insurance_provider = models.CharField(max_length=255, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    certificate_of_insurance = models.FileField(upload_to="carriers/insurance/", null=True, blank=True)

    # Payment
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, blank=True
    )
    bank_account_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=100, blank=True)
    bank_routing_number = models.CharField(max_length=100, blank=True)

    # Company code — unique short code used by company drivers to log in
    company_code = models.CharField(max_length=20, unique=True, blank=True, db_index=True)

    # Availability
    is_available = models.BooleanField(default=False, db_index=True)

    # Operational
    preferred_lanes = models.TextField(blank=True)
    service_area = models.TextField(blank=True)
    availability_notes = models.TextField(blank=True)
    drug_testing_status = models.CharField(
        max_length=20, choices=DrugTestingStatus.choices,
        default=DrugTestingStatus.PENDING, blank=True
    )

    # Compliance
    carrier_agreement_accepted = models.BooleanField(default=False)
    carrier_agreement_accepted_at = models.DateTimeField(null=True, blank=True)

    # Stats
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_loads = models.PositiveIntegerField(default=0)
    total_ratings = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Carrier Profile"

    def __str__(self):
        return f"Carrier: {self.legal_company_name or self.user.full_name}"

    def save(self, *args, **kwargs):
        if not self.company_code:
            self.company_code = self._generate_unique_code()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_unique_code():
        while True:
            code = "YOO-" + "".join(random.choices(string.digits, k=4))
            if not CarrierProfile.objects.filter(company_code=code).exists():
                return code

    def update_rating(self, new_score: int):
        total = self.rating * self.total_ratings + new_score
        self.total_ratings += 1
        self.rating = total / self.total_ratings
        self.save(update_fields=["rating", "total_ratings"])




class BrokerProfile(BaseModel):
    """Extended profile for brokers (freight intermediaries)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="broker_profile")
    company_name = models.CharField(max_length=255, blank=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=3.50)
    service_area = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/brokers/", null=True, blank=True)

    # Stats
    total_matches = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_commission_earned = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    class Meta:
        verbose_name = "Broker Profile"

    def __str__(self):
        return f"Broker: {self.company_name or self.user.full_name}"


class AdminPermission(BaseModel):
    """Granular permissions for admin users (set by superadmin)."""
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="admin_permissions"
    )
    can_manage_users     = models.BooleanField(default=True)
    can_manage_fleet     = models.BooleanField(default=True)
    can_manage_orders    = models.BooleanField(default=True)
    can_manage_finance   = models.BooleanField(default=True)
    can_manage_analytics = models.BooleanField(default=True)
    can_manage_messaging = models.BooleanField(default=True)
    can_manage_tracking  = models.BooleanField(default=True)
    can_view_governance  = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Admin Permission"
        verbose_name_plural = "Admin Permissions"

    def __str__(self):
        return f"Permissions — {self.user.full_name}"


class ContactMessage(BaseModel):
    """Message sent via the contact form."""
    first_name = models.CharField(max_length=100)
    last_name  = models.CharField(max_length=100, blank=True)
    address    = models.CharField(max_length=255, blank=True)
    subject    = models.CharField(max_length=255)
    message    = models.TextField()
    user       = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="contact_messages"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} — {self.subject}"


class WorkspaceSwitchLog(models.Model):
    """Audit log for every workspace switch."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workspace_switches')
    from_workspace = models.CharField(max_length=20, null=True, blank=True)
    to_workspace = models.CharField(max_length=20)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} | {self.from_workspace} → {self.to_workspace}'
