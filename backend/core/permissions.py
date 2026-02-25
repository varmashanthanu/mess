"""
MESS Platform — Custom DRF Permissions
"""
from rest_framework.permissions import BasePermission

from apps.accounts.constants import UserRole


class IsAdmin(BasePermission):
    """Only platform administrators."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class IsShipper(BasePermission):
    """Only shippers (freight senders)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.SHIPPER)


class IsDriver(BasePermission):
    """Only drivers (truck operators)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.DRIVER)


class IsBroker(BasePermission):
    """Only freight brokers."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.BROKER)


class IsCarrier(BasePermission):
    """Drivers or fleet managers acting as carriers."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (UserRole.DRIVER, UserRole.FLEET_MANAGER)
        )


class IsShipperOrBroker(BasePermission):
    """Shippers or brokers — those who create orders."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (UserRole.SHIPPER, UserRole.BROKER)
        )


class IsOwnerOrAdmin(BasePermission):
    """Object-level: owner of the object or admin."""
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == UserRole.ADMIN:
            return True
        # Support both user FK and direct user comparison
        owner = getattr(obj, "user", None) or getattr(obj, "shipper", None) or getattr(obj, "driver", None)
        return owner == request.user


class IsVerified(BasePermission):
    """User must have completed phone/identity verification."""
    message = "Account verification required. Please verify your phone number."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_verified)
