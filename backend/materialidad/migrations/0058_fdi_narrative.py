from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0057_fdi_snapshot_trace_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="FiscalDefenseIndexNarrative",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("empresa_id", models.PositiveIntegerField(blank=True, db_index=True, null=True)),
                ("correlation_id", models.UUIDField(db_index=True)),
                ("audience", models.CharField(max_length=16)),
                ("formula_version", models.CharField(blank=True, default="", max_length=32)),
                ("pipeline_version", models.CharField(blank=True, default="", max_length=32)),
                ("headline", models.CharField(blank=True, default="", max_length=255)),
                ("executive_summary", models.TextField(blank=True, default="")),
                ("evidence_points_json", models.JSONField(blank=True, default=list)),
                ("priority_actions_json", models.JSONField(blank=True, default=list)),
                ("payload_json", models.JSONField(blank=True, default=dict)),
                ("source", models.CharField(blank=True, default="", max_length=32)),
                ("model_name", models.CharField(blank=True, default="", max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "snapshot",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="narratives", to="materialidad.fiscaldefenseindexsnapshot"),
                ),
            ],
            options={
                "verbose_name": "FDI narrative",
                "verbose_name_plural": "FDI narratives",
                "db_table": "materialidad_fdi_narrative",
                "ordering": ("-updated_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="fiscaldefenseindexnarrative",
            constraint=models.UniqueConstraint(fields=("tenant_slug", "correlation_id", "audience"), name="fdi_narrative_tenant_corr_audience_unique"),
        ),
        migrations.AddIndex(
            model_name="fiscaldefenseindexnarrative",
            index=models.Index(fields=["tenant_slug", "updated_at"], name="fdi_narr_tenant_upd_idx"),
        ),
        migrations.AddIndex(
            model_name="fiscaldefenseindexnarrative",
            index=models.Index(fields=["tenant_slug", "empresa_id"], name="fdi_narr_tenant_emp_idx"),
        ),
    ]
