"""
MESS Platform — Core Utilities
"""
import hashlib
import hmac
import math
import re
from typing import Optional

import shortuuid


def generate_order_reference() -> str:
    """Generate a short human-readable order reference like MESS-K7X2P."""
    return f"MESS-{shortuuid.ShortUUID().random(length=5).upper()}"


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP for phone verification."""
    import random
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate great-circle distance between two GPS coordinates in km.
    Used as a fast fallback when no routing engine is available.
    """
    R = 6371  # Earth radius km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 webhook signatures from payment providers."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def normalize_phone(phone: str, region: str = "SN") -> Optional[str]:
    """
    Normalize a phone number to E.164 format.
    Returns None if invalid.
    """
    import phonenumbers
    try:
        parsed = phonenumbers.parse(phone, region)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass
    return None


def mask_phone(phone: str) -> str:
    """Mask phone number for display: +221 77 123 4567 → +221 77 *** 4567."""
    if len(phone) < 8:
        return phone
    return phone[:6] + "***" + phone[-4:]


def paginate_queryset(queryset, request, serializer_class, view):
    """Helper to quickly paginate a queryset inside a view method."""
    from core.pagination import StandardResultsSetPagination
    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    if page is not None:
        serializer = serializer_class(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
    serializer = serializer_class(queryset, many=True, context={"request": request})
    from rest_framework.response import Response
    return Response(serializer.data)
