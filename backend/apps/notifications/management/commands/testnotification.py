"""
Management command to send a test notification to a user and push it via WebSocket.
Useful for verifying the full notification pipeline end-to-end.

Usage:
    ./manage.py testnotification                       # sends to Mess Driver
    ./manage.py testnotification --phone +221771234570
    ./manage.py testnotification --phone +221771234566 --title "Hello" --body "Test msg"
"""
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Send a test notification to a user and push it over WebSocket."

    def add_arguments(self, parser):
        parser.add_argument(
            "--phone",
            default="+221771234570",  # Mess Driver
            help="Phone number of recipient (default: Mess Driver +221771234570)",
        )
        parser.add_argument(
            "--title",
            default="Test Notification",
            help="Notification title",
        )
        parser.add_argument(
            "--body",
            default="This is a real-time WebSocket test notification from the backend.",
            help="Notification body text",
        )

    def handle(self, *args, **options):
        phone = options["phone"]
        title = options["title"]
        body = options["body"]

        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            raise CommandError(f"No user found with phone number: {phone}")

        self.stdout.write(f"Sending notification to: {user.full_name} (id={user.id}, role={user.role})")

        # Import here to avoid app loading issues
        from apps.notifications.models import Notification
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        # 1) Persist the notification in the DB
        notification = Notification.objects.create(
            user=user,
            notification_type="SYSTEM",
            title=title,
            body=body,
            data={"type": "SYSTEM", "source": "testnotification_command"},
        )
        self.stdout.write(self.style.SUCCESS(f"  Created notification id={notification.id}"))

        # 2) Push to WebSocket channel layer
        channel_layer = get_channel_layer()
        if not channel_layer:
            self.stdout.write(self.style.WARNING("  No channel layer configured — WebSocket push skipped."))
            return

        group_name = f"notifications_{user.id}"
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "notification.message",
                    "id": str(notification.id),
                    "notification_type": notification.notification_type,
                    "title": notification.title,
                    "body": notification.body,
                    "data": notification.data,
                    "created_at": notification.created_at.isoformat(),
                },
            )
            self.stdout.write(self.style.SUCCESS(
                f"  Pushed to channel group '{group_name}'\n"
                f"  If {user.full_name} is connected via WebSocket, the notification should appear instantly."
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  WebSocket push failed: {e}"))
            self.stdout.write("  Is Redis running and the channel layer configured correctly?")
