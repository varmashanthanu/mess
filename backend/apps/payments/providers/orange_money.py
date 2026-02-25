"""
MESS Platform — Orange Money Provider (Senegal)
Uses the Orange Money Web Pay API for Senegal.
"""
import json
import logging
from decimal import Decimal
from typing import Any, Dict

import httpx
from django.conf import settings

from .base import BasePaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse

logger = logging.getLogger(__name__)


class OrangeMoneyProvider(BasePaymentProvider):
    name = "ORANGE_MONEY"

    def __init__(self):
        self.api_key = settings.ORANGE_MONEY_API_KEY
        self.client_id = settings.ORANGE_MONEY_CLIENT_ID
        self.client_secret = settings.ORANGE_MONEY_CLIENT_SECRET
        self.base_url = settings.ORANGE_MONEY_BASE_URL
        self._access_token = None

    def _get_access_token(self) -> str:
        """Fetch OAuth2 access token from Orange Money."""
        import base64
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        resp = httpx.post(
            "https://api.orange.com/oauth/v3/token",
            headers={"Authorization": f"Basic {credentials}"},
            data={"grant_type": "client_credentials"},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    @property
    def access_token(self) -> str:
        if not self._access_token:
            self._access_token = self._get_access_token()
        return self._access_token

    def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        if not self.client_id:
            return self._mock_response(request)
        try:
            payload = {
                "merchant_key": self.api_key,
                "currency": "OUV",  # Orange Money uses "OUV" for Senegal
                "order_id": request.reference,
                "amount": str(int(request.amount)),
                "return_url": request.return_url or request.callback_url,
                "cancel_url": request.callback_url,
                "notif_url": request.callback_url,
                "lang": "fr",
                "reference": request.description,
            }
            resp = httpx.post(
                f"{self.base_url}/webpayment",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return PaymentResponse(
                success=True,
                provider_reference=data.get("pay_token"),
                redirect_url=data.get("payment_url"),
                status="PENDING",
                raw_response=data,
            )
        except Exception as e:
            logger.exception("Orange Money payment error")
            return PaymentResponse(success=False, error_message=str(e))

    def check_status(self, provider_reference: str) -> PaymentStatusResponse:
        try:
            resp = httpx.get(
                f"{self.base_url}/webpayment/{provider_reference}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return PaymentStatusResponse(
                provider_reference=provider_reference,
                status=self._map_status(data.get("status", "")),
                amount=Decimal(str(data.get("amount", 0))),
                raw_response=data,
            )
        except Exception as e:
            return PaymentStatusResponse(
                provider_reference=provider_reference, status="FAILED",
                raw_response={"error": str(e)}
            )

    def verify_webhook(self, payload: bytes, headers: dict) -> bool:
        # Orange Money uses a different verification approach — check documentation
        return True  # TODO: implement when real credentials available

    def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        data = json.loads(payload)
        return {
            "provider_reference": data.get("pay_token"),
            "status": self._map_status(data.get("status", "")),
            "amount": Decimal(str(data.get("amount", 0))),
            "client_reference": data.get("order_id"),
            "raw": data,
        }

    @staticmethod
    def _map_status(status: str) -> str:
        return {
            "SUCCESS": "COMPLETED",
            "PENDING": "PENDING",
            "FAILED": "FAILED",
            "CANCELLED": "CANCELLED",
            "INITIATED": "PENDING",
        }.get(status.upper(), "PENDING")

    @staticmethod
    def _mock_response(request: PaymentRequest) -> PaymentResponse:
        return PaymentResponse(
            success=True,
            provider_reference=f"OM_MOCK_{request.reference}",
            redirect_url="http://localhost/mock-payment",
            status="PENDING",
            raw_response={"mock": True},
        )
