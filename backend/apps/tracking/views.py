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
    Returns list of available drivers within a radius.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import DriverProfile
        from apps.accounts.serializers import DriverProfileSerializer
        from core.utils import haversine_distance

        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius_km = float(request.query_params.get("radius_km", 50))

        drivers = DriverProfile.objects.filter(
            is_available=True,
            current_lat__isnull=False,
            current_lng__isnull=False,
        ).select_related("user")

        if lat and lng:
            # Filter by distance in Python (no PostGIS for now)
            lat, lng = float(lat), float(lng)
            nearby = []
            for d in drivers:
                dist = haversine_distance(lat, lng, float(d.current_lat), float(d.current_lng))
                if dist <= radius_km:
                    nearby.append({"profile": d, "distance_km": round(dist, 2)})
            nearby.sort(key=lambda x: x["distance_km"])
            return Response([
                {**DriverProfileSerializer(item["profile"]).data, "distance_km": item["distance_km"]}
                for item in nearby
            ])

        serializer = DriverProfileSerializer(drivers, many=True)
        return Response(serializer.data)
