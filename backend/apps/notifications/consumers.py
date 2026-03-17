"""
MESS Platform — Notifications WebSocket Consumer
One persistent connection per authenticated user.
The server pushes notification objects; the client never sends anything.

Connection: ws://.../ws/notifications/?token=<jwt>
Channel group: notifications_<user_id>
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f"notifications_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Client is read-only — ignore any incoming messages
        pass

    async def notification_message(self, event):
        """Receive a push from channel layer and forward to the WebSocket client."""
        await self.send(text_data=json.dumps({
            "type": "notification",
            "id": event["id"],
            "notification_type": event["notification_type"],
            "title": event["title"],
            "body": event["body"],
            "data": event["data"],
            "is_read": False,
            "created_at": event["created_at"],
        }))
