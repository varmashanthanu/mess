"""Payments Serializers"""
from rest_framework import serializers
from .models import PaymentProvider, PaymentTransaction


class InitiatePaymentSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    provider = serializers.ChoiceField(choices=PaymentProvider.choices)
    payer_phone = serializers.CharField(max_length=20)
    return_url = serializers.URLField(required=False)


class PaymentTransactionSerializer(serializers.ModelSerializer):
    net_amount = serializers.ReadOnlyField()
    provider_display = serializers.CharField(source="get_provider_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            "id", "order", "payer", "payee", "amount", "currency",
            "platform_fee", "net_amount", "provider", "provider_display",
            "provider_reference", "status", "status_display",
            "failure_reason", "initiated_at", "completed_at", "payer_phone",
        ]
        read_only_fields = ["id", "payer", "platform_fee", "provider_reference",
                            "status", "initiated_at", "completed_at"]
