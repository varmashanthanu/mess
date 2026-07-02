"""Add AccountTypeConfig singleton for enabling/disabling account types."""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_company_driver_and_carrier_code"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountTypeConfig",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("shipper_enabled",        models.BooleanField(default=True)),
                ("driver_enabled",         models.BooleanField(default=True)),
                ("carrier_enabled",        models.BooleanField(default=True)),
                ("broker_enabled",         models.BooleanField(default=True)),
                ("company_driver_enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="account_type_updates",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"verbose_name": "Account Type Config"},
        ),
    ]
