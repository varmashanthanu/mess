"""Messaging REST Views"""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationListView(generics.ListAPIView):
    """List all conversations for the current user."""
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related("participants", "messages").order_by("-updated_at")


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)


class MessageListCreateView(generics.ListCreateAPIView):
    """Get or send messages in a conversation."""
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        conv_id = self.kwargs["conversation_pk"]
        # Mark messages as read when fetched
        qs = Message.objects.filter(
            conversation_id=conv_id,
            conversation__participants=self.request.user,
        ).select_related("sender").order_by("created_at")
        # Bulk mark as read
        for msg in qs.exclude(sender=self.request.user).exclude(read_by=self.request.user):
            msg.read_by.add(self.request.user)
        return qs

    def perform_create(self, serializer):
        conv_id = self.kwargs["conversation_pk"]
        conversation = Conversation.objects.get(
            id=conv_id, participants=self.request.user
        )
        serializer.save(sender=self.request.user, conversation=conversation)
