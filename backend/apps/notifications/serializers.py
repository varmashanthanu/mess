"""Notifications Serializers"""
from rest_framework import serializers
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "notification_type", "title", "body", "data", "is_read", "read_at", "created_at"]
        read_only_fields = ["id", "notification_type", "title", "body", "data", "created_at"]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["push_enabled", "sms_enabled", "email_enabled", "order_updates", "payment_updates", "marketing"]
