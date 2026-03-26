"""Orders URLs — /api/v1/orders/"""
from django.urls import path
from .views import (
    AcceptOrderView,
    ConfirmDeliveryView,
    FreightOrderDetailView,
    FreightOrderListCreateView,
    OrderTransitionView,
    PickupProofView,
    PostOrderView,
    PriceEstimateView,
    ProofOfDeliveryView,
    RateDeliveryView,
    RevertPickupView,
)

urlpatterns = [
    path("estimate-price/", PriceEstimateView.as_view(), name="orders-estimate-price"),
    path("", FreightOrderListCreateView.as_view(), name="orders-list"),
    path("<uuid:pk>/", FreightOrderDetailView.as_view(), name="orders-detail"),
    path("<uuid:pk>/post/", PostOrderView.as_view(), name="orders-post"),
    path("<uuid:pk>/transition/", OrderTransitionView.as_view(), name="orders-transition"),
    path("<uuid:pk>/accept/", AcceptOrderView.as_view(), name="orders-accept"),
    path("<uuid:pk>/pickup-proof/", PickupProofView.as_view(), name="orders-pickup-proof"),
    path("<uuid:pk>/revert-pickup/", RevertPickupView.as_view(), name="orders-revert-pickup"),
    path("<uuid:pk>/proof-of-delivery/", ProofOfDeliveryView.as_view(), name="orders-pod"),
    path("<uuid:pk>/confirm-delivery/", ConfirmDeliveryView.as_view(), name="orders-confirm"),
    path("<uuid:pk>/rate/", RateDeliveryView.as_view(), name="orders-rate"),
]
