"""
Super Admin Views — Only accessible by superusers (is_superuser=True).
"""
import os
import shutil
import time

from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import UserRole
from apps.accounts.models import AdminPermission
from core.permissions import IsSuperAdmin

User = get_user_model()


# ── Serializers ────────────────────────────────────────────────────────────

class AdminPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminPermission
        fields = [
            "can_manage_users", "can_manage_fleet", "can_manage_orders",
            "can_manage_finance", "can_manage_analytics", "can_manage_messaging",
            "can_manage_tracking", "can_view_governance",
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    permissions = AdminPermissionSerializer(source="admin_permissions", read_only=True)
    full_name   = serializers.CharField(read_only=True)
    password    = serializers.CharField(write_only=True, required=True)

    class Meta:
        model  = User
        fields = [
            "id", "full_name", "first_name", "last_name", "phone_number",
            "email", "is_superuser", "is_verified", "is_active",
            "date_joined", "last_login", "permissions", "password",
        ]
        read_only_fields = ["id", "full_name", "date_joined", "last_login"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=UserRole.ADMIN, is_verified=True, **validated_data)
        user.set_password(password)
        user.save()
        AdminPermission.objects.create(user=user)
        return user


# ── Views ──────────────────────────────────────────────────────────────────

class AdminListCreateView(generics.ListCreateAPIView):
    """List all admins / create a new admin (superadmin only)."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class   = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(role=UserRole.ADMIN).select_related("admin_permissions")


class AdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / update / delete an admin user."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class   = AdminUserSerializer

    def get_queryset(self):
        return User.objects.filter(role=UserRole.ADMIN)

    def perform_destroy(self, instance):
        if instance.is_superuser:
            raise serializers.ValidationError("Cannot delete a superadmin.")
        instance.delete()


class AdminPermissionView(APIView):
    """Update granular permissions of an admin (superadmin only)."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk, role=UserRole.ADMIN)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        perms, _ = AdminPermission.objects.get_or_create(user=user)
        return Response(AdminPermissionSerializer(perms).data)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk, role=UserRole.ADMIN)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        perms, _ = AdminPermission.objects.get_or_create(user=user)
        serializer = AdminPermissionSerializer(perms, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SystemStatsView(APIView):
    """System monitoring — DB, disk, process stats (superadmin only)."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        # Disk usage
        disk = shutil.disk_usage("/")
        disk_total_gb  = round(disk.total / 1e9, 1)
        disk_used_gb   = round(disk.used  / 1e9, 1)
        disk_free_gb   = round(disk.free  / 1e9, 1)
        disk_pct       = round(disk.used  / disk.total * 100, 1)

        # DB: number of tables and row counts for key models
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
            db_table_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM accounts_user")
            user_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM orders_freightorder")
            order_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM messaging_message")
            message_count = cursor.fetchone()[0]

            # Active DB connections
            cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")
            active_connections = cursor.fetchone()[0]

            cursor.execute("SELECT count(*) FROM pg_stat_activity")
            total_connections = cursor.fetchone()[0]

        # Memory via /proc/meminfo (Linux)
        mem_info = {}
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    key, val = line.split(":")
                    mem_info[key.strip()] = int(val.strip().split()[0])
            mem_total_mb = round(mem_info.get("MemTotal", 0) / 1024, 0)
            mem_avail_mb = round(mem_info.get("MemAvailable", 0) / 1024, 0)
            mem_used_mb  = round(mem_total_mb - mem_avail_mb, 0)
            mem_pct      = round(mem_used_mb / mem_total_mb * 100, 1) if mem_total_mb else 0
        except Exception:
            mem_total_mb = mem_used_mb = mem_avail_mb = mem_pct = 0

        # CPU load average
        try:
            load1, load5, load15 = os.getloadavg()
        except Exception:
            load1 = load5 = load15 = 0.0

        # Uptime from /proc/uptime
        try:
            with open("/proc/uptime") as f:
                uptime_seconds = float(f.read().split()[0])
            uptime_hours = round(uptime_seconds / 3600, 1)
        except Exception:
            uptime_hours = 0.0

        return Response({
            "disk": {
                "total_gb": disk_total_gb,
                "used_gb":  disk_used_gb,
                "free_gb":  disk_free_gb,
                "pct":      disk_pct,
            },
            "memory": {
                "total_mb": mem_total_mb,
                "used_mb":  mem_used_mb,
                "free_mb":  mem_avail_mb,
                "pct":      mem_pct,
            },
            "cpu": {
                "load_1":  round(load1,  2),
                "load_5":  round(load5,  2),
                "load_15": round(load15, 2),
            },
            "uptime_hours": uptime_hours,
            "database": {
                "table_count":        db_table_count,
                "active_connections": active_connections,
                "total_connections":  total_connections,
                "users":    user_count,
                "orders":   order_count,
                "messages": message_count,
            },
        })
