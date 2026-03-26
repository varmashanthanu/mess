"""
Tests for the FreightOrder state machine.
Validates all valid transitions and rejects all invalid ones.
"""
import pytest
from core.exceptions import OrderStateError
from apps.orders.models import FreightOrder, ORDER_TRANSITIONS, OrderStatus


@pytest.mark.django_db
class TestOrderStateMachine:

    def test_all_valid_transitions_succeed(self, draft_order):
        """Walk through the happy-path lifecycle."""
        order = draft_order

        order.transition_to(OrderStatus.POSTED)
        assert order.status == OrderStatus.POSTED
        assert order.status_changed_at is not None

        order.transition_to(OrderStatus.ASSIGNED)
        assert order.status == OrderStatus.ASSIGNED

        order.transition_to(OrderStatus.PICKUP_PENDING)
        assert order.status == OrderStatus.PICKUP_PENDING

        order.transition_to(OrderStatus.PICKED_UP)
        assert order.status == OrderStatus.PICKED_UP

        order.transition_to(OrderStatus.IN_TRANSIT)
        assert order.status == OrderStatus.IN_TRANSIT

        order.transition_to(OrderStatus.DELIVERED)
        assert order.status == OrderStatus.DELIVERED

        order.transition_to(OrderStatus.COMPLETED)
        assert order.status == OrderStatus.COMPLETED

    def test_invalid_transition_raises_order_state_error(self, draft_order):
        with pytest.raises(OrderStateError):
            draft_order.transition_to(OrderStatus.COMPLETED)

    def test_cannot_go_backward(self, posted_order):
        with pytest.raises(OrderStateError):
            posted_order.transition_to(OrderStatus.DRAFT)

    def test_can_cancel_from_posted(self, posted_order):
        posted_order.transition_to(OrderStatus.CANCELLED)
        assert posted_order.status == OrderStatus.CANCELLED

    def test_can_cancel_from_assigned(self, accepted_order):
        accepted_order.transition_to(OrderStatus.CANCELLED)
        assert accepted_order.status == OrderStatus.CANCELLED

    def test_cannot_cancel_from_completed(self, draft_order):
        draft_order.status = OrderStatus.COMPLETED
        draft_order.save(update_fields=["status"])
        with pytest.raises(OrderStateError):
            draft_order.transition_to(OrderStatus.CANCELLED)

    def test_disputed_from_in_transit(self, draft_order):
        draft_order.status = OrderStatus.IN_TRANSIT
        draft_order.save(update_fields=["status"])
        draft_order.transition_to(OrderStatus.DISPUTED)
        assert draft_order.status == OrderStatus.DISPUTED

    def test_disputed_can_resolve_to_completed(self, draft_order):
        draft_order.status = OrderStatus.DISPUTED
        draft_order.save(update_fields=["status"])
        draft_order.transition_to(OrderStatus.COMPLETED)
        assert draft_order.status == OrderStatus.COMPLETED

    def test_disputed_can_resolve_to_cancelled(self, draft_order):
        draft_order.status = OrderStatus.DISPUTED
        draft_order.save(update_fields=["status"])
        draft_order.transition_to(OrderStatus.CANCELLED)
        assert draft_order.status == OrderStatus.CANCELLED

    def test_can_bid_check(self, draft_order):
        assert not draft_order.can_transition_to(OrderStatus.COMPLETED)
        assert draft_order.can_transition_to(OrderStatus.POSTED)

    def test_status_changed_at_is_updated(self, draft_order):
        assert draft_order.status_changed_at is None
        draft_order.transition_to(OrderStatus.POSTED)
        assert draft_order.status_changed_at is not None

    def test_transitions_map_is_exhaustive(self):
        """Every OrderStatus value must appear as a key in ORDER_TRANSITIONS."""
        for status in OrderStatus:
            assert status in ORDER_TRANSITIONS, f"Missing transitions for status: {status}"

    def test_terminal_states_have_no_transitions(self):
        """COMPLETED and CANCELLED are terminal — no outgoing transitions."""
        assert ORDER_TRANSITIONS[OrderStatus.COMPLETED] == []
        assert ORDER_TRANSITIONS[OrderStatus.CANCELLED] == []


@pytest.mark.django_db
class TestFreightOrderModel:
    def test_reference_auto_generated(self, draft_order):
        assert draft_order.reference.startswith("MESS-")
        assert len(draft_order.reference) == len("MESS-") + 5

    def test_reference_is_unique(self, shipper, vehicle_type):
        from apps.orders.models import FreightOrder, OrderStatus
        order1 = FreightOrder.objects.create(
            shipper=shipper,
            cargo_type="GENERAL",
            cargo_description="Test",
            weight_kg=100,
            pickup_address="A",
            pickup_city="Dakar",
            delivery_address="B",
            delivery_city="Thiès",
            status=OrderStatus.DRAFT,
        )
        order2 = FreightOrder.objects.create(
            shipper=shipper,
            cargo_type="GENERAL",
            cargo_description="Test 2",
            weight_kg=200,
            pickup_address="A",
            pickup_city="Dakar",
            delivery_address="B",
            delivery_city="Thiès",
            status=OrderStatus.DRAFT,
        )
        assert order1.reference != order2.reference

    def test_str_representation(self, draft_order):
        s = str(draft_order)
        assert draft_order.reference in s
        assert "Dakar" in s
        assert "Thiès" in s
