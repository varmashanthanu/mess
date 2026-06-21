"""
Django signal: inject SYSTEM messages into order conversation on status change.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# French status messages shown in the conversation thread
STATUS_MESSAGES = {
    "POSTED":         "📢 Commande publiée et disponible pour les transporteurs.",
    "ASSIGNED":       "✅ Un transporteur a été assigné à cette commande.",
    "PICKUP_PENDING": "🕐 Le chauffeur est en route pour la collecte.",
    "PICKED_UP":      "📦 Marchandise collectée avec succès.",
    "IN_TRANSIT":     "🚚 La commande est en route vers la destination.",
    "DELIVERED":      "📍 Commande livrée. En attente de confirmation.",
    "COMPLETED":      "✅ Commande complétée avec succès. Merci !",
    "DISPUTED":       "⚠️ Un litige a été ouvert sur cette commande.",
    "CANCELLED":      "❌ Cette commande a été annulée.",
}


@receiver(post_save, sender="orders.FreightOrder")
def inject_system_message_on_status_change(sender, instance, created, update_fields, **kwargs):
    """Auto-inject a SYSTEM message when an order's status changes."""
    if created:
        return
    # Only fire when status field was updated
    if update_fields is not None and "status" not in update_fields:
        return

    content = STATUS_MESSAGES.get(instance.status)
    if not content:
        return

    # Get conversation (may not exist yet)
    try:
        conversation = instance.conversation
    except Exception:
        return

    from apps.messaging.models import Message
    message = Message.objects.create(
        conversation=conversation,
        sender=None,
        message_type="SYSTEM",
        content=content,
    )

    # Push live via WebSocket channel layer
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"conversation_{conversation.id}",
                {
                    "type": "chat_message",
                    "message_id": str(message.id),
                    "sender_id": None,
                    "sender_name": "Système",
                    "message_type": "SYSTEM",
                    "content": content,
                    "timestamp": message.created_at.isoformat(),
                },
            )
    except Exception as exc:
        logger.warning("Could not push system message via WebSocket: %s", exc)
