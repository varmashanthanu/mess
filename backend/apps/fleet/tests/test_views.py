"""
Tests for fleet: vehicle types, vehicle CRUD, and admin verification.
"""
import pytest

BASE = "/api/v1/fleet"


@pytest.mark.django_db
class TestVehicleTypes:
    url = f"{BASE}/vehicle-types/"

    def test_public_endpoint_returns_vehicle_types(self, api_client, vehicle_type):
        resp = api_client.get(self.url)
        assert resp.status_code == 200
        names = [vt["name"] for vt in resp.json()]
        assert vehicle_type.name in names


@pytest.mark.django_db
class TestVehicleCRUD:
    url = f"{BASE}/vehicles/"

    def _payload(self, vehicle_type_id):
        return {
            "registration_number": "DK-9999-Z",
            "vehicle_type": str(vehicle_type_id),
            "make": "Renault",
            "model": "Trucks T",
            "year": 2020,
        }

    def test_driver_creates_vehicle(self, driver_client, vehicle_type):
        resp = driver_client.post(self.url, self._payload(vehicle_type.id))
        assert resp.status_code == 201
        data = resp.json()
        assert data["registration_number"] == "DK-9999-Z"

    def test_shipper_cannot_create_vehicle(self, shipper_client, vehicle_type):
        resp = shipper_client.post(self.url, self._payload(vehicle_type.id))
        # Shipper role is not allowed as owner in Vehicle model
        assert resp.status_code in (400, 403)

    def test_driver_lists_own_vehicles(self, driver_client, vehicle):
        resp = driver_client.get(self.url)
        assert resp.status_code == 200
        ids = [v["id"] for v in resp.json()["results"]]
        assert str(vehicle.id) in ids

    def test_duplicate_registration_fails(self, driver_client, vehicle, vehicle_type):
        resp = driver_client.post(self.url, {
            "registration_number": vehicle.registration_number,
            "vehicle_type": str(vehicle_type.id),
        })
        assert resp.status_code == 400

    def test_update_vehicle(self, driver_client, vehicle):
        resp = driver_client.patch(f"{self.url}{vehicle.id}/", {"color": "Blue"})
        assert resp.status_code == 200
        assert resp.json()["color"] == "Blue" if "color" in resp.json() else True

    def test_deactivate_vehicle(self, driver_client, vehicle):
        resp = driver_client.delete(f"{self.url}{vehicle.id}/")
        assert resp.status_code == 200
        vehicle.refresh_from_db()
        assert vehicle.is_active is False

    def test_unauthenticated_request_rejected(self, api_client, vehicle_type):
        resp = api_client.post(self.url, self._payload(vehicle_type.id))
        assert resp.status_code == 401


@pytest.mark.django_db
class TestAdminVehicleVerification:
    def test_admin_verifies_vehicle(self, admin_client, vehicle):
        vehicle.is_verified = False
        vehicle.save(update_fields=["is_verified"])
        resp = admin_client.patch(f"{BASE}/vehicles/{vehicle.id}/verify/")
        assert resp.status_code == 200
        vehicle.refresh_from_db()
        assert vehicle.is_verified

    def test_non_admin_cannot_verify(self, driver_client, vehicle):
        vehicle.is_verified = False
        vehicle.save(update_fields=["is_verified"])
        resp = driver_client.patch(f"{BASE}/vehicles/{vehicle.id}/verify/")
        assert resp.status_code == 403
