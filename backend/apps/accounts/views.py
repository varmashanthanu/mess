"""
MESS Platform — Accounts Views
"""
import logging
from datetime import timedelta

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
from .models import PhoneVerification
from .serializers import (
    BrokerProfileSerializer,
    CustomTokenObtainPairSerializer,
    DriverAvailabilitySerializer,
    DriverProfileSerializer,
    RegisterSerializer,
    RequestOTPSerializer,
    ShipperProfileSerializer,
    UpdateFCMTokenSerializer,
    UserDetailSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()

OTP_EXPIRY_MINUTES = 10


# ── Auth views ────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """Register a new user. Triggers OTP to phone."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Trigger OTP immediately after registration
        _send_otp(user)
        tokens = _get_tokens(user)
        return Response(
            {
                "message": "Registration successful. OTP sent to your phone number.",
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


class RequestOTPView(APIView):
    """Request a new OTP for phone verification."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _send_otp(request.user)
        return Response({"message": "OTP sent to your registered phone number."})


class VerifyOTPView(APIView):
    """Verify the OTP and mark the user's phone as verified."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .serializers import VerifyOTPSerializer
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = serializer.validated_data["verification"]
        verification.is_used = True
        verification.save(update_fields=["is_used"])
        request.user.is_verified = True
        request.user.save(update_fields=["is_verified"])
        return Response({"message": "Phone number verified successfully."})


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


def _send_otp(user):
    """Create an OTP record and dispatch SMS (async via Celery)."""
    from core.utils import generate_otp
    otp = generate_otp()
    PhoneVerification.objects.create(
        user=user,
        otp=otp,
        phone_number=user.phone_number,
        expires_at=timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    # Dispatch async SMS
    from apps.notifications.tasks import send_sms_task
    send_sms_task.delay(
        phone=str(user.phone_number),
        message=f"Your MESS verification code is: {otp}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
    )
    logger.info(f"OTP sent to {user.phone_number}")
