"""
Tests for messaging: Conversation and Message models + API.
"""
import pytest

from apps.messaging.models import Conversation, Message


@pytest.mark.django_db
class TestConversation:
    def test_create_conversation(self, posted_order, shipper, driver):
        convo = Conversation.objects.create(order=posted_order)
        convo.participants.add(shipper, driver)
        assert convo.participants.count() == 2

    def test_conversation_str(self, posted_order):
        convo = Conversation.objects.create(order=posted_order)
        assert posted_order.reference in str(convo)

    def test_one_conversation_per_order(self, posted_order):
        Conversation.objects.create(order=posted_order)
        with pytest.raises(Exception):
            Conversation.objects.create(order=posted_order)


@pytest.mark.django_db
class TestMessage:
    @pytest.fixture
    def conversation(self, posted_order, shipper, driver):
        convo = Conversation.objects.create(order=posted_order)
        convo.participants.add(shipper, driver)
        return convo

    def test_create_text_message(self, conversation, shipper):
        msg = Message.objects.create(
            conversation=conversation,
            sender=shipper,
            message_type=Message.MessageType.TEXT,
            content="Is the cargo ready?",
        )
        assert msg.id is not None
        assert msg.content == "Is the cargo ready?"

    def test_message_str(self, conversation, shipper):
        msg = Message.objects.create(
            conversation=conversation,
            sender=shipper,
            content="Hello",
        )
        s = str(msg)
        assert "TEXT" in s

    def test_messages_ordered_by_created_at_asc(self, conversation, shipper, driver):
        m1 = Message.objects.create(conversation=conversation, sender=shipper, content="First")
        m2 = Message.objects.create(conversation=conversation, sender=driver, content="Second")
        messages = list(Message.objects.filter(conversation=conversation))
        assert messages[0].id == m1.id
        assert messages[1].id == m2.id

    def test_system_message_has_no_sender(self, conversation):
        msg = Message.objects.create(
            conversation=conversation,
            sender=None,
            message_type=Message.MessageType.SYSTEM,
            content="Order status updated to IN_TRANSIT.",
        )
        assert msg.sender is None

    def test_read_receipt(self, conversation, shipper, driver):
        msg = Message.objects.create(
            conversation=conversation,
            sender=shipper,
            content="Received the goods?",
        )
        msg.read_by.add(driver)
        assert driver in msg.read_by.all()
        assert shipper not in msg.read_by.all()
