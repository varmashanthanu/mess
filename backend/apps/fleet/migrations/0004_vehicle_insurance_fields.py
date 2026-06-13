from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0003_alter_vehicle_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="insurance_provider",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="insurance_start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="insurance_expiry",
            field=models.DateField(blank=True, null=True),
        ),
    ]
