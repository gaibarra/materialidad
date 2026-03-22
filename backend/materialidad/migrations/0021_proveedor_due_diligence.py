from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0020_checklists"),
    ]

    operations = [
        migrations.AddField(
            model_name="proveedor",
            name="detalle_validacion",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="estatus_69b",
            field=models.CharField(
                choices=[
                    ("SIN_COINCIDENCIA", "Sin coincidencias"),
                    ("PRESUNTO", "Presunto"),
                    ("DEFINITIVO", "Definitivo"),
                ],
                default="SIN_COINCIDENCIA",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="riesgo_fiscal",
            field=models.CharField(
                choices=[("BAJO", "Bajo"), ("MEDIO", "Medio"), ("ALTO", "Alto")],
                default="BAJO",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="riesgos_detectados",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="ultima_validacion_69b",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="ultima_validacion_sat",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="proveedor",
            index=models.Index(fields=["estatus_69b", "riesgo_fiscal"], name="proveedor_69b_riesgo_idx"),
        ),
    ]
