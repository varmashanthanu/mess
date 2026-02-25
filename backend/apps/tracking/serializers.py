"""Tracking Serializers"""
from rest_framework import serializers
from .models import GPSPing, OrderRoute


class GPSPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = GPSPing
        fields = ["id", "lat", "lng", "accuracy_m", "speed_kmh", "bearing", "timestamp"]
        read_only_fields = ["id", "timestamp"]


class OrderRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderRoute
        fields = [
            "id", "order", "planned_route_geojson", "actual_route_geojson",
            "planned_distance_km", "planned_duration_minutes", "actual_distance_km",
        ]
        read_only_fields = ["id", "order"]
