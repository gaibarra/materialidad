from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0003_alter_tenant_options"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantProvisionLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField()),
                ("admin_email", models.EmailField(max_length=254)),
                ("status", models.CharField(choices=[("success", "Success"), ("failure", "Failure")], max_length=20)),
                ("message", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "initiated_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="tenant_provision_logs", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "db_table": "tenancy_tenant_provision_log",
                "ordering": ["-created_at"],
                "verbose_name": "Log de aprovisionamiento",
                "verbose_name_plural": "Logs de aprovisionamiento",
            },
        ),
    ]
