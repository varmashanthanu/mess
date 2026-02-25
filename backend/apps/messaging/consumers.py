"""
MESS Platform — Messaging WebSocket Consumer
Real-time chat per order conversation.

Connection: ws://.../ws/messaging/<conversation_id>/?token=<jwt>
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class ConversationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]

        # Verify user is a participant
        is_participant = await self._is_participant(user, self.conversation_id)
        if not is_participant:
            await self.close(code=4003)
            return

        self.user = user
        self.group_name = f"conversation_{self.conversation_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            msg_type = data.get("type", "TEXT")
            content = data.get("content", "")
        except (json.JSONDecodeError, KeyError):
            await self.send(text_data=json.dumps({"error": "Invalid payload."}))
            return

        if not content and msg_type == "TEXT":
            return

        # Persist message
        message = await self._save_message(content, msg_type)

        # Broadcast to conversation group
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "message_id": str(message.id),
                "sender_id": str(self.user.id),
                "sender_name": self.user.get_full_name(),
                "message_type": msg_type,
                "content": content,
                "timestamp": message.created_at.isoformat(),
            },
        )

        # Push notification to other participants (offline-safe)
        await self._notify_participants(message)

    async def chat_message(self, event):
        """Receive broadcast and forward to WebSocket client."""
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def _is_participant(self, user, conversation_id):
        from .models import Conversation
        return Conversation.objects.filter(
            id=conversation_id, participants=user
        ).exists()

    @database_sync_to_async
    def _save_message(self, content, msg_type):
        from .models import Conversation, Message
        conversation = Conversation.objects.get(id=self.conversation_id)
        return Message.objects.create(
            conversation=conversation,
            sender=self.user,
            message_type=msg_type,
            content=content,
        )

    @database_sync_to_async
    def _notify_participants(self, message):
        from apps.notifications.tasks import send_notification_task
        other_participants = message.conversation.participants.exclude(id=self.user.id)
        for participant in other_participants:
            send_notification_task.delay(
                user_id=str(participant.id),
                title=f"Message from {self.user.get_full_name()}",
                body=message.content[:100] if message.message_type == "TEXT" else "📎 Media message",
                data={
                    "type": "NEW_MESSAGE",
                    "conversation_id": str(self.conversation_id),
                    "message_id": str(message.id),
                },
            )
