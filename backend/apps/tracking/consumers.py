"""
MESS Platform — Tracking WebSocket Consumer
Drivers stream GPS updates; shippers/admins subscribe to order tracking.

Connection URL patterns:
  Driver sends location:   ws://.../ws/tracking/driver/
  Shipper watches order:   ws://.../ws/tracking/order/<order_id>/
"""
import json
import logging
from decimal import Decimal

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

logger = logging.getLogger(__name__)


class DriverLocationConsumer(AsyncWebsocketConsumer):
    """
    Drivers connect here to stream their GPS location.
    Each update is:
    1. Saved to the database (GPSPing)
    2. Broadcast to the order's tracking channel group
    3. Updates the driver's current location on their profile
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated or not user.is_driver:
            await self.close(code=4001)
            return

        self.driver = user
        self.group_name = f"driver_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Driver {user.id} connected to location stream.")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            # Mark driver offline on disconnect
            await self._set_driver_offline()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            lat = float(data["lat"])
            lng = float(data["lng"])
            order_id = data.get("order_id")
            accuracy = data.get("accuracy")
            speed = data.get("speed")
            bearing = data.get("bearing")
        except (KeyError, ValueError, TypeError) as e:
            await self.send(text_data=json.dumps({"error": f"Invalid payload: {e}"}))
            return

        # Persist ping
        ping = await self._save_ping(lat, lng, order_id, accuracy, speed, bearing)

        # Update driver's current location in profile
        await self._update_driver_location(lat, lng)

        # Broadcast to order channel if this ping is for an active order
        if order_id:
            await self.channel_layer.group_send(
                f"order_tracking_{order_id}",
                {
                    "type": "location_update",
                    "driver_id": str(self.driver.id),
                    "driver_name": self.driver.get_full_name(),
                    "lat": lat,
                    "lng": lng,
                    "speed": speed,
                    "bearing": bearing,
                    "timestamp": ping.timestamp.isoformat(),
                },
            )

        await self.send(text_data=json.dumps({"status": "ok", "timestamp": ping.timestamp.isoformat()}))

    @database_sync_to_async
    def _save_ping(self, lat, lng, order_id, accuracy, speed, bearing):
        from .models import GPSPing
        return GPSPing.objects.create(
            driver=self.driver,
            order_id=order_id,
            lat=Decimal(str(lat)),
            lng=Decimal(str(lng)),
            accuracy_m=Decimal(str(accuracy)) if accuracy else None,
            speed_kmh=Decimal(str(speed)) if speed else None,
            bearing=Decimal(str(bearing)) if bearing else None,
            timestamp=timezone.now(),
        )

    @database_sync_to_async
    def _update_driver_location(self, lat, lng):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            profile = self.driver.driver_profile
            profile.current_lat = Decimal(str(lat))
            profile.current_lng = Decimal(str(lng))
            profile.last_location_update = timezone.now()
            profile.save(update_fields=["current_lat", "current_lng", "last_location_update"])
        except Exception:
            pass

    @database_sync_to_async
    def _set_driver_offline(self):
        try:
            profile = self.driver.driver_profile
            profile.is_available = False
            profile.save(update_fields=["is_available"])
        except Exception:
            pass


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    """
    Shippers and admins subscribe to real-time location updates for a specific order.
    Receives broadcast messages from DriverLocationConsumer.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.order_id = self.scope["url_route"]["kwargs"]["order_id"]

        # Verify user has access to this order
        has_access = await self._check_access(user, self.order_id)
        if not has_access:
            await self.close(code=4003)
            return

        self.group_name = f"order_tracking_{self.order_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Receive broadcast from DriverLocationConsumer
    async def location_update(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def _check_access(self, user, order_id):
        from apps.orders.models import FreightOrder
        try:
            order = FreightOrder.objects.get(id=order_id)
            if user.role == "ADMIN":
                return True
            if order.shipper == user:
                return True
            if hasattr(order, "assignment") and order.assignment.driver == user:
                return True
            return False
        except FreightOrder.DoesNotExist:
            return False
