from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0044_evidenciamaterial_estatus_revision_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AlertaOperacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo_alerta",
                    models.CharField(
                        choices=[
                            ("FALTANTES_CRITICOS", "Faltantes críticos de expediente"),
                            ("VENCIMIENTO_EVIDENCIA", "Vencimiento de evidencia"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "estatus",
                    models.CharField(
                        choices=[
                            ("ACTIVA", "Activa"),
                            ("EN_SEGUIMIENTO", "En seguimiento"),
                            ("CERRADA", "Cerrada"),
                        ],
                        default="ACTIVA",
                        max_length=20,
                    ),
                ),
                ("clave_dedupe", models.CharField(max_length=128)),
                ("owner_email", models.EmailField(blank=True, max_length=254)),
                ("motivo", models.TextField()),
                ("detalle", models.JSONField(blank=True, default=dict)),
                ("fecha_alerta", models.DateTimeField(default=django.utils.timezone.now)),
                ("fecha_cierre", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "empresa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alertas_operacion",
                        to="materialidad.empresa",
                    ),
                ),
                (
                    "operacion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alertas",
                        to="materialidad.operacion",
                    ),
                ),
                (
                    "proveedor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alertas_operacion",
                        to="materialidad.proveedor",
                    ),
                ),
            ],
            options={
                "verbose_name": "Alerta de operación",
                "verbose_name_plural": "Alertas de operación",
                "db_table": "materialidad_alerta_operacion",
                "ordering": ("-fecha_alerta",),
            },
        ),
        migrations.AddIndex(
            model_name="alertaoperacion",
            index=models.Index(fields=["empresa", "estatus"], name="alerta_op_emp_est_idx"),
        ),
        migrations.AddIndex(
            model_name="alertaoperacion",
            index=models.Index(fields=["proveedor", "estatus"], name="alerta_op_prv_est_idx"),
        ),
        migrations.AddIndex(
            model_name="alertaoperacion",
            index=models.Index(fields=["tipo_alerta", "estatus"], name="alerta_op_tipo_est_idx"),
        ),
        migrations.AddIndex(
            model_name="alertaoperacion",
            index=models.Index(fields=["clave_dedupe"], name="alerta_op_clave_idx"),
        ),
        migrations.AddConstraint(
            model_name="alertaoperacion",
            constraint=models.UniqueConstraint(
                condition=Q(estatus="ACTIVA"),
                fields=("clave_dedupe",),
                name="alerta_operacion_clave_activa_unica",
            ),
        ),
    ]
