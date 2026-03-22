from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0051_rename_materialida_autori_1b02b5_idx_materialida_autorid_28442b_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditMaterialityDossier",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ejercicio", models.PositiveIntegerField(db_index=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="audit_materiality_dossiers",
                        to="materialidad.empresa",
                    ),
                ),
            ],
            options={
                "verbose_name": "Expediente de materialidad de auditoría",
                "verbose_name_plural": "Expedientes de materialidad de auditoría",
                "db_table": "materialidad_audit_materiality_dossier",
                "ordering": ("-updated_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="auditmaterialitydossier",
            constraint=models.UniqueConstraint(fields=("empresa", "ejercicio"), name="audit_materiality_empresa_ej_unique"),
        ),
        migrations.AddIndex(
            model_name="auditmaterialitydossier",
            index=models.Index(fields=["empresa", "ejercicio"], name="audit_materiality_emp_ej_idx"),
        ),
        migrations.AddIndex(
            model_name="auditmaterialitydossier",
            index=models.Index(fields=["updated_at"], name="audit_materiality_updated_idx"),
        ),
    ]
