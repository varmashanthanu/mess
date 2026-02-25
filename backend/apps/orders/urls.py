"""Orders URLs — /api/v1/orders/"""
from django.urls import path
from .views import (
    AcceptBidView,
    BidListCreateView,
    ConfirmDeliveryView,
    FreightOrderDetailView,
    FreightOrderListCreateView,
    OrderTransitionView,
    PostOrderView,
    ProofOfDeliveryView,
    RateDeliveryView,
)

urlpatterns = [
    path("", FreightOrderListCreateView.as_view(), name="orders-list"),
    path("<uuid:pk>/", FreightOrderDetailView.as_view(), name="orders-detail"),
    path("<uuid:pk>/post/", PostOrderView.as_view(), name="orders-post"),
    path("<uuid:pk>/transition/", OrderTransitionView.as_view(), name="orders-transition"),
    path("<uuid:pk>/bids/", BidListCreateView.as_view(), name="orders-bids"),
    path("<uuid:order_pk>/bids/", BidListCreateView.as_view(), name="orders-bids-create"),
    path("<uuid:pk>/accept-bid/", AcceptBidView.as_view(), name="orders-accept-bid"),
    path("<uuid:pk>/proof-of-delivery/", ProofOfDeliveryView.as_view(), name="orders-pod"),
    path("<uuid:pk>/confirm-delivery/", ConfirmDeliveryView.as_view(), name="orders-confirm"),
    path("<uuid:pk>/rate/", RateDeliveryView.as_view(), name="orders-rate"),
]
