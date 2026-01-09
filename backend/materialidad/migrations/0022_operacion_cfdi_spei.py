from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0021_proveedor_due_diligence"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacion",
            name="ultima_validacion_cfdi",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operacion",
            name="ultima_validacion_spei",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operacion",
            name="referencia_spei",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="operacion",
            name="cfdi_estatus",
            field=models.CharField(
                choices=[("PENDIENTE", "Pendiente"), ("VALIDO", "Válido"), ("INVALIDO", "Inválido")],
                default="PENDIENTE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="operacion",
            name="spei_estatus",
            field=models.CharField(
                choices=[("PENDIENTE", "Pendiente"), ("VALIDADO", "Validado"), ("NO_ENCONTRADO", "No encontrado")],
                default="PENDIENTE",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="operacion",
            index=models.Index(fields=["cfdi_estatus", "spei_estatus"], name="operacion_cfdi_spei_idx"),
        ),
    ]
