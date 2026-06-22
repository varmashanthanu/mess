"""Messaging Serializers"""
from rest_framework import serializers
from apps.accounts.serializers import UserBasicSerializer
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_detail = UserBasicSerializer(source="sender", read_only=True)
    is_read = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    file = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender", "sender_detail", "sender_name",
            "message_type", "content", "file", "file_duration_seconds",
            "is_read", "created_at",
        ]
        read_only_fields = ["id", "sender", "conversation", "created_at"]

    def get_file(self, obj):
        # Return relative URL (/media/...) so the Angular proxy can serve it
        # DRF default uses request.build_absolute_uri → returns http://backend:8000/... (unreachable from browser)
        if obj.file:
            return obj.file.url
        return None

    def get_is_read(self, obj):
        request = self.context.get("request")
        if request:
            return obj.read_by.filter(id=request.user.id).exists()
        return False

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.full_name or obj.sender.phone_number
        return "Système"


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserBasicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    order_reference = serializers.SerializerMethodField()
    display_title = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id", "conversation_type", "order", "order_reference", "title", "display_title",
            "participants", "is_active", "last_message", "unread_count", "created_at",
        ]
        read_only_fields = ["id", "order", "participants", "created_at"]

    def get_order_reference(self, obj):
        if obj.order:
            return obj.order.reference
        return None

    def get_display_title(self, obj):
        """Human-readable title shown in conversation list."""
        if obj.conversation_type == "ORDER" and obj.order:
            return obj.order.reference
        if obj.conversation_type == "GROUP":
            return obj.title or "Groupe"
        # DIRECT: show the other participant's name
        request = self.context.get("request")
        if request and obj.conversation_type == "DIRECT":
            other = obj.participants.exclude(id=request.user.id).first()
            if other:
                return other.full_name or str(other.phone_number)
        return obj.title or "Conversation"

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if last:
            return MessageSerializer(last, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request:
            return 0
        return obj.messages.exclude(read_by=request.user).exclude(sender=request.user).count()
