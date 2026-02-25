"""Payments Views"""
import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import FreightOrder, OrderStatus
from core.exceptions import BusinessLogicError, PaymentError
from .models import PaymentStatus, PaymentTransaction
from .providers import get_provider, PaymentRequest
from .serializers import InitiatePaymentSerializer, PaymentTransactionSerializer

logger = logging.getLogger(__name__)

PLATFORM_FEE_PERCENT = 5  # 5% platform commission


class InitiatePaymentView(APIView):
    """
    POST /payments/initiate/
    Start a payment for a completed/delivered order.
    Returns a redirect URL for mobile-money checkout pages.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        order = FreightOrder.objects.get(id=d["order_id"])
        if order.shipper != request.user:
            raise BusinessLogicError("Only the shipper can initiate payment.")
        if order.status not in [OrderStatus.DELIVERED, OrderStatus.COMPLETED]:
            raise BusinessLogicError("Payment can only be initiated after delivery.")
        if not order.final_price:
            raise BusinessLogicError("Order has no final price set.")

        amount = order.final_price
        platform_fee = round(amount * PLATFORM_FEE_PERCENT / 100, 2)

        provider = get_provider(d["provider"])
        pay_request = PaymentRequest(
            amount=amount,
            currency="XOF",
            payer_phone=d["payer_phone"],
            reference=order.reference,
            description=f"Freight order {order.reference}: {order.pickup_city} → {order.delivery_city}",
            callback_url=request.build_absolute_uri(f"/api/v1/payments/webhook/{d['provider'].lower()}/"),
            return_url=d.get("return_url"),
        )

        result = provider.initiate_payment(pay_request)

        # Create transaction record
        txn = PaymentTransaction.objects.create(
            order=order,
            payer=request.user,
            payee=order.assignment.driver if hasattr(order, "assignment") else None,
            amount=amount,
            platform_fee=platform_fee,
            provider=d["provider"],
            provider_reference=result.provider_reference,
            status=PaymentStatus.PENDING,
            payer_phone=d["payer_phone"],
            provider_metadata=result.raw_response,
        )

        if not result.success:
            txn.status = PaymentStatus.FAILED
            txn.failure_reason = result.error_message or "Provider initiation failed."
            txn.save()
            raise PaymentError(f"Payment initiation failed: {result.error_message}")

        response_data = PaymentTransactionSerializer(txn).data
        response_data["redirect_url"] = result.redirect_url
        return Response(response_data, status=status.HTTP_201_CREATED)


class PaymentWebhookView(APIView):
    """
    POST /payments/webhook/<provider>/
    Receives async payment confirmations from providers.
    """
    permission_classes = [permissions.AllowAny]  # Webhooks come from external services

    def post(self, request, provider_name):
        provider_name = provider_name.upper()
        try:
            provider = get_provider(provider_name)
        except ValueError:
            return Response({"error": "Unknown provider."}, status=400)

        # Verify signature
        raw_body = request.body
        if not provider.verify_webhook(raw_body, dict(request.headers)):
            logger.warning(f"Invalid webhook signature from {provider_name}")
            return Response({"error": "Invalid signature."}, status=400)

        data = provider.parse_webhook(raw_body)
        provider_reference = data.get("provider_reference")

        try:
            txn = PaymentTransaction.objects.get(provider_reference=provider_reference)
        except PaymentTransaction.DoesNotExist:
            logger.warning(f"Webhook for unknown transaction: {provider_reference}")
            return Response({"status": "ok"})  # Acknowledge to avoid retries

        new_status = data.get("status", "PENDING")
        txn.status = new_status
        txn.provider_metadata.update(data.get("raw", {}))
        if new_status == PaymentStatus.COMPLETED:
            txn.completed_at = timezone.now()
        txn.save()

        # Trigger notification
        from .tasks import on_payment_completed
        if new_status == PaymentStatus.COMPLETED:
            on_payment_completed.delay(str(txn.id))

        return Response({"status": "ok"})


class PaymentTransactionListView(generics.ListAPIView):
    """List payment transactions for the authenticated user."""
    serializer_class = PaymentTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "provider"]
    ordering_fields = ["initiated_at"]

    def get_queryset(self):
        user = self.request.user
        return PaymentTransaction.objects.filter(payer=user).select_related("order")


class PaymentTransactionDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PaymentTransaction.objects.filter(payer=self.request.user)
