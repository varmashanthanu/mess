"""Messaging URLs — /api/v1/messaging/"""
from django.urls import path
from .views import (
    ConversationDetailView,
    ConversationListView,
    ConversationCreateView,
    MessageListCreateView,
    UserSearchView,
)

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="messaging-conversations"),
    path("conversations/create/", ConversationCreateView.as_view(), name="messaging-conversations-create"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="messaging-conversation-detail"),
    path("conversations/<uuid:conversation_pk>/messages/", MessageListCreateView.as_view(), name="messaging-messages"),
    path("users/search/", UserSearchView.as_view(), name="messaging-user-search"),
]
