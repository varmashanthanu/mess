"""Add PaytechConfig singleton model."""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PaytechConfig",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("is_enabled", models.BooleanField(default=False)),
                ("mode", models.CharField(
                    choices=[("TEST", "Test"), ("PRODUCTION", "Production")],
                    default="TEST",
                    max_length=20,
                )),
                ("test_api_key",           models.CharField(blank=True, max_length=512)),
                ("test_api_secret",        models.CharField(blank=True, max_length=512)),
                ("production_api_key",     models.CharField(blank=True, max_length=512)),
                ("production_api_secret",  models.CharField(blank=True, max_length=512)),
                ("updated_at",             models.DateTimeField(auto_now=True)),
                ("updated_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="paytech_updates",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"verbose_name": "PayTech Gateway Config"},
        ),
    ]
