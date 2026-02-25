"""Payments URLs — /api/v1/payments/"""
from django.urls import path
from .views import (
    InitiatePaymentView,
    PaymentTransactionDetailView,
    PaymentTransactionListView,
    PaymentWebhookView,
)

urlpatterns = [
    path("initiate/", InitiatePaymentView.as_view(), name="payments-initiate"),
    path("webhook/<str:provider_name>/", PaymentWebhookView.as_view(), name="payments-webhook"),
    path("transactions/", PaymentTransactionListView.as_view(), name="payments-transactions"),
    path("transactions/<uuid:pk>/", PaymentTransactionDetailView.as_view(), name="payments-transaction-detail"),
]
