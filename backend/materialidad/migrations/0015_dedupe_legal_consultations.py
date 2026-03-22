from __future__ import annotations

from django.db import migrations


def dedupe_consultations(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    # Si la tabla no existe (tenant fresco sin consultas), omitir.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_class WHERE relname = 'materialidad_legal_consultation'"
        )
        if cursor.fetchone() is None:
            return

    LegalConsultation = apps.get_model("materialidad", "LegalConsultation")
    alias = schema_editor.connection.alias
    seen = set()
    duplicates = []
    queryset = LegalConsultation.objects.using(alias).order_by(
        "tenant_slug",
        "question",
        "context",
        "-created_at",
        "-id",
    )
    for consultation in queryset.iterator():
        normalized_question = (consultation.question or "").strip().lower()
        normalized_context = (consultation.context or "").strip().lower()
        key = (consultation.tenant_slug, normalized_question, normalized_context)
        if key in seen:
            duplicates.append(consultation.pk)
        else:
            seen.add(key)
    if duplicates:
        LegalConsultation.objects.using(alias).filter(pk__in=duplicates).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("materialidad", "0014_move_legal_consultations_to_control_db"),
    ]

    operations = [migrations.RunPython(dedupe_consultations, noop)]
