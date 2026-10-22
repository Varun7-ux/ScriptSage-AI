
"""Offline Hindi-to-English translation with basic name preservation."""

import re
from functools import lru_cache
from threading import Lock

import torch
from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-hi-en"

_model_lock = Lock()

# Common Hindi names and their preferred English spellings.
PROTECTED_NAMES = {
    "\u0915\u0943\u0937\u094d\u0923": "Krishna",
    "\u0905\u0930\u094d\u091c\u0941\u0928": "Arjun",
    "\u0935\u0930\u0941\u0923": "Varun",
    "\u0938\u0940\u0924\u093e": "Sita",
    "\u0930\u093e\u092e": "Ram",
}


@lru_cache(maxsize=1)
def load_translation_model():
    """Load the translation model once and reuse it."""
    tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
    model = MarianMTModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


def _replace_known_names(text: str) -> str:
    """Replace standalone Hindi names with their English spellings."""
    for hindi_name, english_name in sorted(
        PROTECTED_NAMES.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        # Avoid replacing a name when it is part of a longer word.
        pattern = rf"(?<!\w){re.escape(hindi_name)}(?!\w)"
        text = re.sub(pattern, english_name, text)

    return text


def _translate_sentence(text, tokenizer, model):
    """Translate one text segment."""
    if not text.strip():
        return text

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
    )

    with _model_lock, torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=384,
            num_beams=4,
        )

    return tokenizer.decode(
        outputs[0],
        skip_special_tokens=True,
    ).strip()


def translate_hindi_to_english(text: str) -> str:
    """Translate Hindi text locally while preserving paragraph breaks."""
    if not text or not text.strip():
        return ""

    tokenizer, model = load_translation_model()
    translated_lines = []

    for line in text.splitlines():
        if not line.strip():
            translated_lines.append("")
            continue

        # Use real English names rather than artificial placeholders.
        prepared_line = _replace_known_names(line)

        translated = _translate_sentence(
            prepared_line,
            tokenizer,
            model,
        )

        translated_lines.append(translated)

    return "\n".join(translated_lines).strip()
