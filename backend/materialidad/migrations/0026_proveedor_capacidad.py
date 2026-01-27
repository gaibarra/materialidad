from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0025_operacion_nif_aplicable_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="proveedor",
            name="reps_registro",
            field=models.CharField(blank=True, help_text="Registro REPS/IMSS si aplica", max_length=64),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="imss_patronal",
            field=models.CharField(blank=True, help_text="Registro patronal IMSS", max_length=64),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="activos_relevantes",
            field=models.JSONField(blank=True, default=list, help_text="Activos fijos o equipos clave"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="personal_clave",
            field=models.JSONField(blank=True, default=list, help_text="Personal asignado y CV"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="fotos_domicilio",
            field=models.JSONField(blank=True, default=list, help_text="URLs de fotos del domicilio fiscal"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="sitio_web",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="sitio_web_capturas",
            field=models.JSONField(blank=True, default=list, help_text="Capturas o URLs de evidencia web"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="notas_capacidad",
            field=models.TextField(blank=True),
        ),
    ]
