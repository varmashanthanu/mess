"""Messaging REST Views"""
from django.db import models as django_models
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationListView(generics.ListAPIView):
    """List all conversations for the current user, grouped by type."""
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related("participants", "messages").order_by("-updated_at")
        conv_type = self.request.query_params.get("type")
        if conv_type:
            qs = qs.filter(conversation_type=conv_type.upper())
        return qs


class ConversationCreateView(APIView):
    """Create a DIRECT or GROUP conversation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.accounts.models import User
        conv_type = request.data.get("conversation_type", "DIRECT").upper()
        participant_ids = request.data.get("participant_ids", [])
        title = request.data.get("title", "")

        if conv_type not in ("DIRECT", "GROUP"):
            return Response({"detail": "conversation_type must be DIRECT or GROUP."}, status=400)

        # For DIRECT: check if a DM already exists between these two users
        if conv_type == "DIRECT" and len(participant_ids) == 1:
            other_id = participant_ids[0]
            existing = Conversation.objects.filter(
                conversation_type="DIRECT",
                participants=request.user,
            ).filter(participants=other_id).first()
            if existing:
                serializer = ConversationSerializer(existing, context={"request": request})
                return Response(serializer.data)

        participants = list(User.objects.filter(id__in=participant_ids))
        if not participants:
            return Response({"detail": "No valid participant_ids provided."}, status=400)

        conversation = Conversation.objects.create(
            conversation_type=conv_type,
            title=title,
        )
        conversation.participants.add(request.user, *participants)
        serializer = ConversationSerializer(conversation, context={"request": request})
        return Response(serializer.data, status=201)


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
        qs = Message.objects.filter(
            conversation_id=conv_id,
            conversation__participants=self.request.user,
        ).select_related("sender").order_by("created_at")
        for msg in qs.exclude(sender=self.request.user).exclude(read_by=self.request.user):
            msg.read_by.add(self.request.user)
        return qs

    def perform_create(self, serializer):
        conv_id = self.kwargs["conversation_pk"]
        conversation = Conversation.objects.get(
            id=conv_id, participants=self.request.user
        )
        serializer.save(sender=self.request.user, conversation=conversation)


class UserSearchView(APIView):
    """Search users by name or phone to start a direct conversation."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserBasicSerializer
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        users = User.objects.filter(
            django_models.Q(first_name__icontains=q) |
            django_models.Q(last_name__icontains=q) |
            django_models.Q(phone_number__icontains=q)
        ).exclude(id=request.user.id)[:10]
        data = UserBasicSerializer(users, many=True).data
        return Response(data)
