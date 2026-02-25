"""Auth URLs — /api/v1/auth/"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    CustomTokenObtainPairView,
    LogoutView,
    RegisterView,
    RequestOTPView,
    VerifyOTPView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("otp/request/", RequestOTPView.as_view(), name="auth-otp-request"),
    path("otp/verify/", VerifyOTPView.as_view(), name="auth-otp-verify"),
]
