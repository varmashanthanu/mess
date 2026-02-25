"""
MESS Platform — Custom Exception Handler
Returns consistent JSON error envelopes across all API endpoints.
"""
import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Wraps DRF's default handler to produce consistent error envelopes:
    {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Human-readable message",
            "detail": { ... }  # field errors or extra info
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_code = _get_error_code(exc)
        error_detail = response.data

        # Flatten single-message responses
        message = _extract_message(error_detail)

        response.data = {
            "error": {
                "code": error_code,
                "message": message,
                "detail": error_detail if isinstance(error_detail, dict) else None,
            }
        }
    else:
        # Unhandled exception → 500
        logger.exception("Unhandled exception", exc_info=exc)
        response = Response(
            {
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred. Please try again.",
                    "detail": None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def _get_error_code(exc):
    if isinstance(exc, ValidationError):
        return "VALIDATION_ERROR"
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "AUTHENTICATION_REQUIRED"
    if isinstance(exc, PermissionDenied):
        return "PERMISSION_DENIED"
    if isinstance(exc, Http404):
        return "NOT_FOUND"
    if hasattr(exc, "default_code"):
        return exc.default_code.upper()
    return "API_ERROR"


def _extract_message(detail):
    if isinstance(detail, list) and detail:
        return str(detail[0])
    if isinstance(detail, dict):
        # Take the first field's first error
        for v in detail.values():
            if isinstance(v, list) and v:
                return str(v[0])
            return str(v)
    return str(detail)


# ── Custom exceptions ─────────────────────────────────────────────
class BusinessLogicError(APIException):
    """Use for domain rule violations (e.g. order already accepted)."""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "BUSINESS_LOGIC_ERROR"

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code or self.default_code)


class PaymentError(APIException):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_code = "PAYMENT_ERROR"


class OrderStateError(BusinessLogicError):
    default_code = "INVALID_ORDER_STATE"
