"""Tracking WebSocket URL routing."""
from django.urls import re_path
from .consumers import DriverLocationConsumer, OrderTrackingConsumer

websocket_urlpatterns = [
    re_path(r"ws/tracking/driver/$", DriverLocationConsumer.as_asgi()),
    re_path(r"ws/tracking/order/(?P<order_id>[0-9a-f-]+)/$", OrderTrackingConsumer.as_asgi()),
]
