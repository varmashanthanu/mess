"""Messaging URLs — /api/v1/messaging/"""
from django.urls import path
from .views import ConversationDetailView, ConversationListView, MessageListCreateView

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="messaging-conversations"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="messaging-conversation-detail"),
    path("conversations/<uuid:conversation_pk>/messages/", MessageListCreateView.as_view(), name="messaging-messages"),
]
