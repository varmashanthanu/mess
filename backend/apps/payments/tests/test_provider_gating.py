"""
Outside development, a payment method without real credentials must not be
usable: it would hand out fake successes and accept unsigned webhooks, letting
anyone mark an order as paid. Also checks that each retry gets its own
provider reference (PayTech rejects a reference it has already seen).
"""
import json
from unittest.mock import MagicMock, patch

import pytest

from apps.orders.models import OrderStatus
from apps.payments.models import PaymentStatus, PaymentTransaction, PaytechConfig

INITIATE_URL = "/api/v1/payments/initiate/"


@pytest.fixture(autouse=True)
def no_providers_configured(settings):
    settings.WAVE_API_KEY = ""
    settings.WAVE_MERCHANT_ID = ""
    settings.WAVE_WEBHOOK_SECRET = ""
    settings.WAVE_BASE_URL = "https://api.wave.com/v1"
    settings.ORANGE_MONEY_API_KEY = ""
    settings.FREE_MONEY_API_KEY = ""


@pytest.fixture
def production_mode(settings):
    settings.PAYMENTS_ALLOW_MOCK_PROVIDERS = False


@pytest.fixture(autouse=True)
def no_celery():
    with patch("apps.payments.tasks.on_payment_completed.delay") as delay:
        yield delay


@pytest.fixture
def delivered_order(accepted_order):
    accepted_order.transition_to(OrderStatus.IN_TRANSIT)
    accepted_order.transition_to(OrderStatus.DELIVERED)
    return accepted_order


@pytest.fixture
def paytech_configured(db):
    config = PaytechConfig.get_instance()
    config.is_enabled = True
    config.test_api_key = "test-key"
    config.test_api_secret = "test-secret"
    config.save()
    return config


def initiate(client, order, provider):
    return client.post(
        INITIATE_URL,
        {"order_id": str(order.id), "provider": provider, "payer_phone": "+221771234567"},
        format="json",
    )


def paytech_ok(token):
    resp = MagicMock()
    resp.json.return_value = {"success": 1, "token": token, "redirect_url": f"https://paytech.sn/payment/checkout/{token}"}
    resp.raise_for_status = MagicMock()
    return resp


@pytest.mark.django_db
@pytest.mark.usefixtures("production_mode")
class TestUnconfiguredProvidersRefusedInProduction:
    @pytest.mark.parametrize("provider", ["WAVE", "ORANGE_MONEY", "FREE_MONEY", "CASH"])
    def test_initiate_refused(self, shipper_client, delivered_order, provider):
        resp = initiate(shipper_client, delivered_order, provider)
        assert 400 <= resp.status_code < 500
        assert delivered_order.payments.count() == 0

    def test_paytech_disabled_is_refused(self, shipper_client, delivered_order, paytech_configured):
        paytech_configured.is_enabled = False
        paytech_configured.save()
        resp = initiate(shipper_client, delivered_order, "PAYTECH")
        assert 400 <= resp.status_code < 500

    def test_forged_webhook_cannot_mark_order_paid(self, api_client, shipper, delivered_order, no_celery):
        """The exact attack: a pending Wave transaction + a self-made 'succeeded' webhook."""
        txn = PaymentTransaction.objects.create(
            order=delivered_order, payer=shipper, amount=150_000, provider="WAVE",
            provider_reference="WAVE_MOCK_x", status=PaymentStatus.PENDING,
        )
        payload = json.dumps({"id": "WAVE_MOCK_x", "payment_status": "succeeded"}).encode()
        resp = api_client.post("/api/v1/payments/webhook/wave/", data=payload, content_type="application/json")

        assert resp.status_code == 400
        txn.refresh_from_db()
        delivered_order.refresh_from_db()
        assert txn.status == PaymentStatus.PENDING
        assert delivered_order.status == OrderStatus.DELIVERED
        no_celery.assert_not_called()

    @patch("apps.payments.providers.paytech.httpx.post")
    def test_configured_paytech_still_works(self, mock_post, shipper_client, delivered_order, paytech_configured):
        mock_post.return_value = paytech_ok("tok-1")
        resp = initiate(shipper_client, delivered_order, "PAYTECH")
        assert resp.status_code == 201
        assert resp.json()["redirect_url"].startswith("https://paytech.sn/")


@pytest.mark.django_db
class TestWebhookProviderMustMatchTransaction:
    def test_webhook_from_other_provider_is_ignored(self, api_client, shipper, delivered_order, no_celery):
        txn = PaymentTransaction.objects.create(
            order=delivered_order, payer=shipper, amount=150_000, provider="PAYTECH",
            provider_reference="tok-abc", status=PaymentStatus.PENDING,
        )
        payload = json.dumps({"id": "tok-abc", "payment_status": "succeeded"}).encode()
        resp = api_client.post("/api/v1/payments/webhook/wave/", data=payload, content_type="application/json")
        assert resp.status_code == 400
        txn.refresh_from_db()
        assert txn.status == PaymentStatus.PENDING
        no_celery.assert_not_called()


@pytest.mark.django_db
@pytest.mark.usefixtures("production_mode")
class TestRetryUsesNewReference:
    @patch("apps.payments.providers.paytech.httpx.post")
    def test_each_attempt_sends_a_new_ref_command(self, mock_post, shipper_client, delivered_order, paytech_configured):
        mock_post.side_effect = [paytech_ok("tok-1"), paytech_ok("tok-2"), paytech_ok("tok-3")]

        for _ in range(3):  # checkout abandoned twice, then retried
            assert initiate(shipper_client, delivered_order, "PAYTECH").status_code == 201

        refs = [c.kwargs["json"]["ref_command"] for c in mock_post.call_args_list]
        ref = delivered_order.reference
        assert refs == [ref, f"{ref}-2", f"{ref}-3"]
