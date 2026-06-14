from django.db import migrations


VEHICLE_TYPES = [
    # (name, name_fr, max_payload_kg, volume_m3, icon, description)
    ("Pick-up",              "Pick-up",                    800,   None,  "🛻", "Véhicule pick-up, charge utile jusqu'à 800 kg"),
    ("Fourgon léger",        "Fourgon léger",             1500,   8.0,   "🚐", "Petit fourgon de livraison, jusqu'à 1,5T"),
    ("Fourgon grand volume", "Fourgon grand volume",      3000,  18.0,   "🚐", "Grand fourgon / camionnette, jusqu'à 3T"),
    ("Camion 5T bâché",      "Camion 5T bâché",           5000,  22.0,   "🚚", "Camion bâché 5 tonnes, très répandu au Sénégal"),
    ("Camion 10T bâché",     "Camion 10T bâché",         10000,  40.0,   "🚚", "Camion bâché 10 tonnes, le plus courant"),
    ("Camion 15T bâché",     "Camion 15T bâché",         15000,  55.0,   "🚚", "Camion bâché 15 tonnes"),
    ("Camion plateau 10T",   "Camion plateau 10T",       10000,   None,  "🚛", "Camion plateau ouvert 10 tonnes"),
    ("Camion plateau 20T",   "Camion plateau 20T",       20000,   None,  "🚛", "Camion plateau ouvert 20 tonnes"),
    ("Camion benne 10T",     "Camion benne 10T",         10000,   None,  "🚚", "Camion benne basculante 10 tonnes, sable/gravier"),
    ("Camion benne 20T",     "Camion benne 20T",         20000,   None,  "🚚", "Camion benne basculante 20 tonnes"),
    ("Camion frigorifique",  "Camion frigorifique",       8000,  32.0,   "❄️", "Camion réfrigéré pour denrées périssables"),
    ("Camion citerne",       "Camion citerne",           15000,   None,  "⛽", "Citerne pour carburant, eau ou produits liquides"),
    ("Camion malaxeur",      "Camion malaxeur (béton)",   8000,   None,  "🏗️", "Camion toupie / malaxeur à béton"),
    ("Semi-remorque bâché",  "Semi-remorque bâché",      25000,  90.0,   "🚛", "Semi-remorque (38T PTAC) bâché"),
    ("Semi-remorque plateau","Semi-remorque plateau",    25000,   None,  "🚛", "Semi-remorque plateau / porte-containers 20/40 pieds"),
    ("Porte-conteneurs",     "Porte-conteneurs",         28000,   None,  "📦", "Châssis porte-conteneurs ISO 20 ou 40 pieds"),
    ("Porte-engin",          "Porte-engin (lowboy)",     40000,   None,  "🏗️", "Plateau surbaissé pour engins de chantier lourds"),
    ("Camion grue",          "Camion grue",              10000,   None,  "🏗️", "Camion équipé d'une grue de manutention"),
    ("Remorque agricole",    "Remorque agricole",         8000,   None,  "🌾", "Remorque pour produits agricoles en vrac"),
    ("Camion polybenne",     "Camion polybenne",         10000,   None,  "♻️", "Polybenne / ampliroll pour déchets ou gravats"),
]


def seed_vehicle_types(apps, schema_editor):
    VehicleType = apps.get_model("fleet", "VehicleType")
    for name, name_fr, payload, volume, icon, desc in VEHICLE_TYPES:
        VehicleType.objects.get_or_create(
            name=name,
            defaults=dict(
                name_fr=name_fr,
                max_payload_kg=payload,
                volume_m3=volume,
                icon=icon,
                description=desc,
                is_active=True,
            ),
        )


def unseed_vehicle_types(apps, schema_editor):
    VehicleType = apps.get_model("fleet", "VehicleType")
    names = [t[0] for t in VEHICLE_TYPES]
    VehicleType.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("fleet", "0004_vehicle_insurance_fields"),
    ]

    operations = [
        migrations.RunPython(seed_vehicle_types, unseed_vehicle_types),
    ]
