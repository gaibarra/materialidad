# Generated manually for initial schema
from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies: list[tuple[str, str]] = []

    operations = [
        migrations.CreateModel(
            name="Tenant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("slug", models.SlugField(unique=True)),
                ("db_name", models.CharField(max_length=255, unique=True)),
                ("db_user", models.CharField(max_length=255)),
                ("db_password", models.CharField(max_length=255)),
                ("db_host", models.CharField(default="localhost", max_length=255)),
                ("db_port", models.PositiveIntegerField(default=5432)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("default_currency", models.CharField(default="MXN", max_length=3)),
            ],
            options={
                "db_table": "tenancy_tenant",
            },
        ),
    ]
