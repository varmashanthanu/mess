"""MESS Platform — Orders Serializers"""
from rest_framework import serializers

from apps.accounts.serializers import UserBasicSerializer
from apps.fleet.serializers import VehicleListSerializer, VehicleTypeSerializer
from .models import FreightOrder, OrderAssignment, OrderStatus


class OrderAssignmentSerializer(serializers.ModelSerializer):
    driver_detail = UserBasicSerializer(source="driver", read_only=True)
    vehicle_detail = VehicleListSerializer(source="vehicle", read_only=True)

    class Meta:
        model = OrderAssignment
        fields = [
            "id", "driver", "driver_detail", "vehicle", "vehicle_detail",
            "assigned_at", "picked_up_at", "in_transit_at", "delivered_at",
            "pickup_proof_photo", "pickup_proof_note",
            "proof_photo", "proof_note", "proof_signature",
            "delivery_confirmed_by_shipper",
            "shipper_rating", "driver_rating", "shipper_review", "driver_review",
        ]
        read_only_fields = ["id", "assigned_at", "driver", "vehicle"]


class FreightOrderListSerializer(serializers.ModelSerializer):
    """Compact representation for list views."""
    shipper_name = serializers.CharField(source="shipper.full_name", read_only=True)
    required_vehicle_type_name = serializers.CharField(
        source="required_vehicle_type.name", read_only=True
    )

    class Meta:
        model = FreightOrder
        fields = [
            "id", "reference", "cargo_type", "pickup_city", "delivery_city",
            "weight_kg", "proposed_price", "final_price", "currency", "status",
            "pickup_scheduled_at", "delivery_deadline", "shipper_name",
            "required_vehicle_type_name", "estimated_distance_km", "created_at",
        ]


class FreightOrderDetailSerializer(serializers.ModelSerializer):
    """Full order detail with nested relations and an offline price suggestion."""
    shipper_detail = UserBasicSerializer(source="shipper", read_only=True)
    required_vehicle_type_detail = VehicleTypeSerializer(source="required_vehicle_type", read_only=True)
    assignment = OrderAssignmentSerializer(read_only=True)
    can_accept = serializers.SerializerMethodField()
    suggested_price = serializers.SerializerMethodField()

    class Meta:
        model = FreightOrder
        fields = [
            "id", "reference", "shipper", "shipper_detail",
            "cargo_type", "cargo_description", "weight_kg", "volume_m3",
            "quantity", "special_instructions", "cargo_photos",
            "pickup_address", "pickup_city", "pickup_lat", "pickup_lng",
            "pickup_contact_name", "pickup_contact_phone", "pickup_scheduled_at",
            "delivery_address", "delivery_city", "delivery_lat", "delivery_lng",
            "delivery_contact_name", "delivery_contact_phone", "delivery_deadline",
            "required_vehicle_type", "required_vehicle_type_detail",
            "proposed_price", "final_price", "currency",
            "status", "status_changed_at", "cancellation_reason",
            "estimated_distance_km", "suggested_price",
            "assignment", "can_accept",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "reference", "shipper", "status", "status_changed_at",
            "final_price", "estimated_distance_km", "suggested_price",
            "created_at", "updated_at",
        ]

    def get_suggested_price(self, obj):
        """
        Return a price estimate dict when all four coordinates are present.
        Returns None for orders without coordinates.
        """
        if not all([obj.pickup_lat, obj.pickup_lng, obj.delivery_lat, obj.delivery_lng]):
            return None
        try:
            from core.pricing import estimate_freight_price
            est = estimate_freight_price(
                cargo_type=obj.cargo_type,
                weight_kg=float(obj.weight_kg),
                pickup_lat=float(obj.pickup_lat),
                pickup_lng=float(obj.pickup_lng),
                delivery_lat=float(obj.delivery_lat),
                delivery_lng=float(obj.delivery_lng),
            )
            return {
                "straight_distance_km": float(est.straight_distance_km),
                "road_distance_km": float(est.road_distance_km),
                "base_price_xof": int(est.base_price_xof),
                "min_price_xof": int(est.min_price_xof),
                "max_price_xof": int(est.max_price_xof),
            }
        except Exception:
            return None

    def get_can_accept(self, obj):
        """True if the current driver can accept this order."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return (
            obj.status == OrderStatus.POSTED
            and request.user.role == "DRIVER"
            and not hasattr(obj, "assignment")
        )

    def create(self, validated_data):
        validated_data["shipper"] = self.context["request"].user
        self._estimate_distance(validated_data)
        return super().create(validated_data)

    def _estimate_distance(self, data):
        from core.utils import haversine_distance
        p_lat = data.get("pickup_lat")
        p_lng = data.get("pickup_lng")
        d_lat = data.get("delivery_lat")
        d_lng = data.get("delivery_lng")
        if all([p_lat, p_lng, d_lat, d_lng]):
            data["estimated_distance_km"] = round(
                haversine_distance(float(p_lat), float(p_lng), float(d_lat), float(d_lng)), 2
            )


class OrderStatusTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True)


class AcceptOrderSerializer(serializers.Serializer):
    vehicle = serializers.UUIDField(required=False, allow_null=True)


class PickupProofSerializer(serializers.Serializer):
    pickup_proof_photo = serializers.ImageField(required=False)
    pickup_proof_note = serializers.CharField(required=False, allow_blank=True)


class ProofOfDeliverySerializer(serializers.Serializer):
    proof_photo = serializers.ImageField(required=False)
    proof_note = serializers.CharField(required=False, allow_blank=True)
    proof_signature = serializers.CharField(required=False, allow_blank=True)


class RateDeliverySerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True)


class PriceEstimateRequestSerializer(serializers.Serializer):
    """Input for the standalone price-estimate endpoint."""
    cargo_type = serializers.CharField()
    weight_kg = serializers.FloatField(min_value=0.1)
    pickup_lat = serializers.FloatField()
    pickup_lng = serializers.FloatField()
    delivery_lat = serializers.FloatField()
    delivery_lng = serializers.FloatField()
