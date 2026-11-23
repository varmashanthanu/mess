"""
A freight order must never be charged twice: initiation is refused once a
payment succeeded, and the webhook neither re-processes a settled transaction
nor silently accepts a second successful payment for the same order.
"""
import json
from unittest.mock import patch

import pytest

from apps.orders.models import OrderStatus
from apps.payments.models import PaymentStatus, PaymentTransaction

INITIATE_URL = "/api/v1/payments/initiate/"
WEBHOOK_URL = "/api/v1/payments/webhook/wave/"


@pytest.fixture(autouse=True)
def wave_mock_mode(settings):
    # No API key → WaveProvider returns a mock success without network calls.
    settings.WAVE_API_KEY = ""
    settings.WAVE_MERCHANT_ID = ""
    settings.WAVE_WEBHOOK_SECRET = ""
    settings.WAVE_BASE_URL = "https://api.wave.com/v1"


@pytest.fixture(autouse=True)
def no_celery():
    with patch("apps.payments.tasks.on_payment_completed.delay") as delay:
        yield delay


@pytest.fixture
def delivered_order(accepted_order):
    accepted_order.transition_to(OrderStatus.IN_TRANSIT)
    accepted_order.transition_to(OrderStatus.DELIVERED)
    return accepted_order


def make_txn(order, shipper, ref, status=PaymentStatus.PENDING):
    return PaymentTransaction.objects.create(
        order=order, payer=shipper, amount=150_000, provider="WAVE",
        provider_reference=ref, status=status, payer_phone="+221771234567",
    )


def initiate(client, order):
    return client.post(
        INITIATE_URL,
        {"order_id": str(order.id), "provider": "WAVE", "payer_phone": "+221771234567"},
        format="json",
    )


def send_webhook(client, ref, payment_status="succeeded"):
    payload = json.dumps({"id": ref, "payment_status": payment_status}).encode()
    return client.post(WEBHOOK_URL, data=payload, content_type="application/json")


@pytest.mark.django_db
class TestInitiateRefusesDoublePayment:
    def test_first_payment_is_allowed(self, shipper_client, delivered_order):
        resp = initiate(shipper_client, delivered_order)
        assert resp.status_code == 201
        assert delivered_order.payments.count() == 1

    def test_refused_when_already_paid(self, shipper_client, shipper, delivered_order):
        make_txn(delivered_order, shipper, "paid-ref", PaymentStatus.COMPLETED)
        resp = initiate(shipper_client, delivered_order)
        assert resp.status_code >= 400
        assert delivered_order.payments.count() == 1

    def test_refused_on_completed_order_already_paid(self, shipper_client, shipper, delivered_order):
        make_txn(delivered_order, shipper, "paid-ref", PaymentStatus.COMPLETED)
        delivered_order.transition_to(OrderStatus.COMPLETED)
        resp = initiate(shipper_client, delivered_order)
        assert resp.status_code >= 400
        assert delivered_order.payments.count() == 1

    def test_refused_while_processing(self, shipper_client, shipper, delivered_order):
        make_txn(delivered_order, shipper, "proc-ref", PaymentStatus.PROCESSING)
        resp = initiate(shipper_client, delivered_order)
        assert resp.status_code >= 400

    def test_retry_allowed_after_abandoned_or_failed_checkout(self, shipper_client, shipper, delivered_order):
        make_txn(delivered_order, shipper, "abandoned-ref", PaymentStatus.PENDING)
        make_txn(delivered_order, shipper, "failed-ref", PaymentStatus.FAILED)
        resp = initiate(shipper_client, delivered_order)
        assert resp.status_code == 201


@pytest.mark.django_db
class TestWebhookIdempotency:
    def test_replayed_webhook_is_processed_once(self, api_client, shipper, delivered_order, no_celery):
        txn = make_txn(delivered_order, shipper, "ref-1")
        assert send_webhook(api_client, "ref-1").status_code == 200
        assert send_webhook(api_client, "ref-1").status_code == 200
        txn.refresh_from_db()
        assert txn.status == PaymentStatus.COMPLETED
        assert no_celery.call_count == 1

    def test_late_pending_event_does_not_downgrade_completed(self, api_client, shipper, delivered_order):
        txn = make_txn(delivered_order, shipper, "ref-1", PaymentStatus.COMPLETED)
        send_webhook(api_client, "ref-1", payment_status="pending")
        txn.refresh_from_db()
        assert txn.status == PaymentStatus.COMPLETED

    def test_second_successful_payment_is_flagged_for_refund(self, api_client, shipper, delivered_order, no_celery):
        first = make_txn(delivered_order, shipper, "ref-1")
        second = make_txn(delivered_order, shipper, "ref-2")

        send_webhook(api_client, "ref-1")
        send_webhook(api_client, "ref-2")

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.status == PaymentStatus.COMPLETED
        assert "duplicate_payment" not in first.provider_metadata
        assert second.status == PaymentStatus.COMPLETED
        assert second.provider_metadata.get("duplicate_payment") is True
        assert "refund" in second.failure_reason
        # Order completion / notifications only fire for the first payment.
        assert no_celery.call_count == 1
