"""
MESS Platform — Messaging Models
Conversations: per-order, direct (DM), or group (carrier dispatch).
"""
from django.db import models

from core.models import BaseModel


class ConversationType(models.TextChoices):
    ORDER  = "ORDER",  "Order Conversation"
    DIRECT = "DIRECT", "Direct Message"
    GROUP  = "GROUP",  "Group Chat"


class Conversation(BaseModel):
    """A conversation thread — can be tied to an order, a DM pair, or a group."""
    conversation_type = models.CharField(
        max_length=10, choices=ConversationType.choices, default=ConversationType.ORDER
    )
    # Null for DIRECT / GROUP conversations
    order = models.OneToOneField(
        "orders.FreightOrder", on_delete=models.CASCADE, related_name="conversation",
        null=True, blank=True
    )
    # Used as display name for GROUP conversations
    title = models.CharField(max_length=255, blank=True)
    participants = models.ManyToManyField("accounts.User", related_name="conversations")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Conversation"

    def __str__(self):
        if self.order:
            return f"Conversation for order {self.order.reference}"
        return self.title or f"Conversation #{str(self.id)[:8]}"


class Message(BaseModel):
    """A single message in a conversation."""

    class MessageType(models.TextChoices):
        TEXT     = "TEXT",     "Text"
        VOICE    = "VOICE",    "Voice Note"
        IMAGE    = "IMAGE",    "Image"
        DOCUMENT = "DOCUMENT", "Document"
        SYSTEM   = "SYSTEM",   "System Message"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="sent_messages"
    )

    message_type = models.CharField(max_length=10, choices=MessageType.choices, default=MessageType.TEXT)
    content = models.TextField(blank=True)
    file = models.FileField(upload_to="messages/files/", null=True, blank=True)
    file_duration_seconds = models.PositiveIntegerField(null=True, blank=True, help_text="For voice notes")

    # Read receipts
    read_by = models.ManyToManyField("accounts.User", related_name="read_messages", blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Message"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.message_type}] from {self.sender} in {self.conversation}"
