"""
Payment provider registry.
To add a new provider:
1. Create a module in this package implementing BasePaymentProvider
2. Register it in PROVIDER_REGISTRY below
3. Add its settings to base.py and .env.example
"""
from .base import BasePaymentProvider, PaymentRequest, PaymentResponse, PaymentStatusResponse
from .free_money import FreeMoneyProvider
from .orange_money import OrangeMoneyProvider
from .wave import WaveProvider

PROVIDER_REGISTRY = {
    "WAVE": WaveProvider,
    "ORANGE_MONEY": OrangeMoneyProvider,
    "FREE_MONEY": FreeMoneyProvider,
}


def get_provider(provider_name: str) -> BasePaymentProvider:
    """Factory — returns an initialized provider by name."""
    cls = PROVIDER_REGISTRY.get(provider_name.upper())
    if not cls:
        raise ValueError(f"Unknown payment provider: {provider_name}. Available: {list(PROVIDER_REGISTRY)}")
    return cls()


__all__ = [
    "BasePaymentProvider", "PaymentRequest", "PaymentResponse", "PaymentStatusResponse",
    "WaveProvider", "OrangeMoneyProvider", "FreeMoneyProvider",
    "PROVIDER_REGISTRY", "get_provider",
]
