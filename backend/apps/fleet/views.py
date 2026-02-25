"""MESS Platform — Fleet Views"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from core.permissions import IsAdmin, IsOwnerOrAdmin
from .models import Vehicle, VehicleDocument, VehicleType
from .serializers import (
    VehicleDocumentSerializer,
    VehicleListSerializer,
    VehicleSerializer,
    VehicleTypeSerializer,
)


class VehicleTypeListView(generics.ListAPIView):
    """Public list of vehicle types."""
    serializer_class = VehicleTypeSerializer
    permission_classes = [permissions.AllowAny]
    queryset = VehicleType.objects.filter(is_active=True)


class VehicleListCreateView(generics.ListCreateAPIView):
    """List own vehicles or create a new one."""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return VehicleListSerializer
        return VehicleSerializer

    def get_queryset(self):
        user = self.request.user
        from apps.accounts.constants import UserRole
        if user.role == UserRole.ADMIN:
            return Vehicle.objects.select_related("vehicle_type").all()
        return Vehicle.objects.filter(owner=user).select_related("vehicle_type")


class VehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        return Vehicle.objects.select_related("vehicle_type").prefetch_related("documents")

    def perform_destroy(self, instance):
        # Soft deactivate instead of delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class VehicleDocumentCreateView(generics.CreateAPIView):
    serializer_class = VehicleDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        vehicle_id = self.kwargs["vehicle_pk"]
        vehicle = Vehicle.objects.get(id=vehicle_id, owner=self.request.user)
        serializer.save(vehicle=vehicle)


class AdminVerifyVehicleView(generics.UpdateAPIView):
    """Admin: approve a vehicle registration."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def patch(self, request, *args, **kwargs):
        vehicle = self.get_object()
        vehicle.is_verified = True
        vehicle.save(update_fields=["is_verified"])
        return Response({"message": "Vehicle verified."})
