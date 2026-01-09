from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
import requests
from openai import OpenAI
from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    NotFoundError,
    OpenAIError,
)

__all__ = [
    "ChatMessage",
    "OpenAIClient",
    "OpenAIClientError",
    "OpenAIModelNotFoundError",
]


@dataclass(frozen=True)
class ChatMessage:
    """Mensaje simple para peticiones de chat."""

    role: Literal["system", "user", "assistant"]
    content: str


class OpenAIClientError(RuntimeError):
    """Señala problemas al interactuar con OpenAI."""


class OpenAIModelNotFoundError(OpenAIClientError):
    """Modelo configurado no disponible."""


class OpenAIClient:
    """Cliente reutilizable para invocar GPT-5 mini desde el backend."""

    def __init__(self, *, model: str | None = None) -> None:
        self._provider = getattr(settings, "AI_PROVIDER", "openai").lower()
        self._last_used_model: str | None = None

        if self._provider == "perplexity":
            self._configure_perplexity(model)
        else:
            self._provider = "openai"
            self._configure_openai(model)

    @property
    def model_name(self) -> str:
        """Modelo utilizado en la última llamada (o el primario configurado)."""

        if self._provider == "perplexity":
            return self._perplexity_model
        return self._last_used_model or self._primary_model

    def generate_text(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float = 0.2,
        max_output_tokens: int = 800,
    ) -> str:
        if not messages:
            raise ValueError("messages no puede estar vacío")

        payload = [
            {"role": message.role, "content": message.content}
            for message in messages
        ]

        if self._provider == "perplexity":
            text = self._generate_perplexity_with_continuations(
                payload,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
            self._last_used_model = self._perplexity_model
            return text

        use_responses_api = hasattr(self._client, "responses")
        models_to_try: list[str] = [self._primary_model]
        if self._fallback_model and self._fallback_model not in models_to_try:
            models_to_try.append(self._fallback_model)

        last_error: OpenAIClientError | None = None

        for candidate_model in models_to_try:
            try:
                if use_responses_api:
                    text = self._generate_via_responses(
                        payload,
                        model_name=candidate_model,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                    )
                else:
                    text = self._generate_via_chat(
                        payload,
                        model_name=candidate_model,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                    )
                self._last_used_model = candidate_model
                return text
            except OpenAIModelNotFoundError as exc:
                last_error = exc
                continue
            except OpenAIClientError as exc:
                last_error = exc
                break

        if last_error:
            raise last_error
        raise OpenAIClientError("No se pudo generar texto con OpenAI")

    def _generate_via_responses(
        self,
        payload: list[dict[str, str]],
        *,
        model_name: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        try:
            response = self._client.responses.create(
                model=model_name,
                input=payload,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
        except NotFoundError as exc:
            raise OpenAIModelNotFoundError(
                f"Modelo {model_name} no disponible: {exc}"
            ) from exc
        except (APIError, APIConnectionError, APITimeoutError, OpenAIError) as exc:
            raise OpenAIClientError(
                f"Error al invocar el modelo de OpenAI: {exc}"
            ) from exc

        text = getattr(response, "output_text", None)
        if text:
            return text.strip()

        chunks: list[str] = []
        for item in getattr(response, "output", []) or []:
            if getattr(item, "type", None) != "message":
                continue
            for content in getattr(item, "content", []) or []:
                chunk = getattr(content, "text", None)
                if chunk:
                    chunks.append(chunk)

        if not chunks:
            raise OpenAIClientError(
                "La respuesta de OpenAI no incluyó texto utilizable"
            )

        return "".join(chunks).strip()

    def _generate_via_chat(
        self,
        payload: list[dict[str, str]],
        *,
        model_name: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        try:
            response = self._client.chat.completions.create(
                model=model_name,
                messages=payload,
                temperature=temperature,
                max_tokens=max_output_tokens,
            )
        except NotFoundError as exc:
            raise OpenAIModelNotFoundError(
                f"Modelo {model_name} no disponible: {exc}"
            ) from exc
        except (APIError, APIConnectionError, APITimeoutError, OpenAIError) as exc:
            raise OpenAIClientError(
                f"Error al invocar el modelo de OpenAI: {exc}"
            ) from exc

        choices = getattr(response, "choices", None) or []
        if not choices:
            raise OpenAIClientError("La respuesta de OpenAI no incluyó opciones")

        message = getattr(choices[0], "message", None)
        if message is None:
            raise OpenAIClientError(
                "La respuesta de OpenAI no incluyó contenido de mensaje"
            )

        content = getattr(message, "content", "")
        if isinstance(content, str):
            text = content
        else:
            text_parts: list[str] = []
            for item in content or []:
                if isinstance(item, dict):
                    value = item.get("text")
                    if value:
                        text_parts.append(value)
            text = "".join(text_parts)

        if not text:
            raise OpenAIClientError(
                "La respuesta de OpenAI no incluyó texto utilizable"
            )

        return text.strip()

    def _configure_openai(self, model: str | None) -> None:
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ImproperlyConfigured("OPENAI_API_KEY debe estar configurada")

        self._primary_model = model or settings.OPENAI_DEFAULT_MODEL
        if not self._primary_model:
            raise ImproperlyConfigured("OPENAI_DEFAULT_MODEL debe estar configurado")

        self._fallback_model = getattr(settings, "OPENAI_FALLBACK_MODEL", None)
        if self._fallback_model == "":
            self._fallback_model = None

        self._client = OpenAI(
            api_key=api_key,
            base_url=settings.OPENAI_API_BASE_URL,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
        )

    def _configure_perplexity(self, model: str | None) -> None:
        api_key = getattr(settings, "PERPLEXITY_API_KEY", None)
        if not api_key:
            raise ImproperlyConfigured("PERPLEXITY_API_KEY debe estar configurada")

        default_model = getattr(settings, "PERPLEXITY_DEFAULT_MODEL", None)
        self._perplexity_model = model or default_model
        if not self._perplexity_model:
            raise ImproperlyConfigured("PERPLEXITY_DEFAULT_MODEL debe estar configurado")

        self._perplexity_base_url = getattr(
            settings,
            "PERPLEXITY_API_BASE_URL",
            "https://api.perplexity.ai/chat/completions",
        )
        self._perplexity_timeout = getattr(settings, "PERPLEXITY_TIMEOUT_SECONDS", 45)
        self._perplexity_headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "materialidad-ai-client/1.0",
        }
        self._perplexity_session = requests.Session()
        raw_continuations = getattr(settings, "PERPLEXITY_MAX_CONTINUATIONS", 2)
        try:
            self._perplexity_max_continuations = max(0, int(raw_continuations))
        except (TypeError, ValueError):
            self._perplexity_max_continuations = 2

    def _generate_perplexity_with_continuations(
        self,
        payload: list[dict[str, str]],
        *,
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        attempts = 0
        combined_parts: list[str] = []
        messages = [dict(item) for item in payload]

        while True:
            text, finish_reason = self._generate_via_perplexity(
                messages,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )
            combined_parts.append(text)
            if finish_reason != "length" or attempts >= self._perplexity_max_continuations:
                break
            attempts += 1
            messages = messages + [
                {"role": "assistant", "content": text},
                {
                    "role": "user",
                    "content": "Continúa exactamente donde terminaste, sin repetir contenido ya entregado.",
                },
            ]

        return "\n\n".join(part.strip() for part in combined_parts if part.strip()) or "".join(combined_parts)

    def _generate_via_perplexity(
        self,
        payload: list[dict[str, str]],
        *,
        temperature: float,
        max_output_tokens: int,
    ) -> tuple[str, str]:
        body = {
            "model": self._perplexity_model,
            "messages": payload,
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }
        try:
            response = self._perplexity_session.post(
                self._perplexity_base_url,
                json=body,
                headers=self._perplexity_headers,
                timeout=self._perplexity_timeout,
            )
        except requests.Timeout as exc:
            raise OpenAIClientError(
                "Perplexity tardó demasiado en responder; intenta nuevamente"
            ) from exc
        except requests.RequestException as exc:
            raise OpenAIClientError(f"Error de red al invocar Perplexity: {exc}") from exc

        if response.status_code == 404:
            raise OpenAIModelNotFoundError(
                f"Modelo {self._perplexity_model} no disponible: {response.text}"
            )

        if response.status_code >= 400:
            raise OpenAIClientError(
                f"Perplexity devolvió un error {response.status_code}: {response.text}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise OpenAIClientError("Perplexity no devolvió JSON válido") from exc

        choices = data.get("choices") or []
        if not choices:
            raise OpenAIClientError("La respuesta de Perplexity no incluyó opciones")

        choice = choices[0]
        message = choice.get("message") or {}
        content = message.get("content")
        text = ""
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            fragments: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    value = item.get("text")
                    if value:
                        fragments.append(value)
            text = "".join(fragments)
        elif isinstance(content, dict):
            text = content.get("text") or ""

        if not text:
            raise OpenAIClientError("Perplexity no devolvió texto utilizable")

        finish_reason = choice.get("finish_reason") or data.get("finish_reason") or ""
        return text.strip(), finish_reason
