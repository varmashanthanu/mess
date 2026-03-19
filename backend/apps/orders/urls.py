"""Orders URLs — /api/v1/orders/"""
from django.urls import path
from .views import (
    AcceptBidView,
    BidListCreateView,
    ConfirmDeliveryView,
    FreightOrderDetailView,
    FreightOrderListCreateView,
    OrderTransitionView,
    PickupProofView,
    PostOrderView,
    PriceEstimateView,
    ProofOfDeliveryView,
    RateDeliveryView,
)

urlpatterns = [
    path("estimate-price/", PriceEstimateView.as_view(), name="orders-estimate-price"),
    path("", FreightOrderListCreateView.as_view(), name="orders-list"),
    path("<uuid:pk>/", FreightOrderDetailView.as_view(), name="orders-detail"),
    path("<uuid:pk>/post/", PostOrderView.as_view(), name="orders-post"),
    path("<uuid:pk>/transition/", OrderTransitionView.as_view(), name="orders-transition"),
    path("<uuid:order_pk>/bids/", BidListCreateView.as_view(), name="orders-bids"),
    path("<uuid:pk>/accept-bid/", AcceptBidView.as_view(), name="orders-accept-bid"),
    path("<uuid:pk>/pickup-proof/", PickupProofView.as_view(), name="orders-pickup-proof"),
    path("<uuid:pk>/proof-of-delivery/", ProofOfDeliveryView.as_view(), name="orders-pod"),
    path("<uuid:pk>/confirm-delivery/", ConfirmDeliveryView.as_view(), name="orders-confirm"),
    path("<uuid:pk>/rate/", RateDeliveryView.as_view(), name="orders-rate"),
]
