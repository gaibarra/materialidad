from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantAIConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("openai", "OpenAI"), ("perplexity", "Perplexity"), ("deepseek", "DeepSeek"), ("google", "Google")], default="openai", max_length=32)),
                ("api_key", models.CharField(blank=True, max_length=512)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="ai_config", to="tenancy.tenant"),
                ),
            ],
            options={
                "db_table": "tenancy_tenant_ai_config",
                "verbose_name": "Configuración IA",
                "verbose_name_plural": "Configuraciones IA",
            },
        ),
    ]
