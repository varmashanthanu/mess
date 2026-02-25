"""
MESS Platform — Orders Views
Handles the full freight order lifecycle.
"""
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import BusinessLogicError, OrderStateError
from core.permissions import IsAdmin, IsCarrier, IsShipperOrBroker
from .models import (
    ACTIVE_ORDER_STATUSES,
    FreightOrder,
    OrderAssignment,
    OrderBid,
    OrderStatus,
)
from .serializers import (
    AcceptBidSerializer,
    FreightOrderDetailSerializer,
    FreightOrderListSerializer,
    OrderBidSerializer,
    OrderStatusTransitionSerializer,
    ProofOfDeliverySerializer,
    RateDeliverySerializer,
)

logger = logging.getLogger(__name__)


class FreightOrderListCreateView(generics.ListCreateAPIView):
    """
    GET  — List orders (role-filtered)
    POST — Create a new freight order (shippers/brokers only)
    """
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "cargo_type", "pickup_city", "delivery_city"]
    search_fields = ["reference", "cargo_description", "pickup_address", "delivery_address"]
    ordering_fields = ["created_at", "pickup_scheduled_at", "proposed_price"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FreightOrderDetailSerializer
        return FreightOrderListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = FreightOrder.objects.select_related(
            "shipper", "required_vehicle_type"
        ).prefetch_related("bids")

        if user.role in ["SHIPPER", "BROKER"]:
            return qs.filter(shipper=user)
        if user.role in ["DRIVER", "FLEET_MANAGER"]:
            # Drivers see posted/bidding orders + their own assigned ones
            return qs.filter(
                status__in=[OrderStatus.POSTED, OrderStatus.BIDDING]
            ) | qs.filter(assignment__driver=user)
        if user.role == "ADMIN":
            return qs.all()
        return qs.none()

    def perform_create(self, serializer):
        if self.request.user.role not in ["SHIPPER", "BROKER"]:
            raise BusinessLogicError("Only shippers and brokers can create orders.")
        serializer.save(shipper=self.request.user)


class FreightOrderDetailView(generics.RetrieveUpdateAPIView):
    """Get or update a specific freight order."""
    serializer_class = FreightOrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FreightOrder.objects.select_related(
            "shipper", "broker", "required_vehicle_type", "assignment__driver", "assignment__vehicle"
        ).prefetch_related("bids__carrier", "bids__vehicle")

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


class BidListCreateView(generics.ListCreateAPIView):
    """List bids on an order / place a new bid."""
    serializer_class = OrderBidSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        order_id = self.kwargs["order_pk"]
        return OrderBid.objects.filter(order_id=order_id).select_related("carrier", "vehicle")

    def perform_create(self, serializer):
        order_id = self.kwargs["order_pk"]
        order = FreightOrder.objects.get(id=order_id)
        if order.status not in [OrderStatus.POSTED, OrderStatus.BIDDING]:
            raise BusinessLogicError("This order is not accepting bids.")
        # Transition to BIDDING if first bid
        if order.status == OrderStatus.POSTED:
            order.transition_to(OrderStatus.BIDDING)
        serializer.save(order=order, carrier=self.request.user)


class AcceptBidView(APIView):
    """
    POST /orders/<id>/accept-bid/
    Shipper accepts a bid → assigns driver.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk, shipper=request.user)
        serializer = AcceptBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            bid = OrderBid.objects.select_for_update().get(
                id=serializer.validated_data["bid_id"],
                order=order,
                status=OrderBid.BidStatus.PENDING,
            )
            # Reject all other bids
            OrderBid.objects.filter(order=order).exclude(id=bid.id).update(
                status=OrderBid.BidStatus.REJECTED
            )
            bid.status = OrderBid.BidStatus.ACCEPTED
            bid.save()

            order.final_price = bid.price
            order.transition_to(OrderStatus.ASSIGNED, save=False)
            order.save(update_fields=["final_price", "status", "status_changed_at"])

            OrderAssignment.objects.create(
                order=order,
                driver=bid.carrier,
                vehicle=bid.vehicle,
                accepted_bid=bid,
            )

        from apps.notifications.tasks import notify_bid_accepted
        notify_bid_accepted.delay(str(bid.id))
        return Response({"message": "Bid accepted. Driver assigned.", "status": order.status})


class ProofOfDeliveryView(APIView):
    """
    POST /orders/<id>/proof-of-delivery/
    Driver submits proof (photo, note, signature).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = FreightOrder.objects.get(pk=pk)
        if not hasattr(order, "assignment") or order.assignment.driver != request.user:
            raise BusinessLogicError("Only the assigned driver can submit proof of delivery.")

        serializer = ProofOfDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = order.assignment
        if serializer.validated_data.get("proof_photo"):
            assignment.proof_photo = serializer.validated_data["proof_photo"]
        assignment.proof_note = serializer.validated_data.get("proof_note", "")
        assignment.proof_signature = serializer.validated_data.get("proof_signature", "")
        assignment.delivered_at = timezone.now()
        assignment.save()

        order.transition_to(OrderStatus.DELIVERED)
        return Response({"message": "Proof of delivery submitted."})


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
            # Update driver's rating
            assignment.driver.driver_profile.update_rating(rating)
        elif request.user == assignment.driver:
            assignment.driver_rating = rating
            assignment.driver_review = review
            assignment.save(update_fields=["driver_rating", "driver_review"])
        else:
            raise BusinessLogicError("You are not a party to this order.")

        return Response({"message": "Rating submitted. Thank you!"})
