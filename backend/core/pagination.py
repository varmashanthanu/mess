"""
MESS Platform — Custom DRF Pagination
"""
from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """Default page-number pagination with metadata envelope."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "results": data,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "count": {"type": "integer"},
                "next": {"type": "string", "nullable": True},
                "previous": {"type": "string", "nullable": True},
                "total_pages": {"type": "integer"},
                "current_page": {"type": "integer"},
                "results": schema,
            },
        }


class GPSCursorPagination(CursorPagination):
    """Cursor-based pagination for GPS pings (high-volume, append-only)."""
    page_size = 100
    ordering = "-timestamp"
    cursor_query_param = "cursor"
