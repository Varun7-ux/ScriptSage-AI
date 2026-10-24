"""Hindi-to-English translation using Cloudflare Workers AI."""

import os
import requests

MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast"


def translate_hindi_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""

    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()

    if not account_id:
        raise RuntimeError("CLOUDFLARE_ACCOUNT_ID is missing")

    if not token:
        raise RuntimeError("CLOUDFLARE_API_TOKEN is missing")

    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/ai/run/{MODEL}"
    )

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert Hindi-to-English translator. "
                        "Translate the provided Hindi text into natural English. "
                        "Preserve the original meaning, names, and line breaks. "
                        "Return ONLY the English translation. "
                        "Do not add explanations or introductory text."
                    ),
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            "max_tokens": 1024,
            "temperature": 0
        },
        timeout=45
    )

    if not response.ok:
        raise RuntimeError(
            f"Cloudflare API error {response.status_code}: "
            f"{response.text[:300]}"
        )

    data = response.json()

    if not data.get("success", False):
        raise RuntimeError(
            f"Cloudflare AI request failed: {data.get('errors')}"
        )

    translation = data.get("result", {}).get("response", "")

    if not translation:
        raise RuntimeError("Cloudflare returned an empty translation")

    return translation.strip()
