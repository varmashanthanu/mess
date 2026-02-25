"""
MESS Platform — Wave Payment Provider (Senegal)
Wave is the dominant mobile money service in Senegal.
API docs: https://docs.wave.com/
"""
import hashlib
import hmac
import json
import logging
from decimal import Decimal
from typing import Any, Dict

import httpx
from django.conf import settings

from .base import BasePaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse

logger = logging.getLogger(__name__)


class WaveProvider(BasePaymentProvider):
    name = "WAVE"

    def __init__(self):
        self.api_key = settings.WAVE_API_KEY
        self.merchant_id = settings.WAVE_MERCHANT_ID
        self.webhook_secret = settings.WAVE_WEBHOOK_SECRET
        self.base_url = settings.WAVE_BASE_URL
        self._client = None

    @property
    def client(self) -> httpx.Client:
        if not self._client:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        """
        Wave checkout flow:
        POST /checkout/sessions → returns a redirect URL to Wave's payment page.
        """
        if not self.api_key:
            logger.warning("Wave API key not configured — returning mock response.")
            return self._mock_response(request)

        payload = {
            "amount": str(int(request.amount)),  # Wave expects integer cents equivalent
            "currency": request.currency,
            "error_url": request.callback_url,
            "success_url": request.return_url or request.callback_url,
            "merchant_id": self.merchant_id,
            "client_reference": request.reference,
            "payment_reasons": [{"amount": str(int(request.amount)), "reason": request.description}],
        }
        try:
            resp = self.client.post("/checkout/sessions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return PaymentResponse(
                success=True,
                provider_reference=data.get("id"),
                redirect_url=data.get("wave_launch_url"),
                status="PENDING",
                raw_response=data,
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Wave payment initiation failed: {e.response.text}")
            return PaymentResponse(
                success=False,
                error_message=f"Wave API error: {e.response.status_code}",
                raw_response=e.response.json() if e.response.content else {},
            )
        except Exception as e:
            logger.exception("Wave payment error")
            return PaymentResponse(success=False, error_message=str(e))

    def check_status(self, provider_reference: str) -> PaymentStatusResponse:
        try:
            resp = self.client.get(f"/checkout/sessions/{provider_reference}")
            resp.raise_for_status()
            data = resp.json()
            return PaymentStatusResponse(
                provider_reference=provider_reference,
                status=self._map_status(data.get("payment_status", "")),
                amount=Decimal(str(data.get("amount", 0))),
                raw_response=data,
            )
        except Exception as e:
            logger.exception(f"Wave status check failed for {provider_reference}")
            return PaymentStatusResponse(
                provider_reference=provider_reference,
                status="FAILED",
                raw_response={"error": str(e)},
            )

    def verify_webhook(self, payload: bytes, headers: dict) -> bool:
        if not self.webhook_secret:
            return True  # Skip in dev/test
        signature = headers.get("wave-signature", "")
        expected = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        data = json.loads(payload)
        return {
            "provider_reference": data.get("id"),
            "status": self._map_status(data.get("payment_status", "")),
            "amount": Decimal(str(data.get("amount", 0))),
            "client_reference": data.get("client_reference"),
            "raw": data,
        }

    @staticmethod
    def _map_status(wave_status: str) -> str:
        return {
            "succeeded": "COMPLETED",
            "pending": "PENDING",
            "failed": "FAILED",
            "cancelled": "CANCELLED",
        }.get(wave_status.lower(), "PENDING")

    @staticmethod
    def _mock_response(request: PaymentRequest) -> PaymentResponse:
        """Used when API key is not configured (dev/test)."""
        return PaymentResponse(
            success=True,
            provider_reference=f"WAVE_MOCK_{request.reference}",
            redirect_url="http://localhost/mock-payment",
            status="PENDING",
            raw_response={"mock": True},
        )
