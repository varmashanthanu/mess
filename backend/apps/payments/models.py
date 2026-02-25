"""
MESS Platform — Payments Models
XOF transactions via Wave, Orange Money, Free Money, or Cash.
"""
from django.db import models

from core.models import BaseModel


class PaymentProvider(models.TextChoices):
    WAVE = "WAVE", "Wave"
    ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"
    FREE_MONEY = "FREE_MONEY", "Free Money (Expresso)"
    CASH = "CASH", "Cash on Delivery"


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"
    REFUNDED = "REFUNDED", "Refunded"
    CANCELLED = "CANCELLED", "Cancelled"


class PaymentTransaction(BaseModel):
    """A payment event linked to a freight order."""

    order = models.ForeignKey(
        "orders.FreightOrder", on_delete=models.PROTECT, related_name="payments"
    )
    payer = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="payments_made"
    )
    payee = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="payments_received",
        null=True, blank=True
    )

    # Amount in XOF (West African CFA Franc)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    provider = models.CharField(max_length=20, choices=PaymentProvider.choices)
    provider_reference = models.CharField(
        max_length=255, blank=True, null=True, db_index=True,
        help_text="External transaction ID from the payment provider"
    )
    provider_metadata = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=15, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )
    failure_reason = models.TextField(blank=True)

    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Payer's mobile number used for the transaction
    payer_phone = models.CharField(max_length=20, blank=True)

    class Meta:
        verbose_name = "Payment Transaction"
        ordering = ["-initiated_at"]
        indexes = [
            models.Index(fields=["order", "status"]),
            models.Index(fields=["payer", "status"]),
        ]

    def __str__(self):
        return f"{self.get_provider_display()} — {self.amount} XOF [{self.status}]"

    @property
    def net_amount(self):
        """Amount after deducting platform fee."""
        return self.amount - self.platform_fee
