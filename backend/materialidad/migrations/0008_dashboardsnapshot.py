from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0007_contractcitationcache_flags"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(max_length=255, db_index=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("cobertura_contractual", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ("contratos_por_vencer_30", models.PositiveIntegerField(default=0)),
                ("operaciones_pendientes", models.PositiveIntegerField(default=0)),
                ("proveedores_sin_validacion_sat", models.PositiveIntegerField(default=0)),
                ("monto_validado_mxn", models.DecimalField(decimal_places=2, default=0, max_digits=19)),
                ("captured_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "materialidad_dashboard_snapshot",
                "ordering": ("-captured_at",),
                "verbose_name": "Dashboard snapshot",
                "verbose_name_plural": "Dashboard snapshots",
            },
        ),
        migrations.AddIndex(
            model_name="dashboardsnapshot",
            index=models.Index(fields=["tenant_slug", "captured_at"], name="materiali_tenant__4ab1e6_idx"),
        ),
    ]
