"""Payments Celery Tasks"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="apps.payments.tasks.expire_pending_payments")
def expire_pending_payments():
    """Mark payment transactions older than 1 hour as FAILED."""
    from .models import PaymentStatus, PaymentTransaction
    cutoff = timezone.now() - timezone.timedelta(hours=1)
    expired = PaymentTransaction.objects.filter(
        status=PaymentStatus.PENDING,
        initiated_at__lt=cutoff,
    )
    count = expired.count()
    expired.update(status=PaymentStatus.FAILED, failure_reason="Expired — no confirmation received.")
    logger.info(f"Expired {count} pending payment transactions.")
    return count


@shared_task(name="apps.payments.tasks.on_payment_completed")
def on_payment_completed(transaction_id: str):
    """Called when a payment is confirmed. Notifies relevant parties."""
    from .models import PaymentTransaction
    from apps.notifications.tasks import send_notification_task

    try:
        txn = PaymentTransaction.objects.select_related("order__shipper", "payee").get(id=transaction_id)
    except PaymentTransaction.DoesNotExist:
        return

    # Notify driver (payee)
    if txn.payee:
        send_notification_task.delay(
            user_id=str(txn.payee.id),
            title="Payment Received",
            body=f"You received {txn.net_amount} XOF for order {txn.order.reference}.",
            data={"type": "PAYMENT_RECEIVED", "transaction_id": transaction_id},
        )

    # Notify shipper
    send_notification_task.delay(
        user_id=str(txn.payer.id),
        title="Payment Confirmed",
        body=f"Your payment of {txn.amount} XOF for order {txn.order.reference} was successful.",
        data={"type": "PAYMENT_CONFIRMED", "transaction_id": transaction_id},
    )
