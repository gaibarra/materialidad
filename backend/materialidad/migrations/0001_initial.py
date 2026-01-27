# Generated manually for initial schema
from __future__ import annotations

import django.db.models.deletion
from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Empresa",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("razon_social", models.CharField(max_length=255)),
                ("rfc", models.CharField(max_length=13, unique=True)),
                ("regimen_fiscal", models.CharField(max_length=128)),
                ("fecha_constitucion", models.DateField()),
                ("pais", models.CharField(max_length=128)),
                ("estado", models.CharField(max_length=128)),
                ("ciudad", models.CharField(max_length=128)),
                ("email_contacto", models.EmailField(blank=True, max_length=254)),
                ("telefono_contacto", models.CharField(blank=True, max_length=32)),
                ("activo", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "materialidad_empresa",
                "ordering": ("razon_social",),
            },
        ),
        migrations.CreateModel(
            name="Proveedor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("razon_social", models.CharField(max_length=255)),
                ("rfc", models.CharField(max_length=13, unique=True)),
                ("pais", models.CharField(max_length=128)),
                ("estado", models.CharField(blank=True, max_length=128)),
                ("ciudad", models.CharField(blank=True, max_length=128)),
                ("actividad_principal", models.CharField(blank=True, max_length=255)),
                ("estatus_sat", models.CharField(blank=True, max_length=64)),
                ("correo_contacto", models.EmailField(blank=True, max_length=254)),
                ("telefono_contacto", models.CharField(blank=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "materialidad_proveedor",
                "ordering": ("razon_social",),
            },
        ),
        migrations.CreateModel(
            name="Operacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid_cfdi", models.CharField(blank=True, max_length=36)),
                ("monto", models.DecimalField(decimal_places=4, max_digits=19, validators=[MinValueValidator(0)])),
                (
                    "moneda",
                    models.CharField(
                        choices=[("MXN", "Peso mexicano"), ("USD", "Dólar estadounidense"), ("EUR", "Euro")],
                        max_length=3,
                    ),
                ),
                ("fecha_operacion", models.DateField()),
                ("tipo_operacion", models.CharField(choices=[("COMPRA", "Compra"), ("SERVICIO", "Servicio"), ("ARRENDAMIENTO", "Arrendamiento"), ("OTRO", "Otro")], max_length=16)),
                ("concepto", models.TextField(blank=True)),
                (
                    "estatus_validacion",
                    models.CharField(
                        choices=[
                            ("PENDIENTE", "Pendiente"),
                            ("EN_PROCESO", "En proceso"),
                            ("VALIDADO", "Validado"),
                            ("RECHAZADO", "Rechazado"),
                        ],
                        default="PENDIENTE",
                        max_length=16,
                    ),
                ),
                ("detalles_validacion", models.JSONField(blank=True, default=dict)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("n8n_workflow_id", models.CharField(blank=True, max_length=128)),
                ("n8n_execution_id", models.CharField(blank=True, max_length=128)),
                ("ultima_validacion", models.DateTimeField(blank=True, null=True)),
                ("creado_por_usuario_id", models.BigIntegerField(blank=True, null=True)),
                ("creado_por_email", models.EmailField(blank=True, max_length=254)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "empresa",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="operaciones", to="materialidad.empresa"),
                ),
                (
                    "proveedor",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="operaciones", to="materialidad.proveedor"),
                ),
            ],
            options={
                "db_table": "materialidad_operacion",
            },
        ),
        migrations.AddIndex(
            model_name="operacion",
            index=models.Index(fields=["estatus_validacion"], name="materialid_estatus_0e99b1_idx"),
        ),
        migrations.AddIndex(
            model_name="operacion",
            index=models.Index(fields=["fecha_operacion"], name="materialid_fecha_o_a2910f_idx"),
        ),
    ]
