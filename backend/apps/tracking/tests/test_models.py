"""
Tests for tracking models: GPSPing and OrderRoute.
"""
import pytest
from decimal import Decimal
from django.utils import timezone

from apps.tracking.models import GPSPing, OrderRoute


@pytest.mark.django_db
class TestGPSPing:
    def test_create_gps_ping(self, driver, posted_order):
        ping = GPSPing.objects.create(
            driver=driver,
            order=posted_order,
            lat=Decimal("14.6928"),
            lng=Decimal("-17.4467"),
            accuracy_m=Decimal("5.0"),
            speed_kmh=Decimal("60.0"),
            bearing=Decimal("45.0"),
        )
        assert ping.id is not None
        assert ping.timestamp is not None

    def test_ping_str(self, driver, posted_order):
        ping = GPSPing.objects.create(
            driver=driver,
            lat=Decimal("14.6928"),
            lng=Decimal("-17.4467"),
        )
        s = str(ping)
        assert str(driver) in s

    def test_ping_without_order(self, driver):
        ping = GPSPing.objects.create(
            driver=driver,
            lat=Decimal("14.6928"),
            lng=Decimal("-17.4467"),
        )
        assert ping.order is None

    def test_pings_ordered_by_timestamp_desc(self, driver):
        t1 = timezone.now()
        p1 = GPSPing.objects.create(driver=driver, lat="14.69", lng="-17.44", timestamp=t1)

        import time
        time.sleep(0.01)
        t2 = timezone.now()
        p2 = GPSPing.objects.create(driver=driver, lat="14.70", lng="-17.43", timestamp=t2)

        pings = list(GPSPing.objects.filter(driver=driver))
        assert pings[0].id == p2.id  # Most recent first

    def test_multiple_pings_for_same_order(self, driver, posted_order):
        for i in range(5):
            GPSPing.objects.create(
                driver=driver,
                order=posted_order,
                lat=Decimal(str(14.69 + i * 0.001)),
                lng=Decimal("-17.44"),
            )
        assert GPSPing.objects.filter(order=posted_order).count() == 5


@pytest.mark.django_db
class TestOrderRoute:
    def test_create_order_route(self, posted_order):
        route = OrderRoute.objects.create(
            order=posted_order,
            planned_distance_km=Decimal("72.5"),
            planned_duration_minutes=90,
        )
        assert route.id is not None

    def test_order_route_str(self, posted_order):
        route = OrderRoute.objects.create(order=posted_order)
        assert posted_order.reference in str(route)

    def test_one_route_per_order(self, posted_order):
        OrderRoute.objects.create(order=posted_order)
        with pytest.raises(Exception):
            OrderRoute.objects.create(order=posted_order)

    def test_route_stores_geojson(self, posted_order):
        geojson = {
            "type": "LineString",
            "coordinates": [[-17.4467, 14.6928], [-16.9246, 14.7877]],
        }
        route = OrderRoute.objects.create(
            order=posted_order,
            planned_route_geojson=geojson,
        )
        route.refresh_from_db()
        assert route.planned_route_geojson["type"] == "LineString"
