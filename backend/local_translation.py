
"""Offline Hindi-to-English translation with known-name preservation."""

import re
from functools import lru_cache
from threading import Lock

import torch
from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-hi-en"
_model_lock = Lock()

# Keep Hindi names here as Unicode escape sequences to avoid encoding issues.
PROTECTED_NAMES = {
    "\u0935\u0930\u0941\u0923": "Varun",
    "\u0930\u093e\u092e": "Ram",
    "\u0938\u0940\u0924\u093e": "Sita",
    "\u0905\u0930\u094d\u091c\u0941\u0928": "Arjun",
    "\u0915\u0943\u0937\u094d\u0923": "Krishna",
}


@lru_cache(maxsize=1)
def load_translation_model():
    tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
    model = MarianMTModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


def _translate_sentence(text, tokenizer, model):
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
    """Translate complete lines while preserving known names."""
    if not text or not text.strip():
        return ""

    tokenizer, model = load_translation_model()

    translated_lines = []

    for line in text.split("\n"):
        if not line.strip():
            translated_lines.append("")
            continue

        # Use placeholders only for names actually present in this line.
        replacements = {}
        protected_line = line

        for index, (hindi_name, english_name) in enumerate(
            sorted(
                PROTECTED_NAMES.items(),
                key=lambda item: len(item[0]),
                reverse=True,
            )
        ):
            if hindi_name in protected_line:
                placeholder = f"ZXQNAME{index}QXZ"
                protected_line = protected_line.replace(
                    hindi_name, placeholder
                )
                replacements[placeholder] = english_name

        # Translate the whole line so sentence grammar stays together.
        translated = _translate_sentence(
            protected_line, tokenizer, model
        )

        # Restore known names even if placeholder capitalization changes.
        for placeholder, english_name in replacements.items():
            translated = re.sub(
                re.escape(placeholder),
                lambda _, name=english_name: name,
                translated,
                flags=re.IGNORECASE,
            )

        translated_lines.append(translated)

    return "\n".join(translated_lines).strip()
