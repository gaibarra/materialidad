from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0018_rename_materialid_tipo_cr_7bf7ab_idx_materialida_tipo_0f9615_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacion",
            name="nif_aplicable",
            field=models.CharField(
                blank=True,
                help_text="Referencia NIF sugerida (ej. NIF D-1 ingresos, C-6 propiedades, C-8 intangibles)",
                max_length=128,
            ),
        ),
        migrations.AddField(
            model_name="operacion",
            name="poliza_contable",
            field=models.FileField(
                blank=True,
                help_text="Póliza que soporta la sustancia económica de la operación",
                null=True,
                upload_to="contabilidad/",
            ),
        ),
        migrations.AddField(
            model_name="operacion",
            name="observacion_contable",
            field=models.TextField(
                blank=True,
                help_text="Notas sobre la sustancia económica vs forma jurídica (NIF A-2)",
            ),
        ),
    ]
