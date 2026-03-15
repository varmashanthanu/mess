"""
Tests for core.pricing — offline freight price estimator.
No DB required.
"""
import pytest
from decimal import Decimal

from core.pricing import (
    LOADING_FEE,
    MIN_PRICE,
    RATE_PER_KM,
    ROAD_FACTOR,
    estimate_freight_price,
)
from core.utils import haversine_distance


# ── haversine_distance ──────────────────────────────────────────────────────

class TestHaversineDistance:
    def test_same_point_is_zero(self):
        assert haversine_distance(14.6928, -17.4467, 14.6928, -17.4467) == pytest.approx(0.0, abs=0.001)

    def test_dakar_to_thies(self):
        # Dakar → Thiès: ~70 km straight-line
        dist = haversine_distance(14.6928, -17.4467, 14.7877, -16.9246)
        assert 65 < dist < 80

    def test_dakar_to_saint_louis(self):
        # Dakar → Saint-Louis: ~270 km straight-line
        dist = haversine_distance(14.6928, -17.4467, 16.0178, -16.4896)
        assert 240 < dist < 290

    def test_symmetry(self):
        d1 = haversine_distance(14.6928, -17.4467, 14.7877, -16.9246)
        d2 = haversine_distance(14.7877, -16.9246, 14.6928, -17.4467)
        assert d1 == pytest.approx(d2, rel=1e-9)


# ── estimate_freight_price ──────────────────────────────────────────────────

class TestEstimateFreightPrice:
    # Dakar coordinates
    PICKUP = {"pickup_lat": 14.6928, "pickup_lng": -17.4467}
    # Thiès coordinates
    DELIVERY = {"delivery_lat": 14.7877, "delivery_lng": -16.9246}

    def _estimate(self, cargo_type="GENERAL", weight_kg=1000.0, **coords):
        c = {**self.PICKUP, **self.DELIVERY, **coords}
        return estimate_freight_price(
            cargo_type=cargo_type,
            weight_kg=weight_kg,
            **c,
        )

    def test_returns_named_tuple(self):
        est = self._estimate()
        assert hasattr(est, "base_price_xof")
        assert hasattr(est, "min_price_xof")
        assert hasattr(est, "max_price_xof")
        assert hasattr(est, "straight_distance_km")
        assert hasattr(est, "road_distance_km")

    def test_road_distance_is_greater_than_straight(self):
        est = self._estimate()
        assert est.road_distance_km > est.straight_distance_km

    def test_road_factor_applied(self):
        est = self._estimate()
        expected_road = est.straight_distance_km * ROAD_FACTOR
        assert est.road_distance_km == pytest.approx(float(expected_road), rel=1e-3)

    def test_min_below_base_below_max(self):
        est = self._estimate()
        assert est.min_price_xof < est.base_price_xof < est.max_price_xof

    def test_minimum_price_floor_enforced(self):
        # Very short trip — should still hit the floor
        est = estimate_freight_price(
            cargo_type="GENERAL",
            weight_kg=100.0,
            pickup_lat=14.6928,
            pickup_lng=-17.4467,
            delivery_lat=14.6940,  # ~150 m away
            delivery_lng=-17.4480,
        )
        assert est.base_price_xof >= MIN_PRICE

    def test_refrigerated_more_expensive_than_bulk(self):
        est_ref = self._estimate(cargo_type="REFRIGERATED")
        est_bulk = self._estimate(cargo_type="BULK")
        assert est_ref.base_price_xof > est_bulk.base_price_xof

    def test_hazardous_most_expensive(self):
        est_haz = self._estimate(cargo_type="HAZARDOUS")
        est_gen = self._estimate(cargo_type="GENERAL")
        assert est_haz.base_price_xof > est_gen.base_price_xof

    def test_unknown_cargo_type_uses_default_rate(self):
        est_unknown = self._estimate(cargo_type="MYSTERY_CARGO")
        est_general = self._estimate(cargo_type="GENERAL")
        # GENERAL is the default rate, so prices should match
        assert est_unknown.base_price_xof == est_general.base_price_xof

    def test_weight_surcharge_above_10t(self):
        est_light = self._estimate(weight_kg=5_000)
        est_heavy = self._estimate(weight_kg=20_000)  # 10 T above threshold → +20%
        # Heavy should cost more (or equal if floor kicks in)
        assert est_heavy.base_price_xof >= est_light.base_price_xof

    def test_weight_surcharge_amount(self):
        # 20 000 kg = 10 T over threshold → 2 bands × 10% = +20%
        est_base = self._estimate(weight_kg=10_000)
        est_heavy = self._estimate(weight_kg=20_000)
        # Allow for floor clamping on short trips
        if est_base.base_price_xof > MIN_PRICE:
            expected = est_base.base_price_xof * Decimal("1.20")
            assert abs(est_heavy.base_price_xof - expected) <= 2  # rounding tolerance

    def test_longer_route_costs_more(self):
        # Dakar → Thiès vs Dakar → Ziguinchor
        est_short = self._estimate()
        est_long = estimate_freight_price(
            cargo_type="GENERAL",
            weight_kg=1000.0,
            pickup_lat=14.6928,
            pickup_lng=-17.4467,
            delivery_lat=12.5681,
            delivery_lng=-16.2719,
        )
        assert est_long.base_price_xof > est_short.base_price_xof

    def test_loading_fee_included(self):
        # For a route with zero distance, only loading fee should apply,
        # clamped to MIN_PRICE
        est = estimate_freight_price(
            cargo_type="GENERAL",
            weight_kg=100.0,
            pickup_lat=14.6928,
            pickup_lng=-17.4467,
            delivery_lat=14.6928,
            delivery_lng=-17.4467,
        )
        assert est.base_price_xof >= LOADING_FEE
        assert est.base_price_xof >= MIN_PRICE

    def test_prices_are_integers_of_xof(self):
        est = self._estimate()
        assert est.base_price_xof == est.base_price_xof.to_integral_value()
        assert est.min_price_xof == est.min_price_xof.to_integral_value()
        assert est.max_price_xof == est.max_price_xof.to_integral_value()

    def test_all_cargo_types_produce_valid_estimate(self):
        cargo_types = [
            "GENERAL", "FRAGILE", "HAZARDOUS", "LIVESTOCK",
            "REFRIGERATED", "BULK", "CONSTRUCTION", "ELECTRONICS",
        ]
        for ct in cargo_types:
            est = self._estimate(cargo_type=ct)
            assert est.base_price_xof >= MIN_PRICE, f"{ct} failed the floor check"
            assert est.min_price_xof > 0
            assert est.max_price_xof > est.min_price_xof
