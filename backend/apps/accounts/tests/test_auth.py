"""
Tests for accounts: registration, OTP verification, login, logout.
"""
import pytest
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta


@pytest.mark.django_db
class TestRegistration:
    url = "/api/v1/auth/register/"

    def _payload(self, **overrides):
        return {
            "phone_number": "+221771111111",
            "first_name": "Test",
            "last_name": "User",
            "role": "SHIPPER",
            "password": "securepass1",
            "password_confirm": "securepass1",
            **overrides,
        }

    def test_shipper_registration_succeeds(self, api_client):
        resp = api_client.post(self.url, self._payload())
        assert resp.status_code == 201
        data = resp.json()
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["role"] == "SHIPPER"

    def test_driver_registration_creates_driver_profile(self, api_client):
        resp = api_client.post(self.url, self._payload(role="DRIVER"))
        assert resp.status_code == 201
        from apps.accounts.models import DriverProfile, User
        user = User.objects.get(phone_number="+221771111111")
        assert DriverProfile.objects.filter(user=user).exists()

    def test_password_mismatch_fails(self, api_client):
        resp = api_client.post(self.url, self._payload(password_confirm="wrong"))
        assert resp.status_code == 400

    def test_admin_self_registration_forbidden(self, api_client):
        resp = api_client.post(self.url, self._payload(role="ADMIN"))
        assert resp.status_code == 400

    def test_duplicate_phone_fails(self, api_client, shipper):
        resp = api_client.post(self.url, self._payload(phone_number=str(shipper.phone_number)))
        assert resp.status_code == 400

    def test_short_password_fails(self, api_client):
        resp = api_client.post(self.url, self._payload(password="short", password_confirm="short"))
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLogin:
    url = "/api/v1/auth/login/"

    def test_valid_credentials_return_tokens(self, api_client, shipper):
        resp = api_client.post(self.url, {
            "phone_number": str(shipper.phone_number),
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access" in data
        assert "refresh" in data

    def test_wrong_password_fails(self, api_client, shipper):
        resp = api_client.post(self.url, {
            "phone_number": str(shipper.phone_number),
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_unknown_phone_fails(self, api_client):
        resp = api_client.post(self.url, {
            "phone_number": "+221799999999",
            "password": "anything",
        })
        assert resp.status_code == 401


@pytest.mark.django_db
class TestOTPVerification:
    request_url = "/api/v1/auth/otp/request/"
    verify_url = "/api/v1/auth/otp/verify/"

    def test_request_otp_creates_verification_record(self, shipper_client, shipper):
        from apps.accounts.models import PhoneVerification
        resp = shipper_client.post(self.request_url, {"phone_number": str(shipper.phone_number)})
        assert resp.status_code == 200
        assert PhoneVerification.objects.filter(user=shipper).exists()

    def test_verify_correct_otp_marks_user_verified(self, shipper_client, shipper):
        from apps.accounts.models import PhoneVerification
        verification = PhoneVerification.objects.create(
            user=shipper,
            otp="123456",
            phone_number=shipper.phone_number,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        resp = shipper_client.post(self.verify_url, {
            "phone_number": str(shipper.phone_number),
            "otp": "123456",
        })
        assert resp.status_code == 200
        shipper.refresh_from_db()
        assert shipper.is_verified

    def test_verify_wrong_otp_fails(self, shipper_client, shipper):
        from apps.accounts.models import PhoneVerification
        PhoneVerification.objects.create(
            user=shipper,
            otp="123456",
            phone_number=shipper.phone_number,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        resp = shipper_client.post(self.verify_url, {
            "phone_number": str(shipper.phone_number),
            "otp": "000000",
        })
        assert resp.status_code == 400

    def test_verify_expired_otp_fails(self, shipper_client, shipper):
        from apps.accounts.models import PhoneVerification
        PhoneVerification.objects.create(
            user=shipper,
            otp="123456",
            phone_number=shipper.phone_number,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        resp = shipper_client.post(self.verify_url, {
            "phone_number": str(shipper.phone_number),
            "otp": "123456",
        })
        assert resp.status_code == 400

    def test_verify_used_otp_fails(self, shipper_client, shipper):
        from apps.accounts.models import PhoneVerification
        PhoneVerification.objects.create(
            user=shipper,
            otp="123456",
            phone_number=shipper.phone_number,
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=True,
        )
        resp = shipper_client.post(self.verify_url, {
            "phone_number": str(shipper.phone_number),
            "otp": "123456",
        })
        assert resp.status_code == 400


@pytest.mark.django_db
class TestMeEndpoint:
    url = "/api/v1/accounts/me/"

    def test_authenticated_user_gets_profile(self, shipper_client, shipper):
        resp = shipper_client.get(self.url)
        assert resp.status_code == 200
        assert resp.json()["role"] == "SHIPPER"

    def test_unauthenticated_request_fails(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 401

    def test_update_first_name(self, shipper_client, shipper):
        resp = shipper_client.patch(self.url, {"first_name": "Modou"})
        assert resp.status_code == 200
        shipper.refresh_from_db()
        assert shipper.first_name == "Modou"


@pytest.mark.django_db
class TestDriverAvailability:
    url = "/api/v1/accounts/me/availability/"

    def test_driver_can_toggle_availability(self, driver_client, driver):
        resp = driver_client.patch(self.url, {"is_available": False})
        assert resp.status_code == 200
        driver.driver_profile.refresh_from_db()
        assert driver.driver_profile.is_available is False

    def test_shipper_cannot_set_availability(self, shipper_client):
        resp = shipper_client.patch(self.url, {"is_available": True})
        assert resp.status_code == 403
