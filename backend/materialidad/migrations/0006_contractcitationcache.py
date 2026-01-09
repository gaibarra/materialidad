from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0005_alter_contrato_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContractCitationCache",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("documento_hash", models.CharField(max_length=64, unique=True)),
                (
                    "contrato",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.CASCADE,
                        related_name="citas_cache",
                        to="materialidad.contrato",
                    ),
                ),
                ("idioma", models.CharField(default="es", max_length=8)),
                ("fuente", models.CharField(default="AI", max_length=32)),
                ("payload", models.JSONField()),
                ("modelo", models.CharField(blank=True, max_length=128)),
                ("sources_version", models.CharField(blank=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Caché de citas",
                "verbose_name_plural": "Cachés de citas",
                "db_table": "materialidad_contract_citation_cache",
            },
        ),
        migrations.AddIndex(
            model_name="contractcitationcache",
            index=models.Index(fields=["contrato"], name="materialida_contrat_33c3ed_idx"),
        ),
        migrations.AddIndex(
            model_name="contractcitationcache",
            index=models.Index(fields=["updated_at"], name="materialida_update_5d8f9e_idx"),
        ),
    ]
