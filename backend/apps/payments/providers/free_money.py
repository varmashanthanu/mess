"""
MESS Platform — Free Money Provider (Expresso Senegal)
Placeholder — integrate when Free Money API documentation is obtained.
"""
import json
import logging
from decimal import Decimal
from typing import Any, Dict

from django.conf import settings

from .base import BasePaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse

logger = logging.getLogger(__name__)


class FreeMoneyProvider(BasePaymentProvider):
    name = "FREE_MONEY"

    def __init__(self):
        self.api_key = settings.FREE_MONEY_API_KEY
        self.base_url = settings.FREE_MONEY_BASE_URL

    def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        if not self.api_key or not self.base_url:
            logger.info("Free Money not configured — returning mock response.")
            return self._mock_response(request)
        # TODO: Implement when Free Money API documentation is available
        raise NotImplementedError("Free Money integration pending API documentation.")

    def check_status(self, provider_reference: str) -> PaymentStatusResponse:
        raise NotImplementedError("Free Money status check pending API documentation.")

    def verify_webhook(self, payload: bytes, headers: dict) -> bool:
        return True  # TODO

    def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        data = json.loads(payload)
        return {
            "provider_reference": data.get("transaction_id"),
            "status": "PENDING",
            "amount": Decimal("0"),
            "raw": data,
        }

    @staticmethod
    def _mock_response(request: PaymentRequest) -> PaymentResponse:
        return PaymentResponse(
            success=True,
            provider_reference=f"FREE_MOCK_{request.reference}",
            redirect_url="http://localhost/mock-payment",
            status="PENDING",
            raw_response={"mock": True},
        )
