"""Messaging Serializers"""
from rest_framework import serializers
from apps.accounts.serializers import UserBasicSerializer
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_detail = UserBasicSerializer(source="sender", read_only=True)
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender", "sender_detail",
            "message_type", "content", "file", "file_duration_seconds",
            "is_read", "created_at",
        ]
        read_only_fields = ["id", "sender", "created_at"]

    def get_is_read(self, obj):
        request = self.context.get("request")
        if request:
            return obj.read_by.filter(id=request.user.id).exists()
        return False


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserBasicSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "order", "participants", "is_active", "last_message", "unread_count", "created_at"]
        read_only_fields = ["id", "order", "participants", "created_at"]

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
