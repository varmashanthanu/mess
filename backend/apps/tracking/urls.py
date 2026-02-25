"""Tracking URLs — /api/v1/tracking/"""
from django.urls import path
from .views import AvailableDriversView, DriverRecentPingsView, OrderPingsView, OrderRouteView

urlpatterns = [
    path("available-drivers/", AvailableDriversView.as_view(), name="tracking-available-drivers"),
    path("drivers/<uuid:driver_id>/pings/", DriverRecentPingsView.as_view(), name="tracking-driver-pings"),
    path("orders/<uuid:order_pk>/pings/", OrderPingsView.as_view(), name="tracking-order-pings"),
    path("orders/<uuid:order_pk>/route/", OrderRouteView.as_view(), name="tracking-order-route"),
]
