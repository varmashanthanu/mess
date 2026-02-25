"""Fleet URLs — /api/v1/fleet/"""
from django.urls import path
from .views import (
    AdminVerifyVehicleView,
    VehicleDetailView,
    VehicleDocumentCreateView,
    VehicleListCreateView,
    VehicleTypeListView,
)

urlpatterns = [
    path("vehicle-types/", VehicleTypeListView.as_view(), name="fleet-vehicle-types"),
    path("vehicles/", VehicleListCreateView.as_view(), name="fleet-vehicle-list"),
    path("vehicles/<uuid:pk>/", VehicleDetailView.as_view(), name="fleet-vehicle-detail"),
    path("vehicles/<uuid:vehicle_pk>/documents/", VehicleDocumentCreateView.as_view(), name="fleet-vehicle-docs"),
    path("vehicles/<uuid:pk>/verify/", AdminVerifyVehicleView.as_view(), name="fleet-vehicle-verify"),
]
