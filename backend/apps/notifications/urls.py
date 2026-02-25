"""Notifications URLs — /api/v1/notifications/"""
from django.urls import path
from .views import MarkAllReadView, MarkReadView, NotificationListView, NotificationPreferenceView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("mark-all-read/", MarkAllReadView.as_view(), name="notifications-mark-all-read"),
    path("<uuid:pk>/read/", MarkReadView.as_view(), name="notifications-mark-read"),
    path("preferences/", NotificationPreferenceView.as_view(), name="notifications-preferences"),
]
