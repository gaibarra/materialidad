from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0026_proveedor_capacidad"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperacionEntregable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("titulo", models.CharField(max_length=255)),
                ("descripcion", models.TextField(blank=True, default="")),
                ("tipo_gasto", models.CharField(blank=True, default="", max_length=128)),
                ("codigo", models.CharField(blank=True, default="", max_length=64)),
                (
                    "pillar",
                    models.CharField(
                        choices=[
                            ("ENTREGABLES", "Entregables"),
                            ("RAZON_NEGOCIO", "Razon de negocio"),
                            ("CAPACIDAD_PROVEEDOR", "Capacidad del proveedor"),
                            ("FECHA_CIERTA", "Fecha cierta"),
                        ],
                        default="ENTREGABLES",
                        max_length=32,
                    ),
                ),
                ("requerido", models.BooleanField(default=True)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("PENDIENTE", "Pendiente"),
                            ("EN_PROCESO", "En proceso"),
                            ("ENTREGADO", "Entregado"),
                            ("RECIBIDO", "Recibido"),
                            ("FACTURADO", "Facturado"),
                        ],
                        default="PENDIENTE",
                        max_length=16,
                    ),
                ),
                ("fecha_compromiso", models.DateField(blank=True, null=True)),
                ("fecha_entregado", models.DateField(blank=True, null=True)),
                ("fecha_recepcion", models.DateField(blank=True, null=True)),
                ("fecha_factura", models.DateField(blank=True, null=True)),
                ("oc_numero", models.CharField(blank=True, default="", max_length=128)),
                ("oc_fecha", models.DateField(blank=True, null=True)),
                ("oc_archivo_url", models.URLField(blank=True, default="")),
                ("comentarios", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "operacion",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entregables", to="materialidad.operacion"),
                ),
                (
                    "requirement",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="operacion_entregables", to="materialidad.deliverablerequirement"),
                ),
            ],
            options={
                "db_table": "materialidad_operacion_entregable",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="operacionentregable",
            index=models.Index(fields=["operacion", "estado"], name="materialid_op_2348ef_idx"),
        ),
        migrations.AddIndex(
            model_name="operacionentregable",
            index=models.Index(fields=["codigo", "tipo_gasto"], name="materialid_co_3ec61f_idx"),
        ),
    ]
