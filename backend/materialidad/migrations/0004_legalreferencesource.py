from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0003_contratotemplate"),
    ]

    operations = [
        migrations.CreateModel(
            name="LegalReferenceSource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=255, unique=True)),
                ("ley", models.CharField(max_length=255)),
                (
                    "tipo_fuente",
                    models.CharField(
                        choices=[
                            ("LEY", "Ley"),
                            ("REGLAMENTO", "Reglamento"),
                            ("NOM", "Norma Oficial"),
                            ("CRITERIO_SAT", "Criterio SAT"),
                            ("RESOLUCION", "Resolución"),
                        ],
                        default="LEY",
                        max_length=32,
                    ),
                ),
                ("articulo", models.CharField(blank=True, max_length=64)),
                ("fraccion", models.CharField(blank=True, max_length=64)),
                ("parrafo", models.CharField(blank=True, max_length=64)),
                ("contenido", models.TextField()),
                ("resumen", models.TextField(blank=True)),
                ("fuente_documento", models.CharField(blank=True, max_length=255)),
                ("fuente_url", models.URLField(blank=True)),
                ("vigencia", models.CharField(blank=True, max_length=64)),
                ("sat_categoria", models.CharField(blank=True, max_length=64)),
                ("hash_contenido", models.CharField(max_length=64, unique=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Fuente legal",
                "verbose_name_plural": "Fuentes legales",
                "db_table": "materialidad_legal_reference_source",
            },
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["ley", "articulo"], name="materialida_ley_artic_bce6af_idx"),
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["tipo_fuente"], name="materialida_tipo_fu_6e4e5c_idx"),
        ),
    ]
