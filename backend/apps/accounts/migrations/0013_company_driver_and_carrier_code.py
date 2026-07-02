"""
Add COMPANY_DRIVER role to User.role choices and company_code to CarrierProfile.
"""
import random
import string
from django.db import migrations, models


def generate_company_codes(apps, schema_editor):
    CarrierProfile = apps.get_model("accounts", "CarrierProfile")
    used = set()
    for profile in CarrierProfile.objects.filter(company_code__isnull=True):
        while True:
            code = "YOO-" + "".join(random.choices(string.digits, k=4))
            if code not in used:
                used.add(code)
                break
        profile.company_code = code
        profile.save(update_fields=["company_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_add_carrier_profile_is_available"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("SHIPPER", "Shipper"),
                    ("DRIVER", "Owner Operator"),
                    ("COMPANY_DRIVER", "Company Driver"),
                    ("CARRIER", "Carrier"),
                    ("BROKER", "Broker"),
                    ("ADMIN", "Admin"),
                ],
                default="SHIPPER",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="carrierprofile",
            name="company_code",
            field=models.CharField(blank=True, db_index=True, max_length=20, unique=True, null=True),
        ),
        migrations.RunPython(generate_company_codes, migrations.RunPython.noop),
    ]
