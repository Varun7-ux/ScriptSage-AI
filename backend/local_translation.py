"""Hindi-to-English translation using MyMemory API."""

import os
import requests

API_URL = "https://api.mymemory.translated.net/get"


def translate_hindi_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""

    translated_lines = []

    for line in text.splitlines():
        if not line.strip():
            translated_lines.append("")
            continue

        chunks = []
        current = ""

        for word in line.split():
            candidate = f"{current} {word}".strip()

            if len(candidate.encode("utf-8")) > 400:
                if not current:
                    raise ValueError("Text segment is too long")
                chunks.append(current)
                current = word
            else:
                current = candidate

        if current:
            chunks.append(current)

        translated_chunks = []

        for chunk in chunks:
            params = {
                "q": chunk,
                "langpair": "hi|en",
                "mt": "1",
            }

            email = os.getenv("MYMEMORY_EMAIL", "").strip()
            if email:
                params["de"] = email

            response = requests.get(
                API_URL,
                params=params,
                timeout=20,
            )
            response.raise_for_status()

            data = response.json()

            if str(data.get("responseStatus")) != "200":
                raise RuntimeError(
                    str(data.get("responseDetails", "Translation API error"))
                )

            translated = data.get(
                "responseData", {}
            ).get("translatedText", "")

            if not translated:
                raise RuntimeError("Empty translation response")

            translated_chunks.append(translated.strip())

        translated_lines.append(" ".join(translated_chunks))

    return "\n".join(translated_lines).strip()
