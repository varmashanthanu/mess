from django.contrib import admin
from .models import GPSPing, OrderRoute


@admin.register(GPSPing)
class GPSPingAdmin(admin.ModelAdmin):
    list_display = ["driver", "order", "lat", "lng", "speed_kmh", "timestamp"]
    list_filter = ["driver"]
    date_hierarchy = "timestamp"


@admin.register(OrderRoute)
class OrderRouteAdmin(admin.ModelAdmin):
    list_display = ["order", "planned_distance_km", "actual_distance_km"]
