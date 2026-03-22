from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0047_add_compliance_pillars"),
    ]

    operations = [
        migrations.CreateModel(
            name="FiscalDefenseIndexSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("empresa_id", models.PositiveIntegerField(blank=True, db_index=True, null=True)),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("score", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                (
                    "level",
                    models.CharField(
                        choices=[
                            ("NO_DATA", "Sin datos suficientes"),
                            ("CRITICO", "Critico"),
                            ("DEBIL", "Debil"),
                            ("CONTROLADO", "Controlado"),
                            ("ROBUSTO", "Robusto"),
                        ],
                        default="NO_DATA",
                        max_length=16,
                    ),
                ),
                ("dm", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("se", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("sc", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("ec", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("do", models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ("inputs_json", models.JSONField(blank=True, default=dict)),
                ("actions_json", models.JSONField(blank=True, default=list)),
                ("source", models.CharField(default="scheduled", max_length=32)),
                ("captured_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "FDI snapshot",
                "verbose_name_plural": "FDI snapshots",
                "db_table": "materialidad_fdi_snapshot",
                "ordering": ("-captured_at",),
            },
        ),
        migrations.AddIndex(
            model_name="fiscaldefenseindexsnapshot",
            index=models.Index(fields=["tenant_slug", "captured_at"], name="fdi_tenant_captured_idx"),
        ),
        migrations.AddIndex(
            model_name="fiscaldefenseindexsnapshot",
            index=models.Index(
                fields=["tenant_slug", "empresa_id", "captured_at"],
                name="fdi_tenant_empresa_cap_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="fiscaldefenseindexsnapshot",
            index=models.Index(fields=["tenant_slug", "period_start", "period_end"], name="fdi_tenant_period_idx"),
        ),
    ]
