from __future__ import annotations

from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Contrato",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=255)),
                ("codigo_interno", models.CharField(blank=True, max_length=64)),
                (
                    "categoria",
                    models.CharField(
                        choices=[
                            ("BASE_CORPORATIVA", "Base corporativa"),
                            ("CLIENTES", "Clientes / ingresos"),
                            ("PROVEEDORES", "Proveedores / egresos"),
                            ("CAPITAL_HUMANO", "Capital humano"),
                            ("FINANCIERO", "Financiero / crédito"),
                            ("ACTIVOS", "Activos fijos e intangibles"),
                            ("PARTES_RELACIONADAS", "Partes relacionadas"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "proceso",
                    models.CharField(
                        choices=[
                            ("COMPRAS", "Compras"),
                            ("VENTAS", "Ventas"),
                            ("NOMINA", "Nómina"),
                            ("TESORERIA", "Tesorería"),
                            ("OPERACIONES", "Operaciones"),
                            ("GOBIERNO_CORPORATIVO", "Gobierno corporativo"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "tipo_empresa",
                    models.CharField(
                        choices=[
                            ("COMERCIAL", "Comercial"),
                            ("INDUSTRIAL", "Industrial"),
                            ("SERVICIOS", "Servicios"),
                            ("MIXTA", "Mixta"),
                        ],
                        default="MIXTA",
                        max_length=16,
                    ),
                ),
                ("fecha_firma", models.DateField(blank=True, null=True)),
                ("vigencia_inicio", models.DateField(blank=True, null=True)),
                ("vigencia_fin", models.DateField(blank=True, null=True)),
                ("descripcion", models.TextField(blank=True)),
                ("es_marco", models.BooleanField(default=False)),
                ("soporte_documental", models.CharField(blank=True, max_length=255)),
                ("expediente_externo", models.URLField(blank=True)),
                ("activo", models.BooleanField(default=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "empresa",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contratos", to="materialidad.empresa"),
                ),
                (
                    "proveedor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="contratos",
                        to="materialidad.proveedor",
                    ),
                ),
            ],
            options={
                "db_table": "materialidad_contrato",
                "ordering": ("-vigencia_inicio", "nombre"),
            },
        ),
        migrations.AddIndex(
            model_name="contrato",
            index=models.Index(fields=["categoria", "proceso"], name="contrato_cat_proc_idx"),
        ),
        migrations.AddConstraint(
            model_name="contrato",
            constraint=models.UniqueConstraint(
                condition=~Q(codigo_interno=""),
                fields=("empresa", "codigo_interno"),
                name="contrato_codigo_empresa_unico",
            ),
        ),
        migrations.AddField(
            model_name="operacion",
            name="contrato",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="operaciones",
                to="materialidad.contrato",
            ),
        ),
        migrations.AddIndex(
            model_name="operacion",
            index=models.Index(fields=["contrato"], name="operacion_contrato_idx"),
        ),
    ]
