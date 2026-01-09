# Generated manually for checklist features
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0019_operacion_nif_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Checklist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("nombre", models.CharField(max_length=255)),
                ("tipo_gasto", models.CharField(blank=True, default="", max_length=128)),
                ("vigente", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "materialidad_checklist",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="DeliverableRequirement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_slug", models.SlugField(db_index=True, max_length=255)),
                ("tipo_gasto", models.CharField(max_length=128)),
                ("codigo", models.CharField(max_length=64)),
                ("titulo", models.CharField(max_length=255)),
                ("descripcion", models.TextField(blank=True, default="")),
                ("pillar", models.CharField(choices=[("ENTREGABLES", "Entregables"), ("RAZON_NEGOCIO", "Razón de negocio"), ("CAPACIDAD_PROVEEDOR", "Capacidad del proveedor"), ("FECHA_CIERTA", "Fecha cierta")], default="ENTREGABLES", max_length=32)),
                ("requerido", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "materialidad_entregable_requirement",
                "ordering": ("tipo_gasto", "codigo"),
                "unique_together": {("tenant_slug", "tipo_gasto", "codigo")},
            },
        ),
        migrations.CreateModel(
            name="ChecklistItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("pillar", models.CharField(choices=[("ENTREGABLES", "Entregables"), ("RAZON_NEGOCIO", "Razón de negocio"), ("CAPACIDAD_PROVEEDOR", "Capacidad del proveedor"), ("FECHA_CIERTA", "Fecha cierta")], max_length=32)),
                ("titulo", models.CharField(max_length=255)),
                ("descripcion", models.TextField(blank=True, default="")),
                ("requerido", models.BooleanField(default=True)),
                ("estado", models.CharField(choices=[("PENDIENTE", "Pendiente"), ("EN_PROCESO", "En proceso"), ("COMPLETO", "Completo")], default="PENDIENTE", max_length=16)),
                ("vence_el", models.DateField(blank=True, null=True)),
                ("responsable", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("checklist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="materialidad.checklist")),
            ],
            options={
                "db_table": "materialidad_checklist_item",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="checklist",
            index=models.Index(fields=["tenant_slug", "tipo_gasto"], name="materialid_tenant__idx"),
        ),
        migrations.AddIndex(
            model_name="deliverablerequirement",
            index=models.Index(fields=["tenant_slug", "tipo_gasto"], name="materialid_deliv_ty_idx"),
        ),
        migrations.AddIndex(
            model_name="checklistitem",
            index=models.Index(fields=["pillar", "estado"], name="materialid_pillar_s_idx"),
        ),
    ]
