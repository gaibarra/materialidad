from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("materialidad", "0015_dedupe_legal_consultations"),
    ]

    operations = [
        migrations.AddField(
            model_name="legalconsultation",
            name="is_deduplicated",
            field=models.BooleanField(default=False),
        ),
    ]
