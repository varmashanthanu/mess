"""
MESS Platform — Accounts Signals
Auto-create conversation when an order is assigned.
Auto-create notification preferences when a user is created.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="accounts.User")
def create_notification_preferences(sender, instance, created, **kwargs):
    if created:
        from apps.notifications.models import NotificationPreference
        NotificationPreference.objects.get_or_create(user=instance)


@receiver(post_save, sender="orders.OrderAssignment")
def create_order_conversation(sender, instance, created, **kwargs):
    """Create a conversation thread when an order is assigned."""
    if created:
        from apps.messaging.models import Conversation
        order = instance.order
        conv, _ = Conversation.objects.get_or_create(order=order)
        conv.participants.add(order.shipper, instance.driver)
        if order.broker:
            conv.participants.add(order.broker)
