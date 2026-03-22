from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0058_fdi_narrative"),
    ]

    operations = [
        migrations.CreateModel(
            name="FDIJobRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("command", models.CharField(choices=[("capture_fdi_snapshots", "Capture FDI Snapshots"), ("refresh_operation_defense_projections", "Refresh Operation Defense Projections")], max_length=64)),
                ("status", models.CharField(choices=[("success", "Success"), ("failure", "Failure")], max_length=16)),
                ("empresa_id", models.PositiveIntegerField(blank=True, db_index=True, null=True)),
                ("days", models.PositiveIntegerField(default=90)),
                ("refresh_projections", models.BooleanField(default=False)),
                ("projections_synced", models.PositiveIntegerField(default=0)),
                ("snapshots_created", models.PositiveIntegerField(default=0)),
                ("error_message", models.TextField(blank=True, default="")),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                ("started_at", models.DateTimeField()),
                ("finished_at", models.DateTimeField()),
                ("duration_ms", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("snapshot", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="job_runs", to="materialidad.fiscaldefenseindexsnapshot")),
            ],
            options={
                "verbose_name": "FDI job run",
                "verbose_name_plural": "FDI job runs",
                "db_table": "materialidad_fdi_job_run",
                "ordering": ("-started_at",),
            },
        ),
        migrations.AddIndex(
            model_name="fdijobrun",
            index=models.Index(fields=["tenant_slug", "started_at"], name="fdi_job_tenant_start_idx"),
        ),
        migrations.AddIndex(
            model_name="fdijobrun",
            index=models.Index(fields=["command", "status", "started_at"], name="fdi_job_cmd_status_idx"),
        ),
    ]