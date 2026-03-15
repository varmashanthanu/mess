"""
Integration tests for the Orders API endpoints.
Covers the full order lifecycle through HTTP.
"""
import pytest
from apps.orders.models import FreightOrder, OrderAssignment, OrderBid, OrderStatus


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
        assert resp.status_code == 400

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

    def test_driver_sees_posted_and_bidding_orders(self, driver_client, posted_order):
        resp = driver_client.get(f"{BASE}/")
        assert resp.status_code == 200
        statuses = {o["status"] for o in resp.json()["results"]}
        assert statuses <= {OrderStatus.POSTED, OrderStatus.BIDDING}


@pytest.mark.django_db
class TestOrderPosting:
    def test_shipper_posts_draft_order(self, shipper_client, draft_order):
        resp = shipper_client.post(f"{BASE}/{draft_order.id}/post/")
        assert resp.status_code == 200
        draft_order.refresh_from_db()
        assert draft_order.status == OrderStatus.POSTED

    def test_cannot_post_non_draft(self, shipper_client, posted_order):
        resp = shipper_client.post(f"{BASE}/{posted_order.id}/post/")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestBidFlow:
    def test_driver_bids_on_posted_order(self, driver_client, driver, vehicle, posted_order):
        resp = driver_client.post(f"{BASE}/{posted_order.id}/bids/", {
            "price": "145000.00",
            "message": "I can do this job",
            "vehicle": str(vehicle.id),
        })
        assert resp.status_code == 201
        posted_order.refresh_from_db()
        assert posted_order.status == OrderStatus.BIDDING

    def test_driver_cannot_bid_twice(self, driver_client, driver, vehicle, posted_order):
        driver_client.post(f"{BASE}/{posted_order.id}/bids/", {
            "price": "145000.00",
            "vehicle": str(vehicle.id),
        })
        resp = driver_client.post(f"{BASE}/{posted_order.id}/bids/", {
            "price": "140000.00",
            "vehicle": str(vehicle.id),
        })
        assert resp.status_code == 400

    def test_shipper_cannot_bid(self, shipper_client, posted_order):
        resp = shipper_client.post(f"{BASE}/{posted_order.id}/bids/", {
            "price": "145000.00",
        })
        # Shipper role is not in DRIVER/FLEET_MANAGER, so bid validation fails
        assert resp.status_code in (400, 403)

    def test_bid_on_draft_order_fails(self, driver_client, driver, vehicle, draft_order):
        resp = driver_client.post(f"{BASE}/{draft_order.id}/bids/", {
            "price": "145000.00",
            "vehicle": str(vehicle.id),
        })
        assert resp.status_code == 400


@pytest.mark.django_db
class TestAcceptBid:
    def test_shipper_accepts_bid_assigns_driver(
        self, shipper_client, driver, vehicle, posted_order
    ):
        bid = OrderBid.objects.create(
            order=posted_order,
            carrier=driver,
            vehicle=vehicle,
            price=145_000,
        )
        resp = shipper_client.post(f"{BASE}/{posted_order.id}/accept-bid/", {
            "bid_id": str(bid.id),
        })
        assert resp.status_code == 200
        posted_order.refresh_from_db()
        assert posted_order.status == OrderStatus.ASSIGNED
        assert OrderAssignment.objects.filter(order=posted_order).exists()
        bid.refresh_from_db()
        assert bid.status == OrderBid.BidStatus.ACCEPTED

    def test_accepting_bid_rejects_others(
        self, shipper_client, driver, driver2, vehicle, posted_order
    ):
        bid1 = OrderBid.objects.create(order=posted_order, carrier=driver, vehicle=vehicle, price=145_000)
        from apps.fleet.models import Vehicle
        vehicle2 = Vehicle.objects.create(
            owner=driver2,
            vehicle_type=vehicle.vehicle_type,
            registration_number="DK-5678-B",
            is_active=True,
            is_verified=True,
        )
        bid2 = OrderBid.objects.create(order=posted_order, carrier=driver2, vehicle=vehicle2, price=150_000)

        shipper_client.post(f"{BASE}/{posted_order.id}/accept-bid/", {"bid_id": str(bid1.id)})

        bid2.refresh_from_db()
        assert bid2.status == OrderBid.BidStatus.REJECTED

    def test_driver_cannot_accept_bid(self, driver_client, driver, vehicle, posted_order):
        bid = OrderBid.objects.create(
            order=posted_order, carrier=driver, vehicle=vehicle, price=145_000
        )
        resp = driver_client.post(f"{BASE}/{posted_order.id}/accept-bid/", {"bid_id": str(bid.id)})
        assert resp.status_code in (400, 403)


@pytest.mark.django_db
class TestDeliveryLifecycle:
    def test_driver_submits_proof_of_delivery(self, driver_client, accepted_order):
        resp = driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {
            "proof_note": "Delivered to the warehouse manager.",
            "proof_signature": "Mamadou Diallo",
        })
        assert resp.status_code == 200
        accepted_order.refresh_from_db()
        assert accepted_order.status == OrderStatus.DELIVERED

    def test_shipper_confirms_delivery(self, shipper_client, driver_client, accepted_order):
        # Driver submits proof first
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {
            "proof_note": "Done",
        })
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        assert resp.status_code == 200
        accepted_order.refresh_from_db()
        assert accepted_order.status == OrderStatus.COMPLETED

    def test_shipper_cannot_confirm_before_proof(self, shipper_client, accepted_order):
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        # Order is still in ASSIGNED state, not DELIVERED
        assert resp.status_code == 400

    def test_shipper_rates_driver(self, shipper_client, driver_client, accepted_order):
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        resp = shipper_client.post(f"{BASE}/{accepted_order.id}/rate/", {"rating": 5, "review": "Excellent!"})
        assert resp.status_code == 200

    def test_driver_rates_shipper(self, shipper_client, driver_client, accepted_order):
        driver_client.post(f"{BASE}/{accepted_order.id}/proof-of-delivery/", {"proof_note": "Done"})
        shipper_client.post(f"{BASE}/{accepted_order.id}/confirm-delivery/")
        resp = driver_client.post(f"{BASE}/{accepted_order.id}/rate/", {"rating": 4})
        assert resp.status_code == 200

    def test_rating_out_of_range_fails(self, shipper_client, driver_client, accepted_order):
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
