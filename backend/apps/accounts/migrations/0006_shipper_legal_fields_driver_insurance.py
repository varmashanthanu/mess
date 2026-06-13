from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_alter_contactmessage_created_at"),
    ]

    operations = [
        # ShipperProfile — Senegal legal fields
        migrations.AddField(model_name="shipperprofile", name="ninea", field=models.CharField(blank=True, max_length=50, help_text="Numéro d'Identification National des Entreprises et Associations")),
        migrations.AddField(model_name="shipperprofile", name="rccm", field=models.CharField(blank=True, max_length=100, help_text="Registre du Commerce et du Crédit Mobilier")),
        migrations.AddField(model_name="shipperprofile", name="legal_form", field=models.CharField(blank=True, max_length=50, help_text="SA, SARL, GIE, SNC, Individuelle…")),
        migrations.AddField(model_name="shipperprofile", name="region", field=models.CharField(blank=True, max_length=100, help_text="Région administrative au Sénégal")),
        migrations.AddField(model_name="shipperprofile", name="professional_phone", field=models.CharField(blank=True, max_length=30)),
        migrations.AddField(model_name="shipperprofile", name="professional_email", field=models.EmailField(blank=True, max_length=254)),
        # DriverProfile — personal insurance
        migrations.AddField(model_name="driverprofile", name="insurance_provider", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="driverprofile", name="insurance_policy_number", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="driverprofile", name="insurance_start_date", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="driverprofile", name="insurance_expiry", field=models.DateField(blank=True, null=True)),
    ]
