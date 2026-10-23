"""ScriptSage AI Hindi-to-English translation."""

import os
import requests

API_URL = "https://router.huggingface.co/v1/chat/completions"


def translate_hindi_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""

    token = os.getenv("HF_TOKEN", "").strip()

    if not token:
        raise RuntimeError("HF_TOKEN is missing from Render environment")

    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "model": "Qwen/Qwen3-4B-Instruct-2507:fastest",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Translate the Hindi text into natural English. "
                        "Preserve names and meaning. "
                        "Return only the translation."
                    ),
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            "temperature": 0,
            "max_tokens": 1200,
        },
        timeout=45,
    )

    if not response.ok:
        raise RuntimeError(
            f"Hugging Face API error {response.status_code}: "
            f"{response.text[:300]}"
        )

    data = response.json()
    return data["choices"][0]["message"]["content"].strip()
