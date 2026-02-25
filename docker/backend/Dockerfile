FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r mess && useradd -r -g mess mess

WORKDIR /app

# ── Build context is the project root (.) ────────────────────────
# This allows us to COPY from both backend/ and docker/ in one build.

# Install Python dependencies first (layer caching)
COPY backend/requirements/ requirements/
ARG REQUIREMENTS_FILE=production.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements/${REQUIREMENTS_FILE}

# Copy Django project (backend/ contents → /app)
COPY backend/ .

# Copy entrypoint BEFORE switching to non-root user (needs root to write to /)
COPY docker/backend/entrypoint.sh /entrypoint.sh
# Set permissions as root before switching user
RUN chmod 755 /entrypoint.sh

# Ensure media/static directories exist and are owned by the app user
RUN mkdir -p /app/media /app/staticfiles && \
    chown -R mess:mess /app

USER mess

EXPOSE 8000

# Use bash explicitly — avoids any execute-bit or shebang issues with the non-root user
ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
