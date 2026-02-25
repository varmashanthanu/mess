from django.contrib import admin
from .models import FreightOrder, OrderAssignment, OrderBid


class OrderBidInline(admin.TabularInline):
    model = OrderBid
    extra = 0
    readonly_fields = ["carrier", "price", "status", "created_at"]


@admin.register(FreightOrder)
class FreightOrderAdmin(admin.ModelAdmin):
    list_display = ["reference", "shipper", "pickup_city", "delivery_city", "status", "final_price", "created_at"]
    list_filter = ["status", "cargo_type", "pickup_city"]
    search_fields = ["reference", "cargo_description", "shipper__phone_number"]
    readonly_fields = ["reference", "created_at", "updated_at", "status_changed_at"]
    inlines = [OrderBidInline]


@admin.register(OrderBid)
class OrderBidAdmin(admin.ModelAdmin):
    list_display = ["order", "carrier", "price", "status", "created_at"]
    list_filter = ["status"]


@admin.register(OrderAssignment)
class OrderAssignmentAdmin(admin.ModelAdmin):
    list_display = ["order", "driver", "vehicle", "assigned_at", "delivered_at"]
    search_fields = ["order__reference", "driver__phone_number"]
