from __future__ import annotations

from django.conf import settings
from django.db import models


class Tenant(models.Model):
    despacho = models.ForeignKey(
        "tenancy.Despacho",
        on_delete=models.PROTECT,
        related_name="tenants",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    db_name = models.CharField(max_length=255, unique=True)
    db_user = models.CharField(max_length=255)
    db_password = models.CharField(max_length=255)
    db_host = models.CharField(max_length=255, default="localhost")
    db_port = models.PositiveIntegerField(default=5432)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    default_currency = models.CharField(max_length=3, default="MXN")

    class Meta:
        db_table = "tenancy_tenant"
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"

    @property
    def db_alias(self) -> str:
        return f"tenant_{self.slug}"

    def database_dict(self) -> dict[str, str | int]:
        template = settings.DATABASES.get("default", {}).copy()
        template.update(
            {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": self.db_name,
                "USER": self.db_user,
                "PASSWORD": self.db_password,
                "HOST": self.db_host,
                "PORT": self.db_port,
            }
        )
        return template


class TenantAIConfig(models.Model):
    class Provider(models.TextChoices):
        OPENAI = "openai", "OpenAI"
        PERPLEXITY = "perplexity", "Perplexity"
        DEEPSEEK = "deepseek", "DeepSeek"
        GOOGLE = "google", "Google"

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="ai_config")
    provider = models.CharField(max_length=32, choices=Provider.choices, default=Provider.OPENAI)
    api_key = models.CharField(max_length=512, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenancy_tenant_ai_config"
        verbose_name = "Configuración IA"
        verbose_name_plural = "Configuraciones IA"

    def __str__(self) -> str:
        return f"Config IA {self.tenant.slug}: {self.provider}"


class Despacho(models.Model):
    class Tipo(models.TextChoices):
        DESPACHO = "despacho", "Despacho"
        CORPORATIVO = "corporativo", "Corporativo"

    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.DESPACHO)
    contacto_email = models.EmailField(blank=True)
    contacto_telefono = models.CharField(max_length=50, blank=True)
    notas = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenancy_despacho"
        verbose_name = "Despacho"
        verbose_name_plural = "Despachos"
        ordering = ["nombre"]

    def __str__(self) -> str:  # pragma: no cover - representación simple
        return self.nombre


class TenantProvisionLog(models.Model):
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    slug = models.SlugField()
    admin_email = models.EmailField()
    status = models.CharField(max_length=20, choices=Status.choices)
    message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_provision_logs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenancy_tenant_provision_log"
        ordering = ["-created_at"]
        verbose_name = "Log de aprovisionamiento"
        verbose_name_plural = "Logs de aprovisionamiento"

    def __str__(self) -> str:  # pragma: no cover - representación sencilla
        return f"{self.slug} - {self.status}"
