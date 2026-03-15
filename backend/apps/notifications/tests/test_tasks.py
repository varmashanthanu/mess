"""
Tests for notification tasks (in-app notification creation).
Celery tasks are called synchronously (CELERY_TASK_ALWAYS_EAGER).
"""
import pytest
from unittest.mock import patch

from apps.notifications.models import Notification
from apps.notifications.tasks import (
    notify_bid_accepted,
    notify_new_order_posted,
    notify_order_status_change,
    send_notification_task,
)


@pytest.mark.django_db
class TestSendNotificationTask:
    def test_creates_in_app_notification(self, shipper):
        send_notification_task(
            user_id=str(shipper.id),
            title="Test Notification",
            body="This is a test.",
            data={"type": "SYSTEM"},
        )
        notif = Notification.objects.get(user=shipper)
        assert notif.title == "Test Notification"
        assert notif.is_read is False

    def test_nonexistent_user_does_not_raise(self):
        # Should silently return, not raise
        send_notification_task(
            user_id="00000000-0000-0000-0000-000000000000",
            title="Ghost",
            body="Ghost message",
        )

    def test_no_fcm_sent_without_server_key(self, shipper, settings):
        settings.FCM_SERVER_KEY = ""
        with patch("apps.notifications.tasks.send_fcm_notification") as mock_fcm:
            send_notification_task(
                user_id=str(shipper.id),
                title="T",
                body="B",
            )
            mock_fcm.delay.assert_not_called()


@pytest.mark.django_db
class TestNotifyOrderStatusChange:
    def test_notifies_shipper_on_status_change(self, posted_order, shipper):
        notify_order_status_change(str(posted_order.id), "ASSIGNED")
        assert Notification.objects.filter(user=shipper).exists()

    def test_notifies_driver_when_assigned(self, accepted_order, driver):
        notify_order_status_change(str(accepted_order.id), "ASSIGNED")
        assert Notification.objects.filter(user=driver).exists()

    def test_nonexistent_order_id_does_not_raise(self):
        notify_order_status_change("00000000-0000-0000-0000-000000000000", "POSTED")


@pytest.mark.django_db
class TestNotifyNewOrderPosted:
    def test_notifies_available_drivers(self, posted_order, driver):
        driver.driver_profile.is_available = True
        driver.driver_profile.save(update_fields=["is_available"])
        notify_new_order_posted(str(posted_order.id))
        assert Notification.objects.filter(user=driver).exists()

    def test_does_not_notify_unavailable_drivers(self, posted_order, driver):
        driver.driver_profile.is_available = False
        driver.driver_profile.save(update_fields=["is_available"])
        notify_new_order_posted(str(posted_order.id))
        assert not Notification.objects.filter(user=driver).exists()

    def test_notification_content_contains_route(self, posted_order, driver):
        driver.driver_profile.is_available = True
        driver.driver_profile.save(update_fields=["is_available"])
        notify_new_order_posted(str(posted_order.id))
        notif = Notification.objects.filter(user=driver).first()
        assert "Dakar" in notif.body or "Thiès" in notif.body


@pytest.mark.django_db
class TestNotifyBidAccepted:
    def test_notifies_carrier(self, posted_order, driver, vehicle):
        from apps.orders.models import OrderBid
        bid = OrderBid.objects.create(
            order=posted_order,
            carrier=driver,
            vehicle=vehicle,
            price=145_000,
            status=OrderBid.BidStatus.ACCEPTED,
        )
        notify_bid_accepted(str(bid.id))
        notif = Notification.objects.filter(user=driver).first()
        assert notif is not None
        assert "accepted" in notif.title.lower() or "accepted" in notif.body.lower()

    def test_nonexistent_bid_does_not_raise(self):
        notify_bid_accepted("00000000-0000-0000-0000-000000000000")
