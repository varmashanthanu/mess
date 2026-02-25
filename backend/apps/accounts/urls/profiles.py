"""Profile URLs — /api/v1/accounts/"""
from django.urls import path

from apps.accounts.views import (
    DriverAvailabilityView,
    DriverProfileView,
    MeView,
    ShipperProfileView,
    UpdateFCMTokenView,
    UserListView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="accounts-me"),
    path("me/fcm-token/", UpdateFCMTokenView.as_view(), name="accounts-fcm-token"),
    path("me/availability/", DriverAvailabilityView.as_view(), name="accounts-driver-availability"),
    path("me/shipper-profile/", ShipperProfileView.as_view(), name="accounts-shipper-profile"),
    path("me/driver-profile/", DriverProfileView.as_view(), name="accounts-driver-profile"),
    # Admin
    path("users/", UserListView.as_view(), name="accounts-user-list"),
]
