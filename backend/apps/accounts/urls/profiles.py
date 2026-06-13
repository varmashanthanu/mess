"""Profile URLs — /api/v1/accounts/"""
from django.urls import path

from apps.accounts.views import (
    CarrierCreateDriverView,
    CarrierDriversView,
    CarrierInviteDriverView,
    CarrierProfileView,
    ContactMessageView,
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
    path("me/carrier-profile/", CarrierProfileView.as_view(), name="accounts-carrier-profile"),
    path("me/drivers/", CarrierDriversView.as_view(), name="accounts-carrier-drivers"),
    path("me/drivers/invite/", CarrierInviteDriverView.as_view(), name="accounts-carrier-invite-driver"),
    path("me/drivers/create/", CarrierCreateDriverView.as_view(), name="accounts-carrier-create-driver"),
    path("contact/", ContactMessageView.as_view(), name="accounts-contact"),
    # Admin
    path("users/", UserListView.as_view(), name="accounts-user-list"),
]
