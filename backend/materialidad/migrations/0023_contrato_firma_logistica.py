from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0022_operacion_cfdi_spei"),
    ]

    operations = [
        migrations.AddField(
            model_name="contrato",
            name="archivo_notariado_url",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contrato",
            name="contacto_responsable",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="contrato",
            name="fecha_cierta_requerida",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="contrato",
            name="fecha_cita_firma",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contrato",
            name="firma_modalidad",
            field=models.CharField(
                choices=[
                    ("NOTARIAL", "Notarial (fecha cierta)"),
                    ("ELECTRONICA", "Electrónica avanzada"),
                    ("MANUSCRITA", "Manuscrita / física"),
                ],
                default="NOTARIAL",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="contrato",
            name="logistica_estado",
            field=models.CharField(
                choices=[
                    ("PENDIENTE", "Pendiente"),
                    ("AGENDADA", "Agendada"),
                    ("EN_PROCESO", "En proceso"),
                    ("COMPLETADA", "Completada"),
                    ("CANCELADA", "Cancelada"),
                ],
                default="PENDIENTE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="contrato",
            name="lugar_cita",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="contrato",
            name="notas_logistica",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contrato",
            name="responsable_logistica",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
