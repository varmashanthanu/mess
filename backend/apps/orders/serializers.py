"""MESS Platform — Orders Serializers"""
from rest_framework import serializers

from apps.accounts.serializers import UserBasicSerializer
from apps.fleet.serializers import VehicleListSerializer, VehicleTypeSerializer
from .models import FreightOrder, OrderAssignment, OrderBid, OrderStatus


class OrderBidSerializer(serializers.ModelSerializer):
    carrier_detail = UserBasicSerializer(source="carrier", read_only=True)
    vehicle_detail = VehicleListSerializer(source="vehicle", read_only=True)

    class Meta:
        model = OrderBid
        fields = [
            "id", "order", "carrier", "carrier_detail", "vehicle", "vehicle_detail",
            "price", "message", "estimated_pickup_time", "status", "created_at",
        ]
        read_only_fields = ["id", "status", "created_at", "carrier"]

    def validate(self, attrs):
        request = self.context["request"]
        order = attrs.get("order") or (self.instance.order if self.instance else None)
        if order and order.status not in [OrderStatus.POSTED, OrderStatus.BIDDING]:
            raise serializers.ValidationError("This order is no longer accepting bids.")
        # Ensure vehicle belongs to carrier
        vehicle = attrs.get("vehicle")
        if vehicle and vehicle.owner != request.user:
            raise serializers.ValidationError({"vehicle": "This vehicle does not belong to you."})
        return attrs

    def create(self, validated_data):
        validated_data["carrier"] = self.context["request"].user
        return super().create(validated_data)


class OrderAssignmentSerializer(serializers.ModelSerializer):
    driver_detail = UserBasicSerializer(source="driver", read_only=True)
    vehicle_detail = VehicleListSerializer(source="vehicle", read_only=True)

    class Meta:
        model = OrderAssignment
        fields = [
            "id", "driver", "driver_detail", "vehicle", "vehicle_detail",
            "assigned_at", "picked_up_at", "in_transit_at", "delivered_at",
            "proof_photo", "proof_note", "proof_signature",
            "delivery_confirmed_by_shipper",
            "shipper_rating", "driver_rating", "shipper_review", "driver_review",
        ]
        read_only_fields = ["id", "assigned_at", "driver", "vehicle"]


class FreightOrderListSerializer(serializers.ModelSerializer):
    """Compact representation for list views."""
    shipper_name = serializers.CharField(source="shipper.get_full_name", read_only=True)
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
    """Full order detail with nested relations."""
    shipper_detail = UserBasicSerializer(source="shipper", read_only=True)
    required_vehicle_type_detail = VehicleTypeSerializer(source="required_vehicle_type", read_only=True)
    bids = OrderBidSerializer(many=True, read_only=True)
    assignment = OrderAssignmentSerializer(read_only=True)
    bid_count = serializers.SerializerMethodField()
    can_bid = serializers.SerializerMethodField()

    class Meta:
        model = FreightOrder
        fields = [
            "id", "reference", "shipper", "shipper_detail", "broker",
            "cargo_type", "cargo_description", "weight_kg", "volume_m3",
            "quantity", "special_instructions", "cargo_photos",
            "pickup_address", "pickup_city", "pickup_lat", "pickup_lng",
            "pickup_contact_name", "pickup_contact_phone", "pickup_scheduled_at",
            "delivery_address", "delivery_city", "delivery_lat", "delivery_lng",
            "delivery_contact_name", "delivery_contact_phone", "delivery_deadline",
            "required_vehicle_type", "required_vehicle_type_detail",
            "proposed_price", "final_price", "currency",
            "status", "status_changed_at", "cancellation_reason",
            "estimated_distance_km",
            "bids", "assignment", "bid_count", "can_bid",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "reference", "shipper", "status", "status_changed_at",
            "final_price", "estimated_distance_km", "created_at", "updated_at",
        ]

    def get_bid_count(self, obj):
        return obj.bids.filter(status=OrderBid.BidStatus.PENDING).count()

    def get_can_bid(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return (
            obj.status in [OrderStatus.POSTED, OrderStatus.BIDDING]
            and request.user.role in ["DRIVER", "FLEET_MANAGER"]
            and not obj.bids.filter(carrier=request.user).exists()
        )

    def create(self, validated_data):
        validated_data["shipper"] = self.context["request"].user
        # Estimate distance if coordinates provided
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


class AcceptBidSerializer(serializers.Serializer):
    bid_id = serializers.UUIDField()


class ProofOfDeliverySerializer(serializers.Serializer):
    proof_photo = serializers.ImageField(required=False)
    proof_note = serializers.CharField(required=False, allow_blank=True)
    proof_signature = serializers.CharField(required=False, allow_blank=True)


class RateDeliverySerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True)
