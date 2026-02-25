"""
MESS Platform — Base Django Settings
Shared across all environments.
"""

import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# ── Paths ──────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ── Security ──────────────────────────────────────────────────────
SECRET_KEY = config("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost", cast=Csv())

# ── Application definition ────────────────────────────────────────
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "drf_spectacular",
    "django_celery_beat",
    "django_celery_results",
    "phonenumber_field",
]

LOCAL_APPS = [
    "core",
    "apps.accounts",
    "apps.fleet",
    "apps.orders",
    "apps.tracking",
    "apps.payments",
    "apps.messaging",
    "apps.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware ────────────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── Templates ────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Database ──────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB"),
        "USER": config("POSTGRES_USER"),
        "PASSWORD": config("POSTGRES_PASSWORD"),
        "HOST": config("POSTGRES_HOST", default="localhost"),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,  # persistent connections
    }
}

# ── Cache — Redis ──────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://localhost:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
            "IGNORE_EXCEPTIONS": True,  # graceful degradation if Redis is down
        },
        "KEY_PREFIX": "mess",
    }
}
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ── Channels (WebSocket) ──────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://localhost:6379/0")],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# ── Celery ────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Dakar"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300  # 5 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_TASK_ROUTES = {
    "apps.payments.tasks.*": {"queue": "payments"},
    "apps.notifications.tasks.*": {"queue": "notifications"},
    "*": {"queue": "default"},
}

# ── Auth ──────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── DRF ──────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "300/min",
    },
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}

# ── JWT ───────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=30, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# ── CORS ──────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="http://localhost:4200", cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# ── i18n / l10n ───────────────────────────────────────────────────
LANGUAGE_CODE = "fr"
TIME_ZONE = "Africa/Dakar"
USE_I18N = True
USE_L10N = True
USE_TZ = True

LANGUAGES = [
    ("fr", "French"),
    ("wo", "Wolof"),
    ("ff", "Pulaar"),
    ("en", "English"),
]

LOCALE_PATHS = [BASE_DIR / "locale"]

# ── Static & Media ───────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ── Phone numbers ─────────────────────────────────────────────────
PHONENUMBER_DB_FORMAT = "E164"
PHONENUMBER_DEFAULT_REGION = "SN"  # Senegal

# ── API docs (drf-spectacular) ────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "MESS Platform API",
    "DESCRIPTION": (
        "Freight brokerage and truck dispatching platform for Senegal. "
        "Connects shippers with carriers via real-time tracking and mobile money payments."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "TAGS": [
        {"name": "auth", "description": "Authentication — register, login, refresh, logout"},
        {"name": "accounts", "description": "User profile management"},
        {"name": "fleet", "description": "Vehicles and fleet management"},
        {"name": "orders", "description": "Freight order lifecycle"},
        {"name": "tracking", "description": "GPS tracking"},
        {"name": "payments", "description": "Payment transactions and mobile money"},
        {"name": "messaging", "description": "In-app messaging"},
        {"name": "notifications", "description": "Push/SMS notifications"},
    ],
}

# ── Maps provider ─────────────────────────────────────────────────
MAPS_PROVIDER = config("MAPS_PROVIDER", default="osm")
MAPBOX_TOKEN = config("MAPBOX_TOKEN", default="")

# ── Payment providers ─────────────────────────────────────────────
WAVE_API_KEY = config("WAVE_API_KEY", default="")
WAVE_MERCHANT_ID = config("WAVE_MERCHANT_ID", default="")
WAVE_WEBHOOK_SECRET = config("WAVE_WEBHOOK_SECRET", default="")
WAVE_BASE_URL = config("WAVE_BASE_URL", default="https://api.wave.com/v1")

ORANGE_MONEY_API_KEY = config("ORANGE_MONEY_API_KEY", default="")
ORANGE_MONEY_CLIENT_ID = config("ORANGE_MONEY_CLIENT_ID", default="")
ORANGE_MONEY_CLIENT_SECRET = config("ORANGE_MONEY_CLIENT_SECRET", default="")
ORANGE_MONEY_BASE_URL = config("ORANGE_MONEY_BASE_URL", default="https://api.orange.com/orange-money-webpay/sen/v1")

FREE_MONEY_API_KEY = config("FREE_MONEY_API_KEY", default="")
FREE_MONEY_BASE_URL = config("FREE_MONEY_BASE_URL", default="")

# ── SMS ───────────────────────────────────────────────────────────
SMS_PROVIDER = config("SMS_PROVIDER", default="infobip")
SMS_API_KEY = config("SMS_API_KEY", default="")
SMS_SENDER_ID = config("SMS_SENDER_ID", default="MESS")

# ── FCM (Push notifications) ──────────────────────────────────────
FCM_SERVER_KEY = config("FCM_SERVER_KEY", default="")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
