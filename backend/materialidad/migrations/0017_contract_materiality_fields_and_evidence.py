from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0016_legalconsultation_is_deduplicated"),
    ]

    operations = [
        migrations.AddField(
            model_name="contrato",
            name="archivo_notariado",
            field=models.FileField(blank=True, null=True, upload_to="contratos/notariados/"),
        ),
        migrations.AddField(
            model_name="contrato",
            name="beneficio_economico_esperado",
            field=models.DecimalField(blank=True, decimal_places=2, help_text="Monto estimado del beneficio economico (no fiscal)", max_digits=14, null=True),
        ),
        migrations.AddField(
            model_name="contrato",
            name="beneficio_fiscal_estimado",
            field=models.DecimalField(blank=True, decimal_places=2, help_text="Beneficio fiscal estimado para validar la razon de negocios", max_digits=14, null=True),
        ),
        migrations.AddField(
            model_name="contrato",
            name="fedatario_nombre",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="contrato",
            name="fecha_cierta_obtenida",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="contrato",
            name="fecha_ratificacion",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contrato",
            name="numero_instrumento",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="contrato",
            name="razon_negocio",
            field=models.TextField(blank=True, help_text="Describe el proposito economico real conforme al art. 5-A CFF"),
        ),
        migrations.CreateModel(
            name="EvidenciaMaterial",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(choices=[("ENTREGABLE", "Entregable final"), ("BITACORA", "Bitacora / minuta"), ("COMUNICACION", "Comunicacion"), ("FOTOGRAFIA", "Evidencia fotografica")], default="ENTREGABLE", max_length=20)),
                ("archivo", models.FileField(upload_to="evidencias/%Y/%m/")),
                ("descripcion", models.CharField(max_length=255)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "operacion",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="evidencias", to="materialidad.operacion"),
                ),
            ],
            options={
                "verbose_name": "Evidencia de materialidad",
                "verbose_name_plural": "Evidencias de materialidad",
                "db_table": "materialidad_evidencia_material",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="evidenciamaterial",
            index=models.Index(fields=["tipo", "created_at"], name="materialid_tipo_cr_7bf7ab_idx"),
        ),
    ]
