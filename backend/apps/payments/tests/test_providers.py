"""
Tests for payment providers: Wave, Orange Money, and the webhook flow.
Uses httpx mocking to avoid real network calls.
"""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.payments.providers.wave import WaveProvider
from apps.payments.providers.orange_money import OrangeMoneyProvider
from apps.payments.providers.base import PaymentRequest


def make_request(**kwargs):
    return PaymentRequest(
        amount=Decimal("150000"),
        currency="XOF",
        payer_phone="+221771234567",
        reference="MESS-TEST01",
        description="Test freight order",
        callback_url="https://example.com/webhook/wave/",
        **kwargs,
    )


class TestWaveProvider:
    def test_mock_response_when_no_api_key(self, settings):
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_WEBHOOK_SECRET = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        provider = WaveProvider()
        result = provider.initiate_payment(make_request())

        assert result.success is True
        assert result.provider_reference.startswith("WAVE_MOCK_")

    @patch("apps.payments.providers.wave.httpx.Client")
    def test_successful_payment_initiation(self, mock_client_cls, settings):
        settings.WAVE_API_KEY = "test-key"
        settings.WAVE_MERCHANT_ID = "merchant-001"
        settings.WAVE_WEBHOOK_SECRET = "secret"
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "session-abc",
            "wave_launch_url": "https://pay.wave.com/abc",
        }
        mock_response.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.post.return_value = mock_response
        mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client)

        provider = WaveProvider()
        provider._client = mock_client

        result = provider.initiate_payment(make_request())
        assert result.success is True
        assert result.provider_reference == "session-abc"
        assert "wave.com" in result.redirect_url

    def test_status_mapping(self):
        provider = WaveProvider()
        assert provider._map_status("succeeded") == "COMPLETED"
        assert provider._map_status("pending") == "PENDING"
        assert provider._map_status("failed") == "FAILED"
        assert provider._map_status("cancelled") == "CANCELLED"
        assert provider._map_status("unknown") == "PENDING"

    def test_webhook_verification_with_correct_signature(self, settings):
        settings.WAVE_WEBHOOK_SECRET = "mysecret"
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        provider = WaveProvider()
        payload = b'{"id":"session-abc","payment_status":"succeeded"}'
        sig = hmac.new(b"mysecret", payload, hashlib.sha256).hexdigest()
        assert provider.verify_webhook(payload, {"wave-signature": sig})

    def test_webhook_verification_fails_wrong_signature(self, settings):
        settings.WAVE_WEBHOOK_SECRET = "mysecret"
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        provider = WaveProvider()
        payload = b'{"id":"session-abc","payment_status":"succeeded"}'
        assert not provider.verify_webhook(payload, {"wave-signature": "badsig"})

    def test_parse_webhook(self, settings):
        settings.WAVE_WEBHOOK_SECRET = ""
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        provider = WaveProvider()
        payload = json.dumps({
            "id": "session-xyz",
            "payment_status": "succeeded",
            "amount": "150000",
            "client_reference": "MESS-TEST01",
        }).encode()

        result = provider.parse_webhook(payload)
        assert result["provider_reference"] == "session-xyz"
        assert result["status"] == "COMPLETED"
        assert result["client_reference"] == "MESS-TEST01"


@pytest.mark.django_db
class TestPaymentWebhookEndpoint:
    def test_wave_webhook_updates_transaction(self, shipper_client, posted_order, shipper, settings):
        settings.WAVE_WEBHOOK_SECRET = ""
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        from apps.payments.models import PaymentStatus, PaymentTransaction
        txn = PaymentTransaction.objects.create(
            order=posted_order,
            payer=shipper,
            amount=150_000,
            provider="WAVE",
            provider_reference="session-test-ref",
            status=PaymentStatus.PENDING,
            payer_phone="+221771234567",
        )

        payload = json.dumps({
            "id": "session-test-ref",
            "payment_status": "succeeded",
            "amount": "150000",
            "client_reference": posted_order.reference,
        }).encode()

        resp = shipper_client.post(
            "/api/v1/payments/webhook/wave/",
            data=payload,
            content_type="application/json",
        )
        assert resp.status_code == 200

        txn.refresh_from_db()
        assert txn.status == PaymentStatus.COMPLETED
        assert txn.completed_at is not None

    def test_unknown_provider_returns_400(self, api_client):
        resp = api_client.post("/api/v1/payments/webhook/bitcoin/", data={}, content_type="application/json")
        assert resp.status_code == 400

    def test_unknown_transaction_reference_still_returns_200(self, api_client, settings):
        settings.WAVE_WEBHOOK_SECRET = ""
        settings.WAVE_API_KEY = ""
        settings.WAVE_MERCHANT_ID = ""
        settings.WAVE_BASE_URL = "https://api.wave.com/v1"

        payload = json.dumps({
            "id": "nonexistent-ref",
            "payment_status": "succeeded",
        }).encode()
        resp = api_client.post(
            "/api/v1/payments/webhook/wave/",
            data=payload,
            content_type="application/json",
        )
        assert resp.status_code == 200
