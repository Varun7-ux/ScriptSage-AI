"""Lightweight Hindi-to-English translation for ScriptSage AI."""

import logging
import re

import requests

logger = logging.getLogger("scriptsage.translation")

TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"

PROTECTED_NAMES = {
    "\u0935\u0930\u0941\u0923": "Varun",
    "\u0930\u093e\u092e": "Ram",
    "\u0938\u0940\u0924\u093e": "Sita",
    "\u0905\u0930\u094d\u091c\u0941\u0928": "Arjun",
    "\u0915\u0943\u0937\u094d\u0923": "Krishna",
}


def translate_chunk(text):
    params = {
        "client": "gtx",
        "sl": "hi",
        "tl": "en",
        "dt": "t",
        "q": text,
    }

    response = requests.get(
        TRANSLATE_URL,
        params=params,
        headers={
            "User-Agent": "Mozilla/5.0"
        },
        timeout=15,
    )

    response.raise_for_status()
    data = response.json()

    if not data or not data[0]:
        raise RuntimeError("Translation service returned no text")

    return "".join(
        item[0] for item in data[0]
        if item and item[0]
    ).strip()


def translate_hindi_to_english(text: str) -> str:
    if not text or not text.strip():
        return ""

    lines = []

    for line in text.splitlines():
        if not line.strip():
            lines.append("")
            continue

        try:
            translated = translate_chunk(line.strip())

            for hindi_name, english_name in PROTECTED_NAMES.items():
                if hindi_name in line:
                    translated = re.sub(
                        rf"\b{re.escape(english_name)}\b",
                        english_name,
                        translated,
                        flags=re.IGNORECASE,
                    )

            lines.append(translated)

        except Exception:
            logger.exception("Translation failed")
            raise RuntimeError(
                "Translation service unavailable"
            )

    return "\n".join(lines).strip()
