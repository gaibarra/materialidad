import uuid

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0055_operacionchecklist_operacionchecklistitem_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperationDefenseProjection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("formula_version", models.CharField(max_length=32)),
                ("pipeline_version", models.CharField(max_length=32)),
                ("correlation_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False)),
                ("profile", models.CharField(blank=True, default="", max_length=32)),
                ("included_in_fdi", models.BooleanField(default=False)),
                ("score_base", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("confidence_score", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("dm", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("se", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("sc", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("ec", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("do", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("input_integrity", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("completeness_quality", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("freshness_quality", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("risk_flags_json", models.JSONField(blank=True, default=list)),
                ("inputs_json", models.JSONField(blank=True, default=dict)),
                ("captured_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "empresa",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="operation_defense_projections", to="materialidad.empresa"),
                ),
                (
                    "operacion",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="defense_projection", to="materialidad.operacion"),
                ),
                (
                    "proveedor",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="operation_defense_projections", to="materialidad.proveedor"),
                ),
            ],
            options={
                "verbose_name": "Operation defense projection",
                "verbose_name_plural": "Operation defense projections",
                "db_table": "materialidad_operation_defense_projection",
                "ordering": ("-captured_at",),
            },
        ),
        migrations.AddIndex(
            model_name="operationdefenseprojection",
            index=models.Index(fields=["tenant_slug", "captured_at"], name="odp_tenant_captured_idx"),
        ),
        migrations.AddIndex(
            model_name="operationdefenseprojection",
            index=models.Index(fields=["tenant_slug", "empresa", "included_in_fdi"], name="odp_tenant_emp_incl_idx"),
        ),
        migrations.AddIndex(
            model_name="operationdefenseprojection",
            index=models.Index(fields=["formula_version", "pipeline_version"], name="odp_formula_pipeline_idx"),
        ),
    ]