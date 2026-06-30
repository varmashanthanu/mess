"""Super Admin URLs"""
from django.urls import path
from apps.accounts import views_superadmin as v

urlpatterns = [
    path("admins/",              v.AdminListCreateView.as_view(),      name="superadmin-admins"),
    path("admins/<uuid:pk>/",    v.AdminDetailView.as_view(),          name="superadmin-admin-detail"),
    path("admins/<uuid:pk>/permissions/", v.AdminPermissionView.as_view(), name="superadmin-admin-perms"),
    path("users/",               v.PlatformUserListView.as_view(),     name="superadmin-users"),
    path("users/<uuid:pk>/toggle-block/", v.PlatformUserToggleBlockView.as_view(), name="superadmin-user-toggle-block"),
    path("system/",              v.SystemStatsView.as_view(),          name="superadmin-system"),
]
