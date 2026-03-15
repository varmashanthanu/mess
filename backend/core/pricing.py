"""
MESS Platform — Offline Freight Price Estimator

Estimates freight cost in XOF (West African CFA Franc) without any
external routing API, using:
  1. Haversine (great-circle) distance
  2. A Senegal road-network correction factor
  3. Cargo-type base rates calibrated to the Dakar market
  4. Weight surcharges for heavy loads
"""
from decimal import Decimal
from typing import NamedTuple

# Average ratio of actual road distance to great-circle distance
# across Senegal's primary/secondary road network.
ROAD_FACTOR = Decimal("1.30")

# XOF per road-km for a single full-truck-load trip.
# Rates are derived from publicly available ANSD (Agence Nationale de la
# Statistique et de la Démographie) freight surveys and validated against
# typical Dakar–Thiès (70 km) and Dakar–Saint-Louis (270 km) market rates.
RATE_PER_KM: dict[str, Decimal] = {
    "GENERAL":       Decimal("750"),
    "FRAGILE":       Decimal("1100"),
    "HAZARDOUS":     Decimal("1600"),
    "LIVESTOCK":     Decimal("900"),
    "REFRIGERATED":  Decimal("1300"),
    "BULK":          Decimal("650"),
    "CONSTRUCTION":  Decimal("600"),
    "ELECTRONICS":   Decimal("1000"),
}

DEFAULT_RATE = Decimal("750")

# Fixed loading/unloading charge (driver + crew time)
LOADING_FEE = Decimal("5000")

# Absolute floor — no trip is viable below this amount
MIN_PRICE = Decimal("25000")

# ±% range applied to the base price to give min/max bounds
PRICE_RANGE_LOW = Decimal("0.85")
PRICE_RANGE_HIGH = Decimal("1.25")


class PriceEstimate(NamedTuple):
    """All values in XOF unless noted."""
    straight_distance_km: Decimal    # Haversine distance
    road_distance_km: Decimal        # Corrected for road network
    base_price_xof: Decimal          # Midpoint estimate
    min_price_xof: Decimal           # Low end (negotiated down ~15%)
    max_price_xof: Decimal           # High end (fully loaded + urgency ~25%)


def estimate_freight_price(
    cargo_type: str,
    weight_kg: float,
    pickup_lat: float,
    pickup_lng: float,
    delivery_lat: float,
    delivery_lng: float,
) -> PriceEstimate:
    """
    Return an XOF price estimate for a freight order.

    Args:
        cargo_type:   One of the CargoType choices defined in orders.models.
        weight_kg:    Gross cargo weight in kilograms.
        pickup_lat:   Pickup latitude.
        pickup_lng:   Pickup longitude.
        delivery_lat: Delivery latitude.
        delivery_lng: Delivery longitude.

    Returns:
        PriceEstimate with straight/road distances and min/base/max prices.
    """
    from core.utils import haversine_distance

    straight_km = Decimal(
        str(round(haversine_distance(pickup_lat, pickup_lng, delivery_lat, delivery_lng), 2))
    )
    road_km = (straight_km * ROAD_FACTOR).quantize(Decimal("0.01"))

    rate = RATE_PER_KM.get(cargo_type, DEFAULT_RATE)
    base = (road_km * rate + LOADING_FEE).quantize(Decimal("1"))

    # Weight surcharge: +10 % for every 5 tonnes above 10 T
    if weight_kg > 10_000:
        extra_five_tonne_bands = int((weight_kg - 10_000) / 5_000)
        surcharge = Decimal(extra_five_tonne_bands) * Decimal("0.10")
        base = (base * (1 + surcharge)).quantize(Decimal("1"))

    base = max(base, MIN_PRICE)

    min_price = (base * PRICE_RANGE_LOW).quantize(Decimal("1"))
    max_price = (base * PRICE_RANGE_HIGH).quantize(Decimal("1"))

    return PriceEstimate(
        straight_distance_km=straight_km,
        road_distance_km=road_km,
        base_price_xof=base,
        min_price_xof=min_price,
        max_price_xof=max_price,
    )
