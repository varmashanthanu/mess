"""
MESS Platform — Orders Models
Core freight order lifecycle: DRAFT → POSTED → BIDDING → ASSIGNED →
IN_TRANSIT → DELIVERED → COMPLETED
"""
from django.db import models
from django.utils import timezone

from core.models import BaseModel
from core.utils import generate_order_reference


class CargoType(models.TextChoices):
    GENERAL = "GENERAL", "General / Mixed"
    FRAGILE = "FRAGILE", "Fragile Goods"
    HAZARDOUS = "HAZARDOUS", "Hazardous Materials"
    LIVESTOCK = "LIVESTOCK", "Livestock"
    REFRIGERATED = "REFRIGERATED", "Refrigerated / Perishable"
    BULK = "BULK", "Bulk / Agricultural"
    CONSTRUCTION = "CONSTRUCTION", "Construction Materials"
    ELECTRONICS = "ELECTRONICS", "Electronics"


class OrderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    POSTED = "POSTED", "Posted — Awaiting Carriers"
    BIDDING = "BIDDING", "Receiving Bids"
    ASSIGNED = "ASSIGNED", "Carrier Assigned"
    PICKUP_PENDING = "PICKUP_PENDING", "Driver En Route to Pickup"
    PICKED_UP = "PICKED_UP", "Cargo Picked Up"
    IN_TRANSIT = "IN_TRANSIT", "In Transit"
    DELIVERED = "DELIVERED", "Delivered — Awaiting Confirmation"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    DISPUTED = "DISPUTED", "Disputed"


# States where the order is still actionable
ACTIVE_ORDER_STATUSES = [
    OrderStatus.POSTED, OrderStatus.BIDDING, OrderStatus.ASSIGNED,
    OrderStatus.PICKUP_PENDING, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
]

# Valid transitions map: current_state → allowed_next_states
ORDER_TRANSITIONS = {
    OrderStatus.DRAFT: [OrderStatus.POSTED, OrderStatus.CANCELLED],
    OrderStatus.POSTED: [OrderStatus.BIDDING, OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
    OrderStatus.BIDDING: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
    OrderStatus.ASSIGNED: [OrderStatus.PICKUP_PENDING, OrderStatus.CANCELLED],
    OrderStatus.PICKUP_PENDING: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    OrderStatus.PICKED_UP: [OrderStatus.IN_TRANSIT],
    OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
    OrderStatus.DELIVERED: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
    OrderStatus.COMPLETED: [],
    OrderStatus.CANCELLED: [],
    OrderStatus.DISPUTED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
}


class FreightOrder(BaseModel):
    """The central entity — a request to move cargo from A to B."""

    # Parties
    shipper = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT,
        related_name="orders_as_shipper"
    )
    broker = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders_as_broker"
    )

    # Reference
    reference = models.CharField(
        max_length=20, unique=True, editable=False, db_index=True
    )

    # Cargo
    cargo_type = models.CharField(max_length=20, choices=CargoType.choices, default=CargoType.GENERAL)
    cargo_description = models.TextField()
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    volume_m3 = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    special_instructions = models.TextField(blank=True)
    cargo_photos = models.JSONField(default=list, blank=True)  # List of media URLs

    # Pickup
    pickup_address = models.TextField()
    pickup_city = models.CharField(max_length=100, default="Dakar")
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_contact_name = models.CharField(max_length=100, blank=True)
    pickup_contact_phone = models.CharField(max_length=20, blank=True)
    pickup_scheduled_at = models.DateTimeField(null=True, blank=True)

    # Delivery
    delivery_address = models.TextField()
    delivery_city = models.CharField(max_length=100)
    delivery_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_contact_name = models.CharField(max_length=100, blank=True)
    delivery_contact_phone = models.CharField(max_length=20, blank=True)
    delivery_deadline = models.DateTimeField(null=True, blank=True)

    # Vehicle requirements
    required_vehicle_type = models.ForeignKey(
        "fleet.VehicleType", on_delete=models.SET_NULL, null=True, blank=True
    )

    # Pricing (in XOF — CFA Franc)
    proposed_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    final_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="XOF")

    # Status
    status = models.CharField(
        max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT, db_index=True
    )
    status_changed_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    # Distance estimate (km) — computed on creation
    estimated_distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Freight Order"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["shipper", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.pickup_city} → {self.delivery_city} [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = generate_order_reference()
        super().save(*args, **kwargs)

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in ORDER_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: str, save: bool = True):
        from core.exceptions import OrderStateError
        if not self.can_transition_to(new_status):
            raise OrderStateError(
                f"Cannot transition from '{self.status}' to '{new_status}'."
            )
        self.status = new_status
        self.status_changed_at = timezone.now()
        if save:
            self.save(update_fields=["status", "status_changed_at"])


class OrderBid(BaseModel):
    """A carrier's bid on a posted order."""

    class BidStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"

    order = models.ForeignKey(FreightOrder, on_delete=models.CASCADE, related_name="bids")
    carrier = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="bids_placed"
    )
    vehicle = models.ForeignKey(
        "fleet.Vehicle", on_delete=models.SET_NULL, null=True, blank=True
    )
    price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Bid price in XOF")
    message = models.TextField(blank=True)
    estimated_pickup_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=BidStatus.choices, default=BidStatus.PENDING)

    class Meta:
        verbose_name = "Order Bid"
        unique_together = [("order", "carrier")]  # One bid per carrier per order
        ordering = ["price", "-created_at"]

    def __str__(self):
        return f"Bid by {self.carrier} on {self.order.reference}: {self.price} XOF"


class OrderAssignment(BaseModel):
    """When an order is accepted and a driver is assigned."""

    order = models.OneToOneField(FreightOrder, on_delete=models.PROTECT, related_name="assignment")
    driver = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="assignments_as_driver"
    )
    vehicle = models.ForeignKey("fleet.Vehicle", on_delete=models.PROTECT)
    accepted_bid = models.OneToOneField(
        OrderBid, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Timestamps for the delivery lifecycle
    assigned_at = models.DateTimeField(auto_now_add=True)
    driver_en_route_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    in_transit_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Proof of delivery
    proof_photo = models.ImageField(upload_to="proof_of_delivery/", null=True, blank=True)
    proof_note = models.TextField(blank=True)
    proof_signature = models.TextField(blank=True, help_text="Base64 signature or name")
    delivery_confirmed_by_shipper = models.BooleanField(default=False)

    # Rating
    shipper_rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1–5")
    driver_rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1–5")
    shipper_review = models.TextField(blank=True)
    driver_review = models.TextField(blank=True)

    class Meta:
        verbose_name = "Order Assignment"

    def __str__(self):
        return f"Assignment: {self.order.reference} → Driver {self.driver}"
