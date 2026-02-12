from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import environ
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from django.utils.dateparse import parse_duration

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    environ.Env.read_env(str(ENV_FILE))

SECRET_KEY = env("DJANGO_SECRET_KEY", default=None)
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be provided")

DEBUG = env.bool("DJANGO_DEBUG", False)

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "accounts",
    "tenancy",
    "materialidad",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "tenancy.middleware.TenantMiddleware",
]

ROOT_URLCONF = "materialidad_backend.urls"

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
    }
]

WSGI_APPLICATION = "materialidad_backend.wsgi.application"
ASGI_APPLICATION = "materialidad_backend.asgi.application"

CONTROL_DB_URL = env("DJANGO_CONTROL_DB_URL", default=None)
if not CONTROL_DB_URL:
    raise ImproperlyConfigured("DJANGO_CONTROL_DB_URL must be provided")

DATABASES = {
    "default": env.db_url("DJANGO_CONTROL_DB_URL"),
}

DATABASE_ROUTERS = ["tenancy.routers.TenantDatabaseRouter"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mexico_City"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

def _duration_from_env(var_name: str, default: timedelta) -> timedelta:
    raw_value = env(var_name, default=None)
    if raw_value in (None, ""):
        return default
    if isinstance(raw_value, timedelta):
        return raw_value
    duration = parse_duration(str(raw_value))
    if duration is None:
        raise ImproperlyConfigured(
            f"{var_name} must be a valid ISO 8601 duration or HH:MM:SS string"
        )
    return duration


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "ACCESS_TOKEN_LIFETIME": _duration_from_env(
        "JWT_ACCESS_TTL", timedelta(minutes=60)
    ),
    "REFRESH_TOKEN_LIFETIME": _duration_from_env(
        "JWT_REFRESH_TTL", timedelta(days=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": SECRET_KEY,
}

CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + ["x-tenant"]

API_BASE_PATH = "/api/"
TENANT_HEADER = "HTTP_X_TENANT"
TENANT_REQUIRED_PATH_PREFIXES = env.list(
    "TENANT_REQUIRED_PATHS", default=["/api/materialidad/"]
)
TENANT_FREE_LIMIT = env.int("TENANT_FREE_LIMIT", default=1)

N8N_WEBHOOK_URL = env("N8N_WEBHOOK_URL", default=None)
N8N_API_KEY = env("N8N_API_KEY", default=None)
N8N_TIMEOUT_SECONDS = env.int("N8N_TIMEOUT_SECONDS", default=30)

AI_PROVIDER = env("AI_PROVIDER", default="openai").lower()
OPENAI_API_KEY = env("OPENAI_API_KEY", default=None)
OPENAI_API_BASE_URL = env("OPENAI_API_BASE_URL", default="https://api.openai.com/v1")
OPENAI_DEFAULT_MODEL = env("OPENAI_DEFAULT_MODEL", default="gpt-5.1-mini")
OPENAI_TIMEOUT_SECONDS = env.int("OPENAI_TIMEOUT_SECONDS", default=120)
OPENAI_FALLBACK_MODEL = env("OPENAI_FALLBACK_MODEL", default="gpt-5-mini")
PERPLEXITY_API_KEY = env("PERPLEXITY_API_KEY", default=None)
PERPLEXITY_DEFAULT_MODEL = env("PERPLEXITY_DEFAULT_MODEL", default="sonar-pro")
PERPLEXITY_API_BASE_URL = env(
    "PERPLEXITY_API_BASE_URL",
    default="https://api.perplexity.ai/chat/completions",
)
PERPLEXITY_TIMEOUT_SECONDS = env.int("PERPLEXITY_TIMEOUT_SECONDS", default=90)
PERPLEXITY_MAX_CONTINUATIONS = env.int("PERPLEXITY_MAX_CONTINUATIONS", default=2)
GEMINI_API_KEY = env("GEMINI_API_KEY", default=None)
GEMINI_DEFAULT_MODEL = env("GEMINI_DEFAULT_MODEL", default="gemini-1.5-pro")

CITATION_CORPUS_VERSION = env("CITATION_CORPUS_VERSION", default="v1")
CITATION_CACHE_TTL_MINUTES = env.int("CITATION_CACHE_TTL_MINUTES", default=720)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        }
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "tenancy": {"handlers": ["console"], "level": "INFO"},
        "materialidad": {"handlers": ["console"], "level": "INFO"},
    },
}
