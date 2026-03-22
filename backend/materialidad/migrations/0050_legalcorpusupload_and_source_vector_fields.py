from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("materialidad", "0049_legalreferencesource_vigency_metadata"),
    ]

    operations = [
        migrations.CreateModel(
            name="LegalCorpusUpload",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("titulo", models.CharField(max_length=255)),
                ("slug", models.SlugField(max_length=255, unique=True)),
                ("archivo", models.FileField(upload_to="legal_corpus/%Y/%m/")),
                ("autoridad", models.CharField(choices=[("DOF", "Diario Oficial de la Federación"), ("SAT", "SAT"), ("SCJN", "Suprema Corte de Justicia de la Nación"), ("TFJA", "Tribunal Federal de Justicia Administrativa"), ("OTRO", "Otra autoridad")], default="DOF", max_length=16)),
                ("ordenamiento", models.CharField(max_length=255)),
                ("tipo_fuente", models.CharField(choices=[("LEY", "Ley"), ("REGLAMENTO", "Reglamento"), ("NOM", "Norma Oficial"), ("CRITERIO_SAT", "Criterio SAT"), ("RESOLUCION", "Resolución")], default="LEY", max_length=32)),
                ("estatus", models.CharField(choices=[("PENDIENTE", "Pendiente"), ("PROCESANDO", "Procesando"), ("COMPLETADO", "Completado"), ("ERROR", "Error")], default="PENDIENTE", max_length=16)),
                ("estatus_vigencia", models.CharField(choices=[("VIGENTE", "Vigente"), ("DESCONOCIDA", "Desconocida"), ("HISTORICA", "Histórica"), ("DEROGADA", "Derogada"), ("ABROGADA", "Abrogada")], default="VIGENTE", max_length=16)),
                ("es_vigente", models.BooleanField(default=True)),
                ("force_vigencia", models.BooleanField(default=False)),
                ("fecha_vigencia_desde", models.DateField(blank=True, null=True)),
                ("fecha_vigencia_hasta", models.DateField(blank=True, null=True)),
                ("fecha_ultima_revision", models.DateField(blank=True, null=True)),
                ("vigencia", models.CharField(blank=True, max_length=255)),
                ("fuente_documento", models.CharField(blank=True, max_length=255)),
                ("fuente_url", models.URLField(blank=True)),
                ("sat_categoria", models.CharField(blank=True, max_length=64)),
                ("total_fragmentos", models.PositiveIntegerField(default=0)),
                ("fragmentos_procesados", models.PositiveIntegerField(default=0)),
                ("error_detalle", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="legal_corpus_uploads", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "materialidad_legal_corpus_upload",
                "verbose_name": "Corpus legal",
                "verbose_name_plural": "Corpus legales",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="corpus_upload",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sources", to="materialidad.legalcorpusupload"),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="ordenamiento",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="vectorizacion",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="vectorizacion_dim",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="vectorizacion_modelo",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="legalreferencesource",
            name="vectorizado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="legalcorpusupload",
            index=models.Index(fields=["autoridad", "ordenamiento"], name="materialida_autori_1b02b5_idx"),
        ),
        migrations.AddIndex(
            model_name="legalcorpusupload",
            index=models.Index(fields=["estatus", "created_at"], name="materialida_estatu_81525c_idx"),
        ),
        migrations.AddIndex(
            model_name="legalcorpusupload",
            index=models.Index(fields=["es_vigente", "fecha_ultima_revision"], name="materialida_es_vig_b57207_idx"),
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["ordenamiento", "autoridad_emisora"], name="materialida_ordena_6226c5_idx"),
        ),
        migrations.AddIndex(
            model_name="legalreferencesource",
            index=models.Index(fields=["corpus_upload", "es_vigente"], name="materialida_corpus__44a538_idx"),
        ),
    ]
