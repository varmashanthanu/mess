"""
MESS Platform — Core Abstract Models
All domain models inherit from these for consistent auditing and UUID PKs.
"""
import uuid

from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    """Primary key is a UUID instead of a sequential integer."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    """Automatic created_at / updated_at timestamps."""
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class BaseModel(UUIDModel, TimestampedModel):
    """Base class combining UUID PK + timestamps. Use for all domain models."""

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    """Soft-delete support — records are never physically removed."""
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()  # includes deleted

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])

    def hard_delete(self):
        super().delete()

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    class Meta:
        abstract = True
