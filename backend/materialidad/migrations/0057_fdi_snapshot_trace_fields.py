import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0056_operationdefenseprojection"),
    ]

    operations = [
        migrations.AddField(
            model_name="fiscaldefenseindexsnapshot",
            name="confidence_score",
            field=models.DecimalField(decimal_places=1, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name="fiscaldefenseindexsnapshot",
            name="correlation_id",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="fiscaldefenseindexsnapshot",
            name="formula_version",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="fiscaldefenseindexsnapshot",
            name="pipeline_version",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
