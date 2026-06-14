from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0005_seed_senegal_vehicle_types"),
    ]

    operations = [
        migrations.AlterField(
            model_name="vehicle",
            name="vehicle_type",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="vehicles",
                to="fleet.vehicletype",
            ),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="custom_vehicle_type",
            field=models.CharField(
                blank=True, max_length=255,
                help_text="Type personnalisé quand 'Autre' est sélectionné",
            ),
        ),
    ]
