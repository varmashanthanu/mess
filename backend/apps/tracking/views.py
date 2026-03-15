"""Tracking REST Views (complement to WebSocket consumers)"""
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import GPSCursorPagination
from core.permissions import IsAdmin
from .models import GPSPing, OrderRoute
from .serializers import GPSPingSerializer, OrderRouteSerializer


class DriverRecentPingsView(generics.ListAPIView):
    """Get recent GPS pings for a driver (admin only or driver themselves)."""
    serializer_class = GPSPingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = GPSCursorPagination

    def get_queryset(self):
        driver_id = self.kwargs.get("driver_id") or self.request.user.id
        qs = GPSPing.objects.filter(driver_id=driver_id)
        return qs


class OrderPingsView(generics.ListAPIView):
    """All GPS pings recorded during an order."""
    serializer_class = GPSPingSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = GPSCursorPagination

    def get_queryset(self):
        order_id = self.kwargs["order_pk"]
        return GPSPing.objects.filter(order_id=order_id)


class OrderRouteView(generics.RetrieveAPIView):
    """Get the route for a specific order."""
    serializer_class = OrderRouteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return OrderRoute.objects.get(order_id=self.kwargs["order_pk"])


class AvailableDriversView(APIView):
    """
    GET /tracking/available-drivers/?lat=14.7&lng=-17.4&radius_km=50
    Returns available drivers in DriverLocation format (same as WS broadcast).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import DriverProfile
        from core.utils import haversine_distance

        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius_km = float(request.query_params.get("radius_km", 50))

        drivers = DriverProfile.objects.filter(
            is_available=True,
            current_lat__isnull=False,
            current_lng__isnull=False,
        ).select_related("user")

        def _serialize(profile, distance_km=None):
            entry = {
                "driver_id": str(profile.user.id),
                "driver_name": profile.user.full_name,
                "lat": float(profile.current_lat),
                "lng": float(profile.current_lng),
                "speed": None,
                "bearing": None,
                "timestamp": profile.last_location_update.isoformat() if profile.last_location_update else None,
                "is_available": True,
            }
            if distance_km is not None:
                entry["distance_km"] = distance_km
            return entry

        if lat and lng:
            lat_f, lng_f = float(lat), float(lng)
            nearby = []
            for d in drivers:
                dist = haversine_distance(lat_f, lng_f, float(d.current_lat), float(d.current_lng))
                if dist <= radius_km:
                    nearby.append((d, round(dist, 2)))
            nearby.sort(key=lambda x: x[1])
            return Response([_serialize(d, dist) for d, dist in nearby])

        return Response([_serialize(d) for d in drivers])
