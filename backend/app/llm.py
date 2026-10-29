"""Gemini LLM integration.

This file is deliberately kept separate from FastAPI so that the application
can later swap Gemini for another model provider without rewriting the API.
"""

from collections.abc import Iterator

from google import genai
from google.genai import types

from .config import GEMINI_API_KEY, GEMINI_MODEL, SYSTEM_PROMPT

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Copy .env.example to .env and add your Gemini API key."
    )

client = genai.Client(api_key=GEMINI_API_KEY)


def stream_response(messages: list[dict[str, str]]) -> Iterator[dict]:
    """Stream Gemini output and return token usage when available."""

    contents = []

    for message in messages:
        # Gemini conversation roles are "user" and "model".
        role = "model" if message["role"] == "assistant" else "user"

        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=message["content"])],
            )
        )

    response_stream = client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
        ),
    )

    final_usage = None

    for chunk in response_stream:
        if chunk.text:
            yield {
                "type": "delta",
                "text": chunk.text,
            }

        # Usage metadata may be present on the final response chunk.
        usage = getattr(chunk, "usage_metadata", None)
        if usage is not None:
            final_usage = {
                "input_tokens": getattr(usage, "prompt_token_count", None),
                "output_tokens": getattr(usage, "candidates_token_count", None),
                "total_tokens": getattr(usage, "total_token_count", None),
            }

    yield {
        "type": "done",
        "usage": final_usage,
    }