"""MESS Platform — Fleet Serializers"""
from rest_framework import serializers
from .models import Vehicle, VehicleDocument, VehicleType


class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = ["id", "name", "name_fr", "name_wo", "max_payload_kg", "volume_m3", "icon"]


class VehicleDocumentSerializer(serializers.ModelSerializer):
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = VehicleDocument
        fields = ["id", "document_type", "file", "expiry_date", "notes", "is_expired"]


class VehicleSerializer(serializers.ModelSerializer):
    vehicle_type_detail = VehicleTypeSerializer(source="vehicle_type", read_only=True)
    documents = VehicleDocumentSerializer(many=True, read_only=True)
    effective_payload_kg = serializers.ReadOnlyField()

    class Meta:
        model = Vehicle
        fields = [
            "id", "registration_number", "vehicle_type", "vehicle_type_detail",
            "make", "model", "year", "fuel_type", "color",
            "payload_kg", "volume_m3", "effective_payload_kg",
            "is_active", "is_verified", "photo", "documents",
        ]
        read_only_fields = ["is_verified"]

    def validate_owner(self, value):
        # owner is set from request.user in view
        return value

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class VehicleListSerializer(serializers.ModelSerializer):
    """Compact for lists."""
    vehicle_type_name = serializers.CharField(source="vehicle_type.name", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id", "registration_number", "vehicle_type_name",
            "make", "model", "effective_payload_kg", "is_active", "is_verified",
        ]
