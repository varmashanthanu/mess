"""
MESS Platform - Workspace Switching
One user, multiple workspaces. Same session, different context.
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    BrokerProfile, CarrierProfile, DriverProfile,
    ShipperProfile, User, WorkspaceSwitchLog,
)

WORKSPACE_PERMISSIONS = {
    "PERSONAL":   [],
    "SHIPPER":    ["orders.create", "orders.view", "tracking.view", "messaging.use"],
    "DRIVER":     ["orders.view", "tracking.update", "messaging.use"],
    "CARRIER":    ["fleet.manage", "drivers.manage", "loads.view", "orders.view", "messaging.use"],
    "BROKER":     ["orders.view", "loads.view", "orders.match", "messaging.use"],
    "ADMIN":      ["admin.all", "users.manage", "orders.all", "fleet.all"],
    "SUPERADMIN": ["superadmin.all", "admin.all"],
}

WORKSPACE_NAV = {
    "PERSONAL":   ["dashboard", "profile", "notifications"],
    "SHIPPER":    ["dashboard", "orders", "tracking", "messaging", "notifications", "profile"],
    "DRIVER":     ["dashboard", "orders", "tracking", "messaging", "notifications", "profile"],
    "CARRIER":    ["dashboard", "fleet", "orders", "load-board", "messaging", "notifications", "profile"],
    "BROKER":     ["broker-dashboard", "load-board", "orders", "messaging", "notifications", "profile"],
    "ADMIN":      ["admin", "orders", "fleet", "notifications", "profile"],
    "SUPERADMIN": ["superadmin", "admin", "orders", "fleet", "notifications", "profile"],
}


def _get_user_workspaces(user):
    personal   = {"id": "PERSONAL",   "type": "PERSONAL",   "name": "Espace Personnel"}
    superadmin = {"id": "SUPERADMIN", "type": "SUPERADMIN", "name": "Super Admin"}
    admin      = {"id": "ADMIN",      "type": "ADMIN",      "name": "Administration"}
    carrier    = {"id": "CARRIER",    "type": "CARRIER",    "name": "Espace Transporteur"}
    broker     = {"id": "BROKER",     "type": "BROKER",     "name": "Espace Courtier"}
    shipper    = {"id": "SHIPPER",    "type": "SHIPPER",    "name": "Espace Expediteur"}
    driver     = {"id": "DRIVER",     "type": "DRIVER",     "name": "Espace Chauffeur"}

    if user.is_superuser:
        # Super Admin : SUPERADMIN + ADMIN + tous les comptes utilisateurs sauf Chauffeur
        return [personal, superadmin, admin, carrier, broker, shipper]

    if user.role == "ADMIN":
        # Admin : tous les espaces sauf Super Admin
        return [personal, admin, carrier, broker, shipper, driver]

    # Utilisateurs normaux (BROKER, CARRIER, SHIPPER, DRIVER) :
    # peuvent switcher entre tous les comptes utilisateurs (pas admin, pas superadmin)
    return [personal, shipper, driver, carrier, broker]


def _build_tokens_with_workspace(user, workspace_type, workspace_name):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["name"] = user.full_name
    refresh["phone"] = str(user.phone_number)
    refresh["workspace_type"] = workspace_type
    refresh["workspace_name"] = workspace_name
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class WorkspaceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        workspaces = _get_user_workspaces(request.user)
        # Read workspace_type from JWT payload (SimpleJWT sets request.auth)
        active = request.user.role
        token = getattr(request, "auth", None)
        if token is not None:
            payload = getattr(token, "payload", {})
            active = payload.get("workspace_type") or active
        return Response({
            "active_workspace": active,
            "workspaces": workspaces,
        })


class WorkspaceSwitchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get("workspaceId") or request.data.get("workspace_id")
        if not workspace_id:
            return Response(
                {"error": {"code": "VALIDATION_ERROR", "message": "workspaceId is required"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workspace_id = str(workspace_id).upper()
        available = _get_user_workspaces(request.user)
        available_ids = [w["id"] for w in available]

        if workspace_id not in available_ids:
            return Response(
                {"error": {"code": "PERMISSION_DENIED", "message": "Access to this workspace is not authorized."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        workspace = next(w for w in available if w["id"] == workspace_id)

        prev_workspace = request.data.get("currentWorkspace", request.user.role)
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
        )
        WorkspaceSwitchLog.objects.create(
            user=request.user,
            from_workspace=str(prev_workspace)[:20],
            to_workspace=workspace_id,
            ip_address=ip or None,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )

        tokens = _build_tokens_with_workspace(request.user, workspace_id, workspace["name"])

        return Response({
            "workspace": workspace,
            "role": workspace_id,
            "permissions": WORKSPACE_PERMISSIONS.get(workspace_id, []),
            "nav": WORKSPACE_NAV.get(workspace_id, []),
            **tokens,
        })
