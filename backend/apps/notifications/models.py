"""
MESS Platform — Notifications Models
In-app notifications + delivery preferences.
"""
from django.db import models

from core.models import BaseModel


class NotificationType(models.TextChoices):
    ORDER_POSTED = "ORDER_POSTED", "New Order Posted"
    ORDER_BID = "ORDER_BID", "New Bid Received"
    BID_ACCEPTED = "BID_ACCEPTED", "Bid Accepted"
    BID_REJECTED = "BID_REJECTED", "Bid Rejected"
    ORDER_ASSIGNED = "ORDER_ASSIGNED", "Order Assigned"
    ORDER_PICKED_UP = "ORDER_PICKED_UP", "Cargo Picked Up"
    ORDER_IN_TRANSIT = "ORDER_IN_TRANSIT", "In Transit"
    ORDER_DELIVERED = "ORDER_DELIVERED", "Delivered"
    ORDER_COMPLETED = "ORDER_COMPLETED", "Order Completed"
    ORDER_CANCELLED = "ORDER_CANCELLED", "Order Cancelled"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED", "Payment Received"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED", "Payment Confirmed"
    NEW_MESSAGE = "NEW_MESSAGE", "New Message"
    SYSTEM = "SYSTEM", "System Notification"


class Notification(BaseModel):
    """An in-app notification for a user."""
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)  # Extra payload for deep links
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} → {self.user}"


class NotificationPreference(BaseModel):
    """Per-user notification channel preferences."""
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="notification_preferences"
    )
    push_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=False)
    # Granular control
    order_updates = models.BooleanField(default=True)
    payment_updates = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification preferences for {self.user}"
