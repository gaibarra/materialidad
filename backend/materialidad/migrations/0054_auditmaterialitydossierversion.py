from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0053_auditmaterialitydossier_last_editor"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditMaterialityDossierVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version_number", models.PositiveIntegerField()),
                ("payload", models.JSONField(blank=True, default=dict)),
                (
                    "source",
                    models.CharField(
                        choices=[("MANUAL", "Guardado manual"), ("AUTOSAVE", "Autosave"), ("RESTORE", "Restauración")],
                        default="MANUAL",
                        max_length=16,
                    ),
                ),
                ("edited_by_email", models.EmailField(blank=True, max_length=254)),
                ("edited_by_name", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "dossier",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versions",
                        to="materialidad.auditmaterialitydossier",
                    ),
                ),
            ],
            options={
                "verbose_name": "Versión de expediente de materialidad de auditoría",
                "verbose_name_plural": "Versiones de expediente de materialidad de auditoría",
                "db_table": "materialidad_audit_materiality_dossier_version",
                "ordering": ("-version_number", "-created_at"),
            },
        ),
        migrations.AddConstraint(
            model_name="auditmaterialitydossierversion",
            constraint=models.UniqueConstraint(fields=("dossier", "version_number"), name="audit_materiality_dossier_version_unique"),
        ),
        migrations.AddIndex(
            model_name="auditmaterialitydossierversion",
            index=models.Index(fields=["dossier", "-version_number"], name="audit_materiality_version_idx"),
        ),
    ]
