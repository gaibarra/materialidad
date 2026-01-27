from __future__ import annotations


def public_model_label(model_name: str | None) -> str:
    """Map internal model names to a user-friendly label."""

    if not model_name:
        return "gpt-5-mini"
    lowered = model_name.lower()
    if "gpt-4" in lowered:
        return "gpt-5-mini"
    return model_name
