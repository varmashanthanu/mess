from django.contrib import admin
from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["order", "is_active", "created_at"]
    filter_horizontal = ["participants"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["conversation", "sender", "message_type", "created_at"]
    list_filter = ["message_type"]
    search_fields = ["content", "sender__phone_number"]
