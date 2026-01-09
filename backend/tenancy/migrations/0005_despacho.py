from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0004_tenantprovisionlog"),
    ]

    operations = [
        migrations.CreateModel(
            name="Despacho",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=255)),
                ("tipo", models.CharField(choices=[("despacho", "Despacho"), ("corporativo", "Corporativo")], default="despacho", max_length=20)),
                ("contacto_email", models.EmailField(blank=True, max_length=254)),
                ("contacto_telefono", models.CharField(blank=True, max_length=50)),
                ("notas", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "tenancy_despacho",
                "ordering": ["nombre"],
                "verbose_name": "Despacho",
                "verbose_name_plural": "Despachos",
            },
        ),
        migrations.AddField(
            model_name="tenant",
            name="despacho",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="tenants", to="tenancy.despacho"),
        ),
    ]
