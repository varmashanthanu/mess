"""
MESS Platform — WebSocket JWT Auth Middleware
Authenticates WebSocket connections using JWT from query string or headers.
"""
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken


@database_sync_to_async
def get_user_from_token(token_key):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        UntypedToken(token_key)
        from rest_framework_simplejwt.backends import TokenBackend
        from django.conf import settings
        data = TokenBackend(
            algorithm=settings.SIMPLE_JWT.get("ALGORITHM", "HS256"),
            signing_key=settings.SECRET_KEY,
        ).decode(token_key, verify=True)
        user_id = data.get("user_id")
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist, Exception):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT authentication for WebSocket connections.
    Clients connect as: ws://host/ws/.../?token=<jwt>
    """

    async def __call__(self, scope, receive, send):
        from urllib.parse import parse_qs
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_list = params.get("token", [])

        if token_list:
            scope["user"] = await get_user_from_token(token_list[0])
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)
