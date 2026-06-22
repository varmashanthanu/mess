"""
MESS Platform — Accounts Views
"""
import logging
# from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin, IsOwnerOrAdmin
from .models import PhoneVerification, ContactMessage
from .serializers import (
    CarrierProfileSerializer,
    CustomTokenObtainPairSerializer,
    DriverAvailabilitySerializer,
    DriverProfileSerializer,
    RegisterSerializer,
    # RequestOTPSerializer,
    ShipperProfileSerializer,
    UpdateFCMTokenSerializer,
    UserDetailSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()

# SMS verification disabled — no SMS provider configured
# OTP_EXPIRY_MINUTES = 10


# ── Auth views ────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """Register a new user. Triggers OTP to phone."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # SMS verification disabled — no SMS provider configured
        # Uncomment the line below when SMS service is available
        # _send_otp(user)
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        tokens = _get_tokens(user)
        return Response(
            {
                "message": "Registration successful.",
                # "message": "Registration successful. OTP sent to your phone number.",
                "user": UserDetailSerializer(user).data,
                **tokens,
            },
            status=status.HTTP_201_CREATED,
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """Login with phone number + password. Returns JWT pair + user info."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # Attach user info to login response
            try:
                from rest_framework_simplejwt.tokens import UntypedToken
                from rest_framework_simplejwt.backends import TokenBackend
                from django.conf import settings
                data = TokenBackend(
                    algorithm="HS256", signing_key=settings.SECRET_KEY
                ).decode(response.data["access"], verify=True)
                user = User.objects.get(id=data["user_id"])
                response.data["user"] = UserDetailSerializer(user).data
            except Exception:
                pass
        return response


# SMS verification disabled — no SMS provider configured
# Uncomment when SMS service is available
# class RequestOTPView(APIView):
#     """Request a new OTP for phone verification."""
#     permission_classes = [permissions.IsAuthenticated]
#
#     def post(self, request):
#         serializer = RequestOTPSerializer(data=request.data)
#         serializer.is_valid(raise_exception=True)
#         _send_otp(request.user)
#         return Response({"message": "OTP sent to your registered phone number."})


# SMS verification disabled — no SMS provider configured
# Uncomment when SMS service is available
# class VerifyOTPView(APIView):
#     """Verify the OTP and mark the user's phone as verified."""
#     permission_classes = [permissions.IsAuthenticated]
#
#     def post(self, request):
#         from .serializers import VerifyOTPSerializer
#         serializer = VerifyOTPSerializer(data=request.data)
#         serializer.is_valid(raise_exception=True)
#         verification = serializer.validated_data["verification"]
#         verification.is_used = True
#         verification.save(update_fields=["is_used"])
#         request.user.is_verified = True
#         request.user.save(update_fields=["is_verified"])
#         return Response({"message": "Phone number verified successfully."})


class LogoutView(APIView):
    """Blacklist the refresh token (logout)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({"message": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)


# ── Profile views ─────────────────────────────────────────────────

class MeView(generics.RetrieveUpdateAPIView):
    """Get or update the authenticated user's profile."""
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()

        # Update user-level fields (first_name, last_name, email, preferred_language)
        user_fields = {k: v for k, v in request.data.items()
                       if k not in ("shipper_profile", "driver_profile", "carrier_profile")}
        if user_fields:
            user_serializer = self.get_serializer(user, data=user_fields, partial=True)
            user_serializer.is_valid(raise_exception=True)
            user_serializer.save()

        # Update nested role profiles if provided
        if "shipper_profile" in request.data and hasattr(user, "shipper_profile"):
            sp = ShipperProfileSerializer(
                user.shipper_profile, data=request.data["shipper_profile"], partial=True
            )
            sp.is_valid(raise_exception=True)
            sp.save()

        if "driver_profile" in request.data and hasattr(user, "driver_profile"):
            dp = DriverProfileSerializer(
                user.driver_profile, data=request.data["driver_profile"], partial=True
            )
            dp.is_valid(raise_exception=True)
            dp.save()

        if "carrier_profile" in request.data and hasattr(user, "carrier_profile"):
            cp = CarrierProfileSerializer(
                user.carrier_profile, data=request.data["carrier_profile"], partial=True
            )
            cp.is_valid(raise_exception=True)
            cp.save()

        # Re-fetch to get fresh nested data in the response
        user.refresh_from_db()
        return Response(self.get_serializer(user).data)


class UpdateFCMTokenView(APIView):
    """Update FCM push token for the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = UpdateFCMTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.fcm_token = serializer.validated_data["fcm_token"]
        request.user.save(update_fields=["fcm_token"])
        return Response({"message": "FCM token updated."})


class DriverAvailabilityView(APIView):
    """Toggle driver online/offline status and update location."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        from core.permissions import IsDriver
        if not request.user.is_driver:
            return Response(
                {"error": {"code": "PERMISSION_DENIED", "message": "Only drivers can update availability."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = DriverAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = request.user.driver_profile
        profile.is_available = serializer.validated_data["is_available"]
        if "current_lat" in serializer.validated_data:
            profile.current_lat = serializer.validated_data["current_lat"]
        if "current_lng" in serializer.validated_data:
            profile.current_lng = serializer.validated_data["current_lng"]
        profile.last_location_update = timezone.now()
        profile.save()
        return Response(DriverProfileSerializer(profile).data)


class ShipperProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ShipperProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_object(self):
        return self.request.user.shipper_profile


class DriverProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_object(self):
        return self.request.user.driver_profile


class CarrierProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CarrierProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_object(self):
        return self.request.user.carrier_profile


class CarrierDriversView(generics.ListAPIView):
    """List drivers associated with the authenticated carrier."""
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        carrier_profile = getattr(self.request.user, "carrier_profile", None)
        if not carrier_profile:
            return User.objects.none()
        return User.objects.filter(
            driver_profile__employer=carrier_profile
        ).select_related("driver_profile")


class CarrierInviteDriverView(generics.UpdateAPIView):
    """Associate an existing driver with this carrier by phone number."""
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        from .models import DriverProfile as DP
        carrier_profile = getattr(request.user, "carrier_profile", None)
        if not carrier_profile:
            return Response({"error": "Not a carrier account."}, status=status.HTTP_403_FORBIDDEN)
        phone = request.data.get("phone_number")
        try:
            driver = User.objects.get(phone_number=phone, role="DRIVER")
            dp, _ = DP.objects.get_or_create(user=driver, defaults={"license_number": "PENDING"})
            dp.employer = carrier_profile
            dp.save(update_fields=["employer"])
            return Response({"message": "Driver associated."})
        except User.DoesNotExist:
            return Response({"error": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)


class CarrierCreateDriverView(generics.CreateAPIView):
    """Create a new driver account and automatically link it to the carrier."""
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        from .models import DriverProfile as DP
        carrier_profile = getattr(request.user, "carrier_profile", None)
        if not carrier_profile:
            return Response({"error": "Not a carrier account."}, status=status.HTTP_403_FORBIDDEN)

        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        phone = request.data.get("phone_number", "").strip()
        password = request.data.get("password", "").strip()
        city = request.data.get("city", "Dakar").strip()

        if not first_name or not phone or not password:
            return Response(
                {"error": "Prénom, téléphone et mot de passe sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 6:
            return Response(
                {"error": "Le mot de passe doit avoir au moins 6 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(phone_number=phone).exists():
            return Response(
                {"error": "Ce numéro de téléphone est déjà utilisé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            phone_number=phone,
            first_name=first_name,
            last_name=last_name,
            role="DRIVER",
            city=city,
            password=password,
            is_verified=True,
        )
        dp, _ = DP.objects.get_or_create(user=user, defaults={"license_number": "PENDING"})
        dp.employer = carrier_profile
        dp.save(update_fields=["employer"])

        return Response(UserDetailSerializer(user).data, status=status.HTTP_201_CREATED)


# ── Admin views ───────────────────────────────────────────────────

class UserListView(generics.ListAPIView):
    """Admin: list all users with filtering."""
    serializer_class = UserDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filterset_fields = ["role", "is_verified", "is_active"]
    search_fields = ["first_name", "last_name", "phone_number", "email"]
    ordering_fields = ["created_at", "first_name"]

    def get_queryset(self):
        return User.objects.select_related(
            "shipper_profile", "driver_profile", "broker_profile"
        ).all()


# ── Helpers ───────────────────────────────────────────────────────

def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


# SMS verification disabled — no SMS provider configured
# Uncomment when SMS service is available
# def _send_otp(user):
#     from core.utils import generate_otp
#     otp = generate_otp()
#     PhoneVerification.objects.create(...)
#     send_sms_task.delay(...)


class ContactMessageView(APIView):
    """POST /api/v1/contact/ - save a contact form submission."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        if not data.get("first_name") or not data.get("subject") or not data.get("message"):
            return Response({"error": "first_name, subject and message are required."}, status=status.HTTP_400_BAD_REQUEST)
        ContactMessage.objects.create(
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            address=data.get("address", ""),
            subject=data.get("subject", ""),
            message=data.get("message", ""),
            user=request.user,
        )
        return Response({"detail": "Message sent."}, status=status.HTTP_201_CREATED)
