from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0048_fiscaldefenseindexsnapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="legalreferencesource",
            name="autoridad_emisora",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="es_vigente",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="estatus_vigencia",
            field=models.CharField(
                choices=[
                    ("VIGENTE", "Vigente"),
                    ("DESCONOCIDA", "Desconocida"),
                    ("HISTORICA", "Histórica"),
                    ("DEROGADA", "Derogada"),
                    ("ABROGADA", "Abrogada"),
                ],
                default="VIGENTE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="fecha_ultima_revision",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="fecha_vigencia_desde",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="fecha_vigencia_hasta",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["es_vigente", "tipo_fuente"], name="materialida_es_vig_c73477_idx"),
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["estatus_vigencia", "fecha_ultima_revision"], name="materialida_estatu_bdd87a_idx"),
        ),
    ]