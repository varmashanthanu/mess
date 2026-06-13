"""
MESS Platform — Orders Views
Handles the full freight order lifecycle.
"""
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import BusinessLogicError, OrderStateError
from core.permissions import IsAdmin, IsCarrier, IsShipperOrBroker
from .models import (
    ACTIVE_ORDER_STATUSES,
    FreightOrder,
    OrderAssignment,
    OrderStatus,
)
from .serializers import (
    AcceptOrderSerializer,
    FreightOrderDetailSerializer,
    FreightOrderListSerializer,
    OrderStatusTransitionSerializer,
    PickupProofSerializer,
    PriceEstimateRequestSerializer,
    ProofOfDeliverySerializer,
    RateDeliverySerializer,
)

logger = logging.getLogger(__name__)


class FreightOrderListCreateView(generics.ListCreateAPIView):
    """
    GET  — List orders (role-filtered)
    POST — Create a new freight order (shippers only)
    """
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "cargo_type", "pickup_city", "delivery_city"]
    search_fields = ["reference", "cargo_description", "pickup_address", "delivery_address", "pickup_city", "delivery_city"]
    ordering_fields = ["created_at", "pickup_scheduled_at", "proposed_price", "weight_kg"]

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        params = self.request.query_params
        min_price = params.get("min_price")
        max_price = params.get("max_price")
        max_weight = params.get("max_weight")
        if min_price:
            qs = qs.filter(proposed_price__gte=min_price)
        if max_price:
            qs = qs.filter(proposed_price__lte=max_price)
        if max_weight:
            qs = qs.filter(weight_kg__lte=max_weight)
        return qs

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FreightOrderDetailSerializer
        return FreightOrderListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = FreightOrder.objects.select_related(
            "shipper", "required_vehicle_type"
        )

        if user.role == "SHIPPER":
            return qs.filter(shipper=user)
        if user.role == "DRIVER":
            # Drivers see posted orders + their own assigned ones
            return qs.filter(status=OrderStatus.POSTED) | qs.filter(assignment__driver=user)
        if user.role == "ADMIN":
            return qs.all()
        return qs.none()

    def perform_create(self, serializer):
        if self.request.user.role != "SHIPPER":
            raise BusinessLogicError("Only shippers can create orders.")
        serializer.save(shipper=self.request.user)


class FreightOrderDetailView(generics.RetrieveUpdateAPIView):
    """Get or update a specific freight order."""
    serializer_class = FreightOrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FreightOrder.objects.select_related(
            "shipper", "required_vehicle_type", "assignment__driver", "assignment__vehicle"
        )

    def update(self, request, *args, **kwargs):
        order = self.get_object()
        # Only allow editing DRAFT orders
        if order.status != OrderStatus.DRAFT:
            raise BusinessLogicError("Only draft orders can be edited.")
        if order.shipper != request.user and request.user.role != "ADMIN":
            raise BusinessLogicError("You do not own this order.")
        return super().update(request, *args, **kwargs)


class OrderTransitionView(APIView):
    """
    PATCH /orders/<id>/transition/
    Explicitly trigger a status transition.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        serializer = OrderStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        reason = serializer.validated_data.get("reason", "")

        self._check_permission(request.user, order, new_status)

        with transaction.atomic():
            order.transition_to(new_status)
            if new_status == OrderStatus.CANCELLED:
                order.cancellation_reason = reason
                order.save(update_fields=["cancellation_reason"])
            self._handle_side_effects(order, new_status)

        return Response(FreightOrderDetailSerializer(order, context={"request": request}).data)

    def _check_permission(self, user, order, new_status):
        is_owner = order.shipper == user
        is_driver = hasattr(order, "assignment") and order.assignment.driver == user
        is_admin = user.role == "ADMIN"

        if not (is_owner or is_driver or is_admin):
            raise BusinessLogicError("You do not have permission to transition this order.")

    def _handle_side_effects(self, order, new_status):
        """Trigger notifications and other side effects on status change."""
        from apps.notifications.tasks import notify_order_status_change
        notify_order_status_change.delay(str(order.id), new_status)


class PostOrderView(APIView):
    """
    POST /orders/<id>/post/
    Publish a DRAFT order to the market.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk, shipper=request.user)
        order.transition_to(OrderStatus.POSTED)
        # Notify nearby available drivers
        from apps.notifications.tasks import notify_new_order_posted
        notify_new_order_posted.delay(str(order.id))
        return Response({"message": "Order posted.", "status": order.status})


class AcceptOrderView(APIView):
    """
    POST /orders/<id>/accept/
    Driver accepts a posted order at the shipper's proposed price.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != "DRIVER":
            raise BusinessLogicError("Only drivers can accept orders.")

        order = FreightOrder.objects.get(pk=pk)
        if order.status != OrderStatus.POSTED:
            raise BusinessLogicError("This order is not available for acceptance.")
        if hasattr(order, "assignment"):
            raise BusinessLogicError("This order has already been assigned.")

        serializer = AcceptOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle = None
        vehicle_id = serializer.validated_data.get("vehicle")
        if vehicle_id:
            from apps.fleet.models import Vehicle
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id, owner=request.user)
            except Vehicle.DoesNotExist:
                raise BusinessLogicError("Vehicle not found or does not belong to you.")

        with transaction.atomic():
            order.final_price = order.proposed_price
            order.transition_to(OrderStatus.ASSIGNED, save=False)
            order.save(update_fields=["final_price", "status", "status_changed_at"])

            OrderAssignment.objects.create(
                order=order,
                driver=request.user,
                vehicle=vehicle,
            )

        from apps.notifications.tasks import notify_order_status_change
        notify_order_status_change.delay(str(order.id), OrderStatus.ASSIGNED)
        return Response({"message": "Order accepted. You have been assigned.", "status": order.status})


class PickupProofView(APIView):
    """
    POST /orders/<id>/pickup-proof/
    - ASSIGNED:    first submission → saves proof, transitions to IN_TRANSIT.
    - IN_TRANSIT:  re-upload → overwrites proof only, no state change.
    - COMPLETED:   blocked.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        if not hasattr(order, "assignment") or order.assignment.driver != request.user:
            raise BusinessLogicError("Only the assigned driver can submit pickup proof.")
        if order.status == OrderStatus.COMPLETED:
            raise BusinessLogicError("Cannot modify proof on a completed order.")
        if order.status not in [OrderStatus.ASSIGNED, OrderStatus.IN_TRANSIT]:
            raise BusinessLogicError("Pickup proof can only be submitted when the order is Assigned or In Transit.")

        serializer = PickupProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = order.assignment
        if serializer.validated_data.get("pickup_proof_photo"):
            assignment.pickup_proof_photo = serializer.validated_data["pickup_proof_photo"]
        assignment.pickup_proof_note = serializer.validated_data.get("pickup_proof_note", "")

        if order.status == OrderStatus.IN_TRANSIT:
            # Re-upload: overwrite proof only, keep current status
            assignment.save(update_fields=["pickup_proof_photo", "pickup_proof_note"])
            return Response({"message": "Pickup proof updated."})

        # First submission: record timestamps and advance status
        assignment.picked_up_at = timezone.now()
        assignment.in_transit_at = timezone.now()
        assignment.save(update_fields=["pickup_proof_photo", "pickup_proof_note", "picked_up_at", "in_transit_at"])
        order.transition_to(OrderStatus.IN_TRANSIT)
        from apps.notifications.tasks import notify_order_status_change
        notify_order_status_change.delay(str(order.id), OrderStatus.IN_TRANSIT)
        return Response({"message": "Pickup confirmed. Order is now In Transit."})


class RevertPickupView(APIView):
    """
    POST /orders/<id>/revert-pickup/
    Driver reverts IN_TRANSIT → ASSIGNED and clears pickup proof.
    Use when the proof was submitted by mistake and the cargo hasn't actually been picked up.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        if not hasattr(order, "assignment") or order.assignment.driver != request.user:
            raise BusinessLogicError("Only the assigned driver can revert pickup.")
        if order.status != OrderStatus.IN_TRANSIT:
            raise BusinessLogicError("Order must be In Transit to revert pickup.")

        with transaction.atomic():
            assignment = order.assignment
            assignment.pickup_proof_photo = None
            assignment.pickup_proof_note = ""
            assignment.picked_up_at = None
            assignment.in_transit_at = None
            assignment.save(update_fields=["pickup_proof_photo", "pickup_proof_note", "picked_up_at", "in_transit_at"])

            order.status = OrderStatus.ASSIGNED
            order.status_changed_at = timezone.now()
            order.save(update_fields=["status", "status_changed_at"])

        return Response({"message": "Order reverted to Assigned. Re-submit pickup proof when ready."})


class ProofOfDeliveryView(APIView):
    """
    POST /orders/<id>/proof-of-delivery/
    - IN_TRANSIT:              first submission → saves proof, transitions to DELIVERED.
    - DELIVERED (unconfirmed): re-upload → overwrites proof only, no state change.
    - COMPLETED or confirmed:  blocked.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        if not hasattr(order, "assignment") or order.assignment.driver != request.user:
            raise BusinessLogicError("Only the assigned driver can submit proof of delivery.")
        if order.status == OrderStatus.COMPLETED or order.assignment.delivery_confirmed_by_shipper:
            raise BusinessLogicError("Cannot modify proof on a completed or shipper-confirmed order.")
        if order.status not in [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]:
            raise BusinessLogicError("Proof of delivery can only be submitted when the order is In Transit or Delivered.")

        serializer = ProofOfDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = order.assignment
        if serializer.validated_data.get("proof_photo"):
            assignment.proof_photo = serializer.validated_data["proof_photo"]
        assignment.proof_note = serializer.validated_data.get("proof_note", "")
        assignment.proof_signature = serializer.validated_data.get("proof_signature", "")

        if order.status == OrderStatus.DELIVERED:
            # Re-upload: overwrite proof only, keep current status
            assignment.save(update_fields=["proof_photo", "proof_note", "proof_signature"])
            return Response({"message": "Delivery proof updated."})

        # First submission: record timestamp and advance status
        assignment.delivered_at = timezone.now()
        assignment.save(update_fields=["proof_photo", "proof_note", "proof_signature", "delivered_at"])
        order.transition_to(OrderStatus.DELIVERED)
        from apps.notifications.tasks import notify_order_status_change
        notify_order_status_change.delay(str(order.id), OrderStatus.DELIVERED)
        return Response({"message": "Proof of delivery submitted. Awaiting shipper confirmation."})


class ConfirmDeliveryView(APIView):
    """
    POST /orders/<id>/confirm-delivery/
    Shipper confirms they received the goods.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk, shipper=request.user)
        if order.status != OrderStatus.DELIVERED:
            raise OrderStateError("Order must be in DELIVERED state to confirm.")
        with transaction.atomic():
            assignment = order.assignment
            assignment.delivery_confirmed_by_shipper = True
            assignment.completed_at = timezone.now()
            assignment.save(update_fields=["delivery_confirmed_by_shipper", "completed_at"])
            order.transition_to(OrderStatus.COMPLETED)
        from apps.notifications.tasks import notify_order_status_change
        notify_order_status_change.delay(str(order.id), OrderStatus.COMPLETED)
        return Response({"message": "Delivery confirmed. Order completed."})


class RateDeliveryView(APIView):
    """
    POST /orders/<id>/rate/
    Mutual rating after delivery completion.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        assignment = order.assignment
        serializer = RateDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rating = serializer.validated_data["rating"]
        review = serializer.validated_data.get("review", "")

        if request.user == order.shipper:
            assignment.shipper_rating = rating
            assignment.shipper_review = review
            assignment.save(update_fields=["shipper_rating", "shipper_review"])
            assignment.driver.driver_profile.update_rating(rating)
        elif request.user == assignment.driver:
            assignment.driver_rating = rating
            assignment.driver_review = review
            assignment.save(update_fields=["driver_rating", "driver_review"])
        else:
            raise BusinessLogicError("You are not a party to this order.")

        return Response({"message": "Rating submitted. Thank you!"})


class PriceEstimateView(APIView):
    """
    POST /orders/estimate-price/
    Stateless offline price estimate — no order required.
    Returns straight-line distance, road-adjusted distance, and XOF price range.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PriceEstimateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from core.pricing import estimate_freight_price
        est = estimate_freight_price(
            cargo_type=d["cargo_type"],
            weight_kg=d["weight_kg"],
            pickup_lat=d["pickup_lat"],
            pickup_lng=d["pickup_lng"],
            delivery_lat=d["delivery_lat"],
            delivery_lng=d["delivery_lng"],
        )
        return Response({
            "straight_distance_km": float(est.straight_distance_km),
            "road_distance_km": float(est.road_distance_km),
            "base_price_xof": int(est.base_price_xof),
            "min_price_xof": int(est.min_price_xof),
            "max_price_xof": int(est.max_price_xof),
            "currency": "XOF",
        })
