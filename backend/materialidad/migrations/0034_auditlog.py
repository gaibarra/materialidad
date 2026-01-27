from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0033_operacion_entregable_timestamps"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id", models.BigIntegerField(blank=True, null=True)),
                ("actor_email", models.EmailField(blank=True, default="", max_length=254)),
                ("actor_name", models.CharField(blank=True, default="", max_length=255)),
                ("action", models.CharField(max_length=64)),
                ("object_type", models.CharField(max_length=128)),
                ("object_id", models.CharField(max_length=64)),
                ("object_repr", models.CharField(blank=True, default="", max_length=255)),
                ("changes", models.JSONField(blank=True, default=dict)),
                ("source_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "materialidad_audit_log",
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["object_type", "object_id", "action"], name="audit_obj_action_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["created_at"], name="audit_created_idx"),
        ),
    ]
