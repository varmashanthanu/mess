"""Orders Celery Tasks"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="apps.orders.tasks.cancel_stale_orders")
def cancel_stale_orders():
    """Auto-cancel POSTED orders with no bids after 24 hours."""
    from .models import FreightOrder, OrderStatus
    cutoff = timezone.now() - timezone.timedelta(hours=24)
    stale = FreightOrder.objects.filter(
        status=OrderStatus.POSTED,
        created_at__lt=cutoff,
    )
    count = stale.count()
    stale.update(
        status=OrderStatus.CANCELLED,
        cancellation_reason="Auto-cancelled: no carrier found within 24 hours.",
    )
    logger.info(f"Auto-cancelled {count} stale orders.")
    return count
