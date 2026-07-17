"""
MESS Platform — PayTech Payment Provider (Senegal)
PayTech is a hosted checkout gateway (card + mobile money aggregator).
API docs: https://doc.paytech.sn/

Unlike the other providers, PayTech's credentials are managed through the
superadmin panel (PaytechConfig) rather than environment variables, so a
toggle can switch between TEST and PRODUCTION without a redeploy.
"""
import hashlib
import json
import logging
from decimal import Decimal
from typing import Any, Dict
from urllib.parse import parse_qsl

import httpx

from .base import BasePaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse

logger = logging.getLogger(__name__)


class PaytechProvider(BasePaymentProvider):
    name = "PAYTECH"
    BASE_URL = "https://paytech.sn/api/payment"

    def __init__(self):
        from apps.payments.models import PaytechConfig, PaytechGatewayMode

        config = PaytechConfig.get_instance()
        self.enabled = config.is_enabled
        self.env = "test" if config.mode == PaytechGatewayMode.TEST else "prod"
        if config.mode == PaytechGatewayMode.PRODUCTION:
            self.api_key = config.production_api_key
            self.api_secret = config.production_api_secret
        else:
            self.api_key = config.test_api_key
            self.api_secret = config.test_api_secret

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "API_KEY": self.api_key,
            "API_SECRET": self.api_secret,
            "Content-Type": "application/json",
        }

    def initiate_payment(self, request: PaymentRequest) -> PaymentResponse:
        """
        PayTech checkout flow:
        POST /request-payment → returns a token + redirect_url to PayTech's hosted page.
        """
        if not self.enabled:
            return PaymentResponse(success=False, error_message="PayTech gateway is disabled.")
        if not self.api_key or not self.api_secret:
            logger.warning("PayTech API key/secret not configured — returning mock response.")
            return self._mock_response(request)

        payload = {
            "item_name": request.description,
            "item_price": int(request.amount),
            "currency": request.currency,
            "ref_command": request.reference,
            "command_name": request.description,
            "env": self.env,
            "ipn_url": request.callback_url,
            "success_url": request.return_url or request.callback_url,
            "cancel_url": request.return_url or request.callback_url,
        }
        try:
            resp = httpx.post(
                f"{self.BASE_URL}/request-payment",
                json=payload,
                headers=self._headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                return PaymentResponse(
                    success=False,
                    error_message=str(data.get("errors") or "PayTech refused the request."),
                    raw_response=data,
                )
            return PaymentResponse(
                success=True,
                provider_reference=data.get("token"),
                redirect_url=data.get("redirect_url"),
                status="PENDING",
                raw_response=data,
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"PayTech payment initiation failed: {e.response.text}")
            return PaymentResponse(
                success=False,
                error_message=f"PayTech API error: {e.response.status_code}",
                raw_response=self._safe_json(e.response),
            )
        except Exception as e:
            logger.exception("PayTech payment error")
            return PaymentResponse(success=False, error_message=str(e))

    def check_status(self, provider_reference: str) -> PaymentStatusResponse:
        # PayTech's public API has no GET-status-by-token endpoint — status
        # is only ever pushed to us via the IPN webhook.
        return PaymentStatusResponse(
            provider_reference=provider_reference,
            status="PENDING",
            raw_response={"note": "PayTech status is only available via IPN webhook."},
        )

    def verify_webhook(self, payload: bytes, headers: dict) -> bool:
        if not self.api_key or not self.api_secret:
            return True  # dev/test — skip when not configured
        data = self._parse_body(payload)
        expected_key_hash = hashlib.sha256(self.api_key.encode()).hexdigest()
        expected_secret_hash = hashlib.sha256(self.api_secret.encode()).hexdigest()
        return (
            data.get("api_key_sha256") == expected_key_hash
            and data.get("api_secret_sha256") == expected_secret_hash
        )

    def parse_webhook(self, payload: bytes) -> Dict[str, Any]:
        data = self._parse_body(payload)
        event = data.get("type_event", "")
        return {
            "provider_reference": data.get("token"),
            "status": self._map_status(event),
            "amount": Decimal(str(data.get("item_price", 0))),
            "client_reference": data.get("ref_command"),
            "raw": data,
        }

    @staticmethod
    def _map_status(event: str) -> str:
        return {
            "sale_complete": "COMPLETED",
            "sale_cancel": "CANCELLED",
        }.get(event, "PENDING")

    @staticmethod
    def _parse_body(payload: bytes) -> Dict[str, Any]:
        """PayTech's IPN posts form-encoded data; accept JSON too for local testing."""
        try:
            return json.loads(payload)
        except ValueError:
            return dict(parse_qsl(payload.decode()))

    @staticmethod
    def _safe_json(resp) -> Dict[str, Any]:
        try:
            return resp.json()
        except Exception:
            return {}

    @staticmethod
    def _mock_response(request: PaymentRequest) -> PaymentResponse:
        """Used when API key is not configured (dev/test)."""
        return PaymentResponse(
            success=True,
            provider_reference=f"PAYTECH_MOCK_{request.reference}",
            redirect_url="http://localhost/mock-payment",
            status="PENDING",
            raw_response={"mock": True},
        )
