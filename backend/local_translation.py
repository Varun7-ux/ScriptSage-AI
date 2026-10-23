"""Hindi-to-English translation for ScriptSage AI."""

import logging
import requests

logger = logging.getLogger("scriptsage.translation")

TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"


def translate_chunk(text):
    response = requests.get(
        TRANSLATE_URL,
        params={
            "client": "gtx",
            "sl": "hi",
            "tl": "en",
            "dt": "t",
            "q": text,
        },
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    if not data or not data[0]:
        raise RuntimeError("Translation returned no text")

    return "".join(
        item[0]
        for item in data[0]
        if item and item[0]
    ).strip()


def translate_hindi_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""

    translated_lines = []

    for line in text.splitlines():
        if not line.strip():
            translated_lines.append("")
            continue

        # Group text into manageable requests.
        words = line.split()
        chunks = []
        current = ""

        for word in words:
            candidate = f"{current} {word}".strip()

            if len(candidate) > 1000 and current:
                chunks.append(current)
                current = word
            else:
                current = candidate

        if current:
            chunks.append(current)

        try:
            translated_lines.append(
                " ".join(translate_chunk(chunk) for chunk in chunks)
            )
        except Exception as exc:
            logger.exception("Translation request failed")
            raise RuntimeError(
                "Google translation endpoint unavailable"
            ) from exc

    return "\n".join(translated_lines).strip()
