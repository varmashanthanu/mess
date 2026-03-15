"""
Management command to create test accounts for all user roles.
Usage: ./manage.py createtestdata
"""
from django.core.management.base import BaseCommand

from apps.accounts.constants import UserRole
from apps.accounts.models import BrokerProfile, DriverProfile, ShipperProfile, User

TEST_USERS = [
    {
        "first_name": "Mess",
        "last_name": "Shipper",
        "phone_number": "+221771234566",
        "password": "Shipper123#",
        "role": UserRole.SHIPPER,
    },
    {
        "first_name": "Mess",
        "last_name": "Driver",
        "phone_number": "+221771234570",
        "password": "Driver123#",
        "role": UserRole.DRIVER,
    },
    {
        "first_name": "Mess",
        "last_name": "Broker",
        "phone_number": "+221771234568",
        "password": "Broker123#",
        "role": UserRole.BROKER,
    },
    {
        "first_name": "Mess",
        "last_name": "Fleet",
        "phone_number": "+221771234569",
        "password": "Fleet123#",
        "role": UserRole.FLEET_MANAGER,
    },
]

PROFILE_MAP = {
    UserRole.SHIPPER: (ShipperProfile, "shipper_profile"),
    UserRole.DRIVER: (DriverProfile, "driver_profile"),
    UserRole.BROKER: (BrokerProfile, "broker_profile"),
}


class Command(BaseCommand):
    help = "Create test accounts for shipper, driver, broker, and fleet manager roles."

    def handle(self, *args, **options):
        for data in TEST_USERS:
            phone = data["phone_number"]
            user, created = User.objects.get_or_create(
                phone_number=phone,
                defaults={
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "role": data["role"],
                    "is_verified": True,
                },
            )

            if created:
                user.set_password(data["password"])
                user.save(update_fields=["password"])
                action = "Created"
            else:
                action = "Already exists"

            # Create role profile if applicable
            if data["role"] in PROFILE_MAP:
                profile_model, _ = PROFILE_MAP[data["role"]]
                if data["role"] == UserRole.DRIVER:
                    profile_model.objects.get_or_create(
                        user=user,
                        defaults={"license_number": "TEST-LICENSE"},
                    )
                else:
                    profile_model.objects.get_or_create(user=user)

            self.stdout.write(
                self.style.SUCCESS(f"{action}: {user.full_name} ({user.role}) — {phone}")
            )
