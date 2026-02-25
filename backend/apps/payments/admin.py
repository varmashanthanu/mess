from django.contrib import admin
from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ["order", "payer", "amount", "provider", "status", "initiated_at"]
    list_filter = ["status", "provider"]
    search_fields = ["order__reference", "payer__phone_number", "provider_reference"]
    readonly_fields = ["provider_reference", "provider_metadata", "initiated_at", "completed_at"]
