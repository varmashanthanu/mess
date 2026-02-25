"""
MESS Platform — Base Payment Provider
All payment providers implement this interface.
Switching providers = swap the implementation, never the caller.
"""
import abc
import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class PaymentRequest:
    amount: Decimal
    currency: str
    payer_phone: str
    reference: str               # Internal order reference
    description: str
    callback_url: str            # Webhook URL for async confirmation
    return_url: Optional[str] = None  # Redirect URL (if checkout page used)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PaymentResponse:
    success: bool
    provider_reference: Optional[str] = None
    redirect_url: Optional[str] = None   # For providers with a payment page
    status: str = "PENDING"
    raw_response: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None


@dataclass
class PaymentStatusResponse:
    provider_reference: str
    status: str          # PENDING | COMPLETED | FAILED | REFUNDED
    amount: Optional[Decimal] = None
    completed_at: Optional[str] = None
    raw_response: Dict[str, Any] = field(default_factory=dict)


class BasePaymentProvider(abc.ABC):
    """Abstract payment provider — all providers must implement these methods."""

    name: str = "base"

    @abc.abstractmethod
    def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        """
        Start a payment. Returns a PaymentResponse.
        For redirect-based flows, redirect_url is populated.
        For push-based flows (Wave, Orange Money), status may be PENDING until webhook.
        """

    @abc.abstractmethod
    def check_status(self, provider_reference: str) -> PaymentStatusResponse:
        """Poll for the status of a transaction."""

    @abc.abstractmethod
    def verify_webhook(self, payload: bytes, headers: dict) -> bool:
        """Verify that an incoming webhook actually came from this provider."""

    @abc.abstractmethod
    def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        """
        Extract structured data from a webhook payload.
        Must return at minimum: {"provider_reference": ..., "status": ..., "amount": ...}
        """

    def refund(self, provider_reference: str, amount: Decimal) -> PaymentResponse:
        """Optional: initiate a full or partial refund."""
        raise NotImplementedError(f"{self.name} does not support programmatic refunds.")
