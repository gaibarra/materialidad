from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0059_fdi_job_run"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fdijobrun",
            name="command",
            field=models.CharField(
                choices=[
                    ("capture_fdi_snapshots", "Capture FDI Snapshots"),
                    ("refresh_operation_defense_projections", "Refresh Operation Defense Projections"),
                    ("backfill_fdi_formula_version", "Backfill FDI Formula Version"),
                ],
                max_length=64,
            ),
        ),
    ]