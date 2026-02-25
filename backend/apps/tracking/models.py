"""
MESS Platform — Tracking Models
Real-time GPS pings and route storage.
"""
from django.db import models
from django.utils import timezone

from core.models import BaseModel, UUIDModel


class GPSPing(UUIDModel):
    """
    A single GPS location update from a driver.
    High-volume, append-only table — no updated_at, no soft-delete.
    Partitioned by timestamp in production for performance.
    """
    driver = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="gps_pings"
    )
    order = models.ForeignKey(
        "orders.FreightOrder", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="gps_pings"
    )
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    speed_kmh = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bearing = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "GPS Ping"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["driver", "-timestamp"]),
            models.Index(fields=["order", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.driver} @ ({self.lat}, {self.lng}) {self.timestamp}"


class OrderRoute(BaseModel):
    """
    Planned/actual route for a freight order.
    waypoints stored as GeoJSON FeatureCollection.
    """
    order = models.OneToOneField(
        "orders.FreightOrder", on_delete=models.CASCADE, related_name="route"
    )
    # GeoJSON LineString of the planned route from routing engine
    planned_route_geojson = models.JSONField(null=True, blank=True)
    # GeoJSON LineString built from actual GPS pings
    actual_route_geojson = models.JSONField(null=True, blank=True)

    planned_distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    planned_duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    actual_distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Order Route"

    def __str__(self):
        return f"Route for {self.order.reference}"
