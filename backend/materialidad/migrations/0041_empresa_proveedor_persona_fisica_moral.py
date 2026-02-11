"""Add persona física/moral distinction, domicilio fiscal, contacto principal,
and Constancia de Situación Fiscal fields to Empresa and Proveedor."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0040_add_fedatario_catalog"),
    ]

    operations = [
        # ── Empresa: new fields ──
        migrations.AddField(
            model_name="empresa",
            name="tipo_persona",
            field=models.CharField(
                max_length=8,
                choices=[("MORAL", "Persona moral"), ("FISICA", "Persona física")],
                default="MORAL",
                help_text="Persona moral o persona física",
            ),
        ),
        migrations.AddField(
            model_name="empresa",
            name="actividad_economica",
            field=models.CharField(max_length=255, blank=True, help_text="Actividad económica principal SAT"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="nombre",
            field=models.CharField(max_length=128, blank=True, help_text="Nombre(s) — solo persona física"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="apellido_paterno",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="apellido_materno",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="curp",
            field=models.CharField(max_length=18, blank=True, help_text="CURP — solo persona física"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="calle",
            field=models.CharField(max_length=255, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="no_exterior",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="no_interior",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="colonia",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="codigo_postal",
            field=models.CharField(max_length=10, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="municipio",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="contacto_nombre",
            field=models.CharField(max_length=255, blank=True, help_text="Nombre del contacto principal"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="contacto_puesto",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="contacto_email",
            field=models.EmailField(max_length=254, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="contacto_telefono",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="empresa",
            name="csf_archivo",
            field=models.FileField(upload_to="empresas/csf/%Y/%m/", null=True, blank=True, help_text="PDF de Constancia de Situación Fiscal"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="csf_datos_extraidos",
            field=models.JSONField(default=dict, blank=True, help_text="Datos extraídos automáticamente del PDF"),
        ),
        migrations.AddField(
            model_name="empresa",
            name="csf_fecha_emision",
            field=models.DateField(null=True, blank=True, help_text="Fecha de emisión de la CSF"),
        ),
        # Make fecha_constitucion nullable for PF
        migrations.AlterField(
            model_name="empresa",
            name="fecha_constitucion",
            field=models.DateField(null=True, blank=True, help_text="Fecha de constitución (PM) o inicio de actividades (PF)"),
        ),
        # Default pais
        migrations.AlterField(
            model_name="empresa",
            name="pais",
            field=models.CharField(max_length=128, default="México"),
        ),
        migrations.AlterField(
            model_name="empresa",
            name="ciudad",
            field=models.CharField(max_length=128, blank=True),
        ),

        # ── Proveedor: new fields ──
        migrations.AddField(
            model_name="proveedor",
            name="tipo_persona",
            field=models.CharField(
                max_length=8,
                choices=[("MORAL", "Persona moral"), ("FISICA", "Persona física")],
                default="MORAL",
            ),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="nombre",
            field=models.CharField(max_length=128, blank=True, help_text="Nombre(s) — solo persona física"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="apellido_paterno",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="apellido_materno",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="curp",
            field=models.CharField(max_length=18, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="calle",
            field=models.CharField(max_length=255, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="no_exterior",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="no_interior",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="colonia",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="codigo_postal",
            field=models.CharField(max_length=10, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="municipio",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="regimen_fiscal",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="contacto_nombre",
            field=models.CharField(max_length=255, blank=True, help_text="Nombre del contacto principal"),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="contacto_puesto",
            field=models.CharField(max_length=128, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="contacto_email",
            field=models.EmailField(max_length=254, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="contacto_telefono",
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="csf_archivo",
            field=models.FileField(upload_to="proveedores/csf/%Y/%m/", null=True, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="csf_datos_extraidos",
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.AddField(
            model_name="proveedor",
            name="csf_fecha_emision",
            field=models.DateField(null=True, blank=True),
        ),
        # Default pais for proveedor
        migrations.AlterField(
            model_name="proveedor",
            name="pais",
            field=models.CharField(max_length=128, default="México"),
        ),
    ]
