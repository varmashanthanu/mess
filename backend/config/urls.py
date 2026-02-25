"""
MESS Platform — Root URL Configuration
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

api_v1_urlpatterns = [
    path("auth/", include("apps.accounts.urls.auth")),
    path("accounts/", include("apps.accounts.urls.profiles")),
    path("fleet/", include("apps.fleet.urls")),
    path("orders/", include("apps.orders.urls")),
    path("tracking/", include("apps.tracking.urls")),
    path("payments/", include("apps.payments.urls")),
    path("messaging/", include("apps.messaging.urls")),
    path("notifications/", include("apps.notifications.urls")),
]

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/", include(api_v1_urlpatterns)),

    # OpenAPI schema + docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
