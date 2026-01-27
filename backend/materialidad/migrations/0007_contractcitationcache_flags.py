from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0006_contractcitationcache"),
    ]

    operations = [
        migrations.AddField(
            model_name="contractcitationcache",
            name="is_stale",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="contractcitationcache",
            name="regenerations",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
