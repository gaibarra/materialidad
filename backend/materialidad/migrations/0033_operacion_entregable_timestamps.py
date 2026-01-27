from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0032_proveedor_capacidad_economica_mensual_cuentabancaria_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacionentregable",
            name="evidencia_cargada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operacionentregable",
            name="recepcion_firmada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operacionentregable",
            name="recepcion_firmado_por",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="operacionentregable",
            name="recepcion_firmado_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
    ]
