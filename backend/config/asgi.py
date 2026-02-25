"""
MESS Platform — ASGI Configuration
Handles both HTTP (via Django) and WebSocket (via Channels) connections.
"""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

# Must be called before importing routing modules
django_asgi_app = get_asgi_application()

from apps.messaging.routing import websocket_urlpatterns as messaging_ws  # noqa
from apps.tracking.routing import websocket_urlpatterns as tracking_ws  # noqa
from core.middleware import JWTAuthMiddleware  # noqa

websocket_urlpatterns = tracking_ws + messaging_ws

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddleware(
                URLRouter(websocket_urlpatterns)
            )
        ),
    }
)
