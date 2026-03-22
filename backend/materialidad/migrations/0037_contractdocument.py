from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materialidad", "0036_alter_auditlog_id_transaccionintercompania"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContractDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("BORRADOR_AI", "Borrador AI"),
                            ("DEFINITIVO_AI", "Definitivo AI"),
                            ("SUBIDO", "Subido"),
                            ("CORREGIDO", "Corregido"),
                        ],
                        default="BORRADOR_AI",
                        max_length=32,
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        choices=[
                            ("AI", "Generado por IA"),
                            ("UPLOAD", "Cargado por usuario"),
                            ("MANUAL", "Captura manual"),
                        ],
                        default="AI",
                        max_length=16,
                    ),
                ),
                ("idioma", models.CharField(default="es", max_length=8)),
                ("tono", models.CharField(default="formal", max_length=16)),
                ("modelo", models.CharField(blank=True, default="", max_length=128)),
                (
                    "archivo",
                    models.FileField(blank=True, null=True, upload_to="contratos/documentos/%Y/%m/"),
                ),
                ("archivo_nombre", models.CharField(blank=True, default="", max_length=255)),
                ("markdown_text", models.TextField(blank=True, default="")),
                ("extracted_text", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "contrato",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="documentos", to="materialidad.contrato"),
                ),
            ],
            options={
                "verbose_name": "Documento de contrato",
                "verbose_name_plural": "Documentos de contrato",
                "db_table": "materialidad_contract_document",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="contractdocument",
            index=models.Index(fields=["contrato", "kind"], name="materialid_contrato_2b9b57_idx"),
        ),
        migrations.AddIndex(
            model_name="contractdocument",
            index=models.Index(fields=["created_at"], name="materialid_created_0f3aa9_idx"),
        ),
    ]
