from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("materialidad", "0052_auditmaterialitydossier"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditmaterialitydossier",
            name="last_edited_by_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="auditmaterialitydossier",
            name="last_edited_by_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
