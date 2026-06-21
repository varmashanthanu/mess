"""
Add conversation_type, make order nullable, add title to Conversation.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0001_initial"),
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="conversation_type",
            field=models.CharField(
                choices=[("ORDER", "Order Conversation"), ("DIRECT", "Direct Message"), ("GROUP", "Group Chat")],
                default="ORDER",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="conversation",
            name="title",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="conversation",
            name="order",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="conversation",
                to="orders.freightorder",
            ),
        ),
    ]
