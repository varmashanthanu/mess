from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_add_broker_role_and_profile"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminPermission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("can_manage_users",     models.BooleanField(default=True)),
                ("can_manage_fleet",     models.BooleanField(default=True)),
                ("can_manage_orders",    models.BooleanField(default=True)),
                ("can_manage_finance",   models.BooleanField(default=True)),
                ("can_manage_analytics", models.BooleanField(default=True)),
                ("can_manage_messaging", models.BooleanField(default=True)),
                ("can_manage_tracking",  models.BooleanField(default=True)),
                ("can_view_governance",  models.BooleanField(default=False)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admin_permissions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"verbose_name": "Admin Permission", "verbose_name_plural": "Admin Permissions"},
        ),
    ]
