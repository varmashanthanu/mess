"""
Integration tests for the Orders API endpoints.
Covers the full order lifecycle through HTTP.
"""
import pytest
from apps.orders.models import FreightOrder, OrderAssignment, OrderStatus


BASE = "/api/v1/orders"


@pytest.mark.django_db
class TestOrderCreation:
    def _payload(self, **overrides):
        return {
            "cargo_type": "GENERAL",
            "cargo_description": "Bags of rice",
            "weight_kg": "1000.00",
            "pickup_address": "Port de Dakar",
            "pickup_city": "Dakar",
            "pickup_lat": "14.6928",
            "pickup_lng": "-17.4467",
            "delivery_address": "Marché Central",
            "delivery_city": "Thiès",
            "delivery_lat": "14.7877",
            "delivery_lng": "-16.9246",
            **overrides,
        }

    def test_shipper_creates_order(self, shipper_client):
        resp = shipper_client.post(f"{BASE}/", self._payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "DRAFT"
        assert data["reference"].startswith("MESS-")
        assert data["estimated_distance_km"] is not None

    def test_driver_cannot_create_order(self, driver_client):
        resp = driver_client.post(f"{BASE}/", self._payload())
        assert resp.status_code in (400, 422)

    def test_unauthenticated_request_rejected(self, api_client):
        resp = api_client.post(f"{BASE}/", self._payload())
        assert resp.status_code == 401

    def test_order_with_coordinates_gets_distance_estimate(self, shipper_client):
        resp = shipper_client.post(f"{BASE}/", self._payload())
        data = resp.json()
        assert float(data["estimated_distance_km"]) > 0


@pytest.mark.django_db
class TestOrderListing:
    def test_shipper_sees_only_own_orders(self, shipper_client, shipper, posted_order, driver):
        # Create a second shipper with an order
        from apps.accounts.models import ShipperProfile, User
        other = User.objects.create_user(
            phone_number="+221770000001",
            password="pass",
            first_name="Other",
            last_name="Shipper",
            role="SHIPPER",
        )
        ShipperProfile.objects.get_or_create(user=other)
        FreightOrder.objects.create(
            shipper=other,
            cargo_type="BULK",
            cargo_description="Sand",
            weight_kg=5000,
            pickup_address="A",
            pickup_city="Dakar",
            delivery_address="B",
            delivery_city="Thiès",
            status=OrderStatus.POSTED,
        )
        resp = shipper_client.get(f"{BASE}/")
        ids = [o["id"] for o in resp.json()["results"]]
        assert str(posted_order.id) in ids
        assert all(
            FreightOrder.objects.get(id=oid).shipper == shipper
            for oid in ids
        )

    def test_driver_sees_only_posted_orders(self, driver_client, posted_order):
        resp = driver_client.get(f"{BASE}/")
        assert resp.status_code == 200
        statuses = {o["status"] for o in resp.json()["results"]}
        assert statuses <= {OrderStatus.POSTED}


@pytest.mark.django_db
class TestOrderPosting:
    def test_shipper_posts_draft_order(self, shipper_client, draft_order):
        resp = shipper_client.post(f"{BASE}/{draft_order.id}/post/")
        assert resp.status_code == 200
        draft_order.refresh_from_db()
        assert draft_order.status == OrderStatus.POSTED

    def test_cannot_post_non_draft(self, shipper_client, posted_order):
        resp = shipper_client.post(f"{BASE}/{posted_order.id}/post/")
        assert resp.status_code in (400, 422)


@pytest.mark.django_db
class TestAcceptOrder:
    def test_driver_accepts_posted_order(self, driver_client, driver, vehicle, posted_order):
        resp = driver_client.post(f"{BASE}/{posted_order.id}/accept/", {
            "vehicle": str(vehicle.id),
        })
        assert resp.status_code == 200
        posted_order.refresh_from_db()
        assert posted_order.status == OrderStatus.ASSIGNED
        assert OrderAssignment.objects.filter(order=posted_order, driver=driver).exists()

    def test_driver_accepts_without_vehicle(self, driver_client, driver, posted_order):
        resp = driver_client.post(f"{BASE}/{posted_order.id}/accept/", {})
        assert resp.status_code == 200
        posted_order.refresh_from_db()
        assert posted_order.status == OrderStatus.ASSIGNED

    def test_final_price_set_to_proposed_price(self, driver_client, posted_order, vehicle):
        posted_order.proposed_price = 150_000
        posted_order.save(update_fields=["proposed_price"])
        driver_client.post(f"{BASE}/{posted_order.id}/accept/", {"vehicle": str(vehicle.id)})
        posted_order.refresh_from_db()
        assert float(posted_order.final_price) == 150_000.0

    def test_shipper_cannot_accept_order(self, shipper_client, posted_order):
        resp = shipper_client.post(f"{BASE}/{posted_order.id}/accept/", {})
        assert resp.status_code in (400, 403, 422)

    def test_cannot_accept_draft_order(self, driver_client, draft_order):
        resp = driver_client.post(f"{BASE}/{draft_order.id}/accept/", {})
        assert resp.status_code in (400, 422)

    def test_cannot_accept_already_assigned_order(self, driver_client, accepted_order):
        resp = driver_client.post(f"{BASE}/{accepted_order.id}/accept/", {})
        assert resp.status_code in (400, 422)


@pytest.mark.django_db
class TestDeliveryLifecycle:
    def _to_in_transit(self, driver_client, order_id):
        """Helper: submit pickup proof to move order from ASSIGNED → IN_TRANSIT."""
        driver_client.post(f"{BASE}/{order_id}/pickup-proof/", {"pickup_proof_note": "Collected"})

    def test_driver_submits_proof_of_delivery(self, driver_client, accepted_order):
        self._to_in_transit(driver_client, accepted_order.id)
        resp = driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {
            "proof_note": "Delivered to the warehouse manager.",
            "proof_signature": "Mamadou Diallo",
        })
        assert resp.status_code == 200
        accepted_order.refresh_from_db()
        assert accepted_order.status == OrderStatus.DELIVERED

    def test_shipper_confirms_delivery(self, shipper_client, driver_client, accepted_order):
        self._to_in_transit(driver_client, accepted_order.id)
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        assert resp.status_code == 200
        accepted_order.refresh_from_db()
        assert accepted_order.status == OrderStatus.COMPLETED

    def test_shipper_cannot_confirm_before_proof(self, shipper_client, accepted_order):
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        # Order is still in ASSIGNED state, not DELIVERED
        assert resp.status_code in (400, 422)

    def test_shipper_rates_driver(self, shipper_client, driver_client, accepted_order):
        self._to_in_transit(driver_client, accepted_order.id)
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/rate/", {"rating": 5, "review": "Excellent!"})
        assert resp.status_code == 200

    def test_driver_rates_shipper(self, shipper_client, driver_client, accepted_order):
        self._to_in_transit(driver_client, accepted_order.id)
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        resp = driver_client.post(f"{BASE}/{accepted_order.id}/rate/", {"rating": 4})
        assert resp.status_code == 200

    def test_rating_out_of_range_fails(self, shipper_client, driver_client, accepted_order):
        self._to_in_transit(driver_client, accepted_order.id)
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/rate/", {"rating": 6})
        assert resp.status_code == 400


@pytest.mark.django_db
class TestPriceEstimateEndpoint:
    url = f"{BASE}/estimate-price/"

    def test_returns_price_estimate(self, shipper_client):
        resp = shipper_client.post(self.url, {
            "cargo_type": "GENERAL",
            "weight_kg": 1000.0,
            "pickup_lat": 14.6928,
            "pickup_lng": -17.4467,
            "delivery_lat": 14.7877,
            "delivery_lng": -16.9246,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "base_price_xof" in data
        assert "min_price_xof" in data
        assert "max_price_xof" in data
        assert data["currency"] == "XOF"
        assert data["base_price_xof"] >= 25_000

    def test_unauthenticated_request_rejected(self, api_client):
        resp = api_client.post(self.url, {
            "cargo_type": "GENERAL",
            "weight_kg": 1000,
            "pickup_lat": 14.6928,
            "pickup_lng": -17.4467,
            "delivery_lat": 14.7877,
            "delivery_lng": -16.9246,
        })
        assert resp.status_code == 401

    def test_missing_fields_returns_400(self, shipper_client):
        resp = shipper_client.post(self.url, {"cargo_type": "GENERAL"})
        assert resp.status_code == 400


@pytest.mark.django_db
class TestOrderDetailSuggestedPrice:
    def test_order_with_coordinates_returns_suggested_price(self, shipper_client, posted_order):
        resp = shipper_client.get(f"{BASE}/{posted_order.id}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["suggested_price"] is not None
        assert "base_price_xof" in data["suggested_price"]

    def test_order_without_coordinates_returns_null_suggested_price(self, shipper_client, shipper):
        order = FreightOrder.objects.create(
            shipper=shipper,
            cargo_type="GENERAL",
            cargo_description="No coords",
            weight_kg=500,
            pickup_address="A",
            pickup_city="Dakar",
            delivery_address="B",
            delivery_city="Thiès",
            status=OrderStatus.DRAFT,
        )
        resp = shipper_client.get(f"{BASE}/{order.id}/")
        assert resp.status_code == 200
        assert resp.json()["suggested_price"] is None
