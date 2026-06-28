from django.urls import path
from ..workspace_views import WorkspaceListView, WorkspaceSwitchView

urlpatterns = [
    path("me/workspaces/", WorkspaceListView.as_view(), name="workspace-list"),
    path("workspaces/switch/", WorkspaceSwitchView.as_view(), name="workspace-switch"),
]
