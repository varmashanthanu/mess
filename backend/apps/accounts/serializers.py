"""
MESS Platform — Accounts Serializers
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .constants import UserRole
from .models import BrokerProfile, CarrierProfile, DriverProfile, PhoneVerification, ShipperProfile

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Add user role and name to JWT token payload."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["name"] = user.full_name
        token["phone"] = str(user.phone_number)
        token["workspace_type"] = user.role
        token["workspace_name"] = ""
        return token


# ── Registration ──────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = [
            "phone_number", "email", "first_name", "last_name",
            "role", "preferred_language", "password", "password_confirm",
        ]
        extra_kwargs = {
            "role": {"required": True},
            "last_name": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def validate_role(self, value):
        # Prevent self-registration as ADMIN
        if value == UserRole.ADMIN:
            raise serializers.ValidationError("Cannot register as admin.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        # Auto-create role profile
        _create_role_profile(user)
        return user


def _create_role_profile(user):
    if user.role == UserRole.SHIPPER:
        ShipperProfile.objects.get_or_create(user=user)
    elif user.role == UserRole.DRIVER:
        DriverProfile.objects.get_or_create(user=user, defaults={"license_number": "PENDING"})
    elif user.role == UserRole.CARRIER:
        CarrierProfile.objects.get_or_create(user=user)
    elif user.role == UserRole.BROKER:
        BrokerProfile.objects.get_or_create(user=user)


# ── OTP Verification ──────────────────────────────────────────────

class RequestOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp = serializers.CharField(max_length=8)

    def validate(self, attrs):
        from core.utils import normalize_phone
        phone = normalize_phone(attrs["phone_number"])
        if not phone:
            raise serializers.ValidationError({"phone_number": "Invalid phone number."})
        try:
            verification = PhoneVerification.objects.filter(
                phone_number=phone,
                is_used=False,
                expires_at__gt=timezone.now(),
            ).latest("created_at")
        except PhoneVerification.DoesNotExist:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})
        if verification.otp != attrs["otp"]:
            raise serializers.ValidationError({"otp": "Incorrect OTP."})
        attrs["verification"] = verification
        return attrs


# ── User Profile ──────────────────────────────────────────────────

class UserBasicSerializer(serializers.ModelSerializer):
    """Compact user representation for nested serializers."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "phone_number", "role", "is_verified", "preferred_language"]


class UserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    shipper_profile = serializers.SerializerMethodField()
    driver_profile = serializers.SerializerMethodField()
    carrier_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "email", "first_name", "last_name",
            "full_name", "role", "preferred_language", "is_verified",
            "is_identity_verified", "is_superuser", "date_joined",
            "shipper_profile", "driver_profile", "carrier_profile",
        ]
        read_only_fields = ["id", "phone_number", "is_verified", "is_identity_verified", "is_superuser", "date_joined"]

    def get_shipper_profile(self, obj):
        if hasattr(obj, "shipper_profile"):
            return ShipperProfileSerializer(obj.shipper_profile).data
        return None

    def get_driver_profile(self, obj):
        if hasattr(obj, "driver_profile"):
            return DriverProfileSerializer(obj.driver_profile).data
        return None

    def get_carrier_profile(self, obj):
        if hasattr(obj, "carrier_profile"):
            return CarrierProfileSerializer(obj.carrier_profile).data
        return None


class UpdateFCMTokenSerializer(serializers.Serializer):
    fcm_token = serializers.CharField()


# ── Role Profiles ─────────────────────────────────────────────────

class ShipperProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipperProfile
        fields = [
            "company_name", "company_registration", "address",
            "city", "country", "avatar", "rating", "total_orders",
            # Senegal legal
            "ninea", "rccm", "legal_form", "region",
            "professional_phone", "professional_email",
        ]
        read_only_fields = ["rating", "total_orders"]


class DriverProfileSerializer(serializers.ModelSerializer):
    employer_id = serializers.PrimaryKeyRelatedField(
        source="employer", queryset=CarrierProfile.objects.all(),
        allow_null=True, required=False
    )

    class Meta:
        model = DriverProfile
        fields = [
            "employer_id",
            # License & identity
            "license_number", "license_class", "license_expiry", "license_photo",
            "license_state", "cdl_endorsements", "national_id", "avatar",
            # Medical & compliance
            "medical_card_expiry", "medical_card_photo", "drug_testing_status",
            # Experience
            "home_address", "driving_experience_years", "equipment_types", "preferred_lanes",
            # Payment & dispatch
            "payment_method", "bank_account_name", "bank_account_number", "bank_routing_number",
            "dispatch_contact_name", "dispatch_contact_phone",
            # Terms
            "terms_accepted", "terms_accepted_at",
            # Location
            "is_available", "current_lat", "current_lng", "last_location_update",
            # Insurance
            "insurance_provider", "insurance_policy_number",
            "insurance_start_date", "insurance_expiry",
            # Stats
            "rating", "total_deliveries",
        ]
        read_only_fields = ["rating", "total_deliveries", "last_location_update", "terms_accepted_at"]


class CarrierProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarrierProfile
        fields = [
            # Company
            "legal_company_name", "dot_number", "mc_number", "operating_authority",
            "tax_id", "w9_document", "avatar",
            # Address & contacts
            "company_address", "company_city", "company_country",
            "primary_contact_name", "primary_contact_phone", "primary_contact_email",
            "dispatch_contact_name", "dispatch_contact_phone",
            # Insurance
            "auto_liability_amount", "cargo_insurance_amount", "insurance_provider",
            "insurance_policy_number", "insurance_expiry", "certificate_of_insurance",
            # Payment
            "payment_method", "bank_account_name", "bank_account_number", "bank_routing_number",
            # Operational
            "preferred_lanes", "service_area", "availability_notes", "drug_testing_status",
            # Availability
            "is_available",
            # Compliance
            "carrier_agreement_accepted", "carrier_agreement_accepted_at",
            # Stats
            "rating", "total_loads",
        ]
        read_only_fields = ["rating", "total_loads", "carrier_agreement_accepted_at"]


class DriverAvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField()
    current_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    current_lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)


