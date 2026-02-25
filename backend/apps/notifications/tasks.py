"""
MESS Platform — Notifications Celery Tasks
Handles push (FCM), SMS, and in-app notification delivery.
"""
import logging

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(name="apps.notifications.tasks.send_sms_task", max_retries=3, default_retry_delay=30)
def send_sms_task(phone: str, message: str):
    """Send an SMS via configured provider."""
    provider = settings.SMS_PROVIDER
    api_key = settings.SMS_API_KEY

    if not api_key:
        logger.info(f"[SMS MOCK] To: {phone} | Msg: {message}")
        return {"mock": True}

    if provider == "infobip":
        return _send_via_infobip(phone, message, api_key)
    elif provider == "twilio":
        return _send_via_twilio(phone, message, api_key)
    else:
        logger.warning(f"Unknown SMS provider: {provider}")
        return {"error": "Unknown provider"}


def _send_via_infobip(phone: str, message: str, api_key: str):
    import httpx
    try:
        resp = httpx.post(
            "https://api.infobip.com/sms/2/text/advanced",
            headers={"Authorization": f"App {api_key}", "Content-Type": "application/json"},
            json={
                "messages": [{
                    "from": settings.SMS_SENDER_ID,
                    "destinations": [{"to": phone}],
                    "text": message,
                }]
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Infobip SMS failed: {e}")
        raise


def _send_via_twilio(phone: str, message: str, api_key: str):
    # api_key format: "ACCOUNT_SID:AUTH_TOKEN:FROM_NUMBER"
    try:
        parts = api_key.split(":")
        account_sid, auth_token, from_number = parts[0], parts[1], parts[2]
        import httpx
        resp = httpx.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
            auth=(account_sid, auth_token),
            data={"From": from_number, "To": phone, "Body": message},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Twilio SMS failed: {e}")
        raise


@shared_task(name="apps.notifications.tasks.send_notification_task")
def send_notification_task(user_id: str, title: str, body: str, data: dict = None):
    """
    Create an in-app notification and optionally send push (FCM) + SMS.
    """
    from django.contrib.auth import get_user_model
    from .models import Notification, NotificationPreference

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    # Create in-app notification
    notification_type = (data or {}).get("type", "SYSTEM")
    Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        body=body,
        data=data or {},
    )

    # Check preferences
    try:
        prefs = user.notification_preferences
    except NotificationPreference.DoesNotExist:
        prefs = None

    # Send push notification via FCM
    if user.fcm_token and settings.FCM_SERVER_KEY:
        if not prefs or prefs.push_enabled:
            send_fcm_notification.delay(
                fcm_token=user.fcm_token,
                title=title,
                body=body,
                data=data,
            )


@shared_task(name="apps.notifications.tasks.send_fcm_notification")
def send_fcm_notification(fcm_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Firebase Cloud Messaging."""
    import httpx
    if not settings.FCM_SERVER_KEY:
        logger.info(f"[FCM MOCK] To: {fcm_token[:20]}... | {title}")
        return

    try:
        resp = httpx.post(
            "https://fcm.googleapis.com/fcm/send",
            headers={"Authorization": f"key={settings.FCM_SERVER_KEY}"},
            json={
                "to": fcm_token,
                "notification": {"title": title, "body": body},
                "data": data or {},
                "priority": "high",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        result = resp.json()
        if result.get("failure"):
            logger.warning(f"FCM delivery failed: {result}")
        return result
    except Exception as e:
        logger.error(f"FCM push failed: {e}")


@shared_task(name="apps.notifications.tasks.notify_order_status_change")
def notify_order_status_change(order_id: str, new_status: str):
    """Notify relevant parties when an order's status changes."""
    from apps.orders.models import FreightOrder
    try:
        order = FreightOrder.objects.select_related(
            "shipper", "broker"
        ).prefetch_related("assignment").get(id=order_id)
    except FreightOrder.DoesNotExist:
        return

    messages = {
        "POSTED": ("Order Posted", f"Your order {order.reference} is now live and waiting for carriers."),
        "ASSIGNED": ("Driver Assigned", f"A driver has been assigned to your order {order.reference}."),
        "PICKED_UP": ("Cargo Picked Up", f"Your cargo for order {order.reference} has been picked up."),
        "IN_TRANSIT": ("Order In Transit", f"Order {order.reference} is on its way."),
        "DELIVERED": ("Order Delivered", f"Order {order.reference} has been delivered. Please confirm."),
        "COMPLETED": ("Order Completed", f"Order {order.reference} is complete."),
        "CANCELLED": ("Order Cancelled", f"Order {order.reference} has been cancelled."),
    }

    title, body = messages.get(new_status, ("Order Update", f"Order {order.reference} status changed."))

    # Notify shipper
    send_notification_task.delay(
        str(order.shipper.id), title, body, {"type": f"ORDER_{new_status}", "order_id": order_id}
    )

    # Notify driver if assigned
    if hasattr(order, "assignment"):
        driver_msg = {
            "ASSIGNED": ("New Job Assigned", f"You've been assigned to order {order.reference}."),
            "CANCELLED": ("Order Cancelled", f"Order {order.reference} has been cancelled."),
        }.get(new_status, (title, body))
        send_notification_task.delay(
            str(order.assignment.driver.id), *driver_msg,
            {"type": f"ORDER_{new_status}", "order_id": order_id}
        )


@shared_task(name="apps.notifications.tasks.notify_new_order_posted")
def notify_new_order_posted(order_id: str):
    """Notify all available nearby drivers about a new posted order."""
    from apps.orders.models import FreightOrder
    from apps.accounts.models import DriverProfile
    try:
        order = FreightOrder.objects.get(id=order_id)
    except FreightOrder.DoesNotExist:
        return

    available_drivers = DriverProfile.objects.filter(
        is_available=True,
        user__is_active=True,
    ).select_related("user")

    for profile in available_drivers[:50]:  # Cap to avoid overwhelming
        send_notification_task.delay(
            str(profile.user.id),
            "New Freight Order Available",
            f"{order.pickup_city} → {order.delivery_city} | {order.weight_kg}kg",
            {"type": "ORDER_POSTED", "order_id": order_id},
        )


@shared_task(name="apps.notifications.tasks.notify_bid_accepted")
def notify_bid_accepted(bid_id: str):
    """Notify the winning carrier that their bid was accepted."""
    from apps.orders.models import OrderBid
    try:
        bid = OrderBid.objects.select_related("carrier", "order").get(id=bid_id)
    except OrderBid.DoesNotExist:
        return
    send_notification_task.delay(
        str(bid.carrier.id),
        "Bid Accepted!",
        f"Your bid of {bid.price} XOF for order {bid.order.reference} was accepted. Head to pickup.",
        {"type": "BID_ACCEPTED", "order_id": str(bid.order.id)},
    )


@shared_task(name="apps.notifications.tasks.send_admin_daily_summary")
def send_admin_daily_summary():
    """Send daily ops summary to admin users."""
    from django.contrib.auth import get_user_model
    from apps.orders.models import FreightOrder, OrderStatus
    from apps.payments.models import PaymentTransaction, PaymentStatus
    from django.utils import timezone

    today = timezone.now().date()
    User = get_user_model()

    orders_today = FreightOrder.objects.filter(created_at__date=today).count()
    completed_today = FreightOrder.objects.filter(
        status=OrderStatus.COMPLETED, updated_at__date=today
    ).count()
    payments_today = PaymentTransaction.objects.filter(
        status=PaymentStatus.COMPLETED, completed_at__date=today
    ).count()

    admins = User.objects.filter(role="ADMIN", is_active=True)
    for admin in admins:
        send_notification_task.delay(
            str(admin.id),
            f"Daily Summary — {today}",
            f"Orders created: {orders_today} | Completed: {completed_today} | Payments: {payments_today}",
            {"type": "SYSTEM"},
        )
