"""
MESS Platform — Celery Application
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

app = Celery("mess")

# Load config from Django settings, namespace CELERY_
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()

# ── Periodic tasks (crontab) ─────────────────────────────────────
app.conf.beat_schedule = {
    # Cancel unassigned orders older than 24 hours
    "cancel-stale-orders": {
        "task": "apps.orders.tasks.cancel_stale_orders",
        "schedule": crontab(minute=0, hour="*/6"),  # every 6h
    },
    # Expire pending payment transactions older than 1 hour
    "expire-pending-payments": {
        "task": "apps.payments.tasks.expire_pending_payments",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    # Send daily summary to admin
    "daily-admin-summary": {
        "task": "apps.notifications.tasks.send_admin_daily_summary",
        "schedule": crontab(minute=0, hour=8),  # 08:00 Dakar time
    },
}

app.conf.timezone = "Africa/Dakar"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
