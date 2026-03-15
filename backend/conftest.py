"""
Shared pytest fixtures for the MESS platform test suite.
"""
import pytest
from rest_framework.test import APIClient


# ── API client ─────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    return APIClient()


# ── Users ──────────────────────────────────────────────────────────────────

@pytest.fixture
def shipper(db):
    from apps.accounts.models import ShipperProfile, User
    user = User.objects.create_user(
        phone_number="+221771234567",
        password="testpass123",
        first_name="Mamadou",
        last_name="Diallo",
        role="SHIPPER",
        is_verified=True,
    )
    ShipperProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def driver(db):
    from apps.accounts.models import DriverProfile, User
    user = User.objects.create_user(
        phone_number="+221772345678",
        password="testpass123",
        first_name="Ibrahima",
        last_name="Fall",
        role="DRIVER",
        is_verified=True,
    )
    DriverProfile.objects.get_or_create(
        user=user,
        defaults={"license_number": "SN-DK-001", "is_available": True},
    )
    return user


@pytest.fixture
def driver2(db):
    """A second driver for multi-bid tests."""
    from apps.accounts.models import DriverProfile, User
    user = User.objects.create_user(
        phone_number="+221773456789",
        password="testpass123",
        first_name="Oumar",
        last_name="Seck",
        role="DRIVER",
        is_verified=True,
    )
    DriverProfile.objects.get_or_create(
        user=user,
        defaults={"license_number": "SN-DK-002", "is_available": True},
    )
    return user


@pytest.fixture
def admin_user(db):
    from apps.accounts.models import User
    return User.objects.create_user(
        phone_number="+221774567890",
        password="adminpass123",
        first_name="Admin",
        last_name="MESS",
        role="ADMIN",
        is_verified=True,
        is_staff=True,
        is_superuser=True,
    )


# ── Authenticated clients ──────────────────────────────────────────────────

@pytest.fixture
def shipper_client(api_client, shipper):
    api_client.force_authenticate(user=shipper)
    return api_client


@pytest.fixture
def driver_client(api_client, driver):
    api_client.force_authenticate(user=driver)
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


# ── Fleet ──────────────────────────────────────────────────────────────────

@pytest.fixture
def vehicle_type(db):
    from apps.fleet.models import VehicleType
    return VehicleType.objects.create(
        name="Camion 10T",
        name_fr="Camion 10 Tonnes",
        max_payload_kg=10_000,
    )


@pytest.fixture
def vehicle(db, driver, vehicle_type):
    from apps.fleet.models import Vehicle
    return Vehicle.objects.create(
        owner=driver,
        vehicle_type=vehicle_type,
        registration_number="DK-1234-A",
        make="Mercedes-Benz",
        model="Actros",
        year=2018,
        is_active=True,
        is_verified=True,
    )


# ── Orders ─────────────────────────────────────────────────────────────────

@pytest.fixture
def draft_order(db, shipper, vehicle_type):
    """A DRAFT freight order with coordinates (Dakar → Thiès)."""
    from apps.orders.models import FreightOrder, OrderStatus
    return FreightOrder.objects.create(
        shipper=shipper,
        cargo_type="GENERAL",
        cargo_description="Bags of rice",
        weight_kg=1000,
        pickup_address="Port de Dakar, Dakar",
        pickup_city="Dakar",
        pickup_lat="14.6928",
        pickup_lng="-17.4467",
        delivery_address="Marché Central, Thiès",
        delivery_city="Thiès",
        delivery_lat="14.7877",
        delivery_lng="-16.9246",
        status=OrderStatus.DRAFT,
    )


@pytest.fixture
def posted_order(db, shipper, vehicle_type):
    """A POSTED order ready for bids."""
    from apps.orders.models import FreightOrder, OrderStatus
    return FreightOrder.objects.create(
        shipper=shipper,
        cargo_type="GENERAL",
        cargo_description="Bags of rice",
        weight_kg=1000,
        pickup_address="Port de Dakar, Dakar",
        pickup_city="Dakar",
        pickup_lat="14.6928",
        pickup_lng="-17.4467",
        delivery_address="Marché Central, Thiès",
        delivery_city="Thiès",
        delivery_lat="14.7877",
        delivery_lng="-16.9246",
        status=OrderStatus.POSTED,
    )


@pytest.fixture
def accepted_order(db, posted_order, driver, vehicle):
    """An ASSIGNED order with a driver and vehicle."""
    from apps.orders.models import OrderAssignment, OrderBid, OrderStatus
    bid = OrderBid.objects.create(
        order=posted_order,
        carrier=driver,
        vehicle=vehicle,
        price=150_000,
        status=OrderBid.BidStatus.ACCEPTED,
    )
    posted_order.transition_to(OrderStatus.ASSIGNED)
    posted_order.final_price = bid.price
    posted_order.save(update_fields=["final_price"])
    OrderAssignment.objects.create(
        order=posted_order,
        driver=driver,
        vehicle=vehicle,
        accepted_bid=bid,
    )
    return posted_order
