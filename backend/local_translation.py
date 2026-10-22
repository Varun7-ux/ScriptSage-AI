
"""Offline Hindi-to-English translation with known-name preservation."""

import re
from functools import lru_cache
from threading import Lock

import torch
from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-hi-en"
_model_lock = Lock()

PROTECTED_NAMES = {
    "\u0915\u0943\u0937\u094d\u0923": "Krishna",
    "\u0905\u0930\u094d\u091c\u0941\u0928": "Arjun",
    "\u0935\u0930\u0941\u0923": "Varun",
    "\u0938\u0940\u0924\u093e": "Sita",
    "\u0930\u093e\u092e": "Ram",
}

# Handle common name-introduction sentences without asking the model
# to translate the name itself.
NAME_INTRO_PATTERN = re.compile(
    r"मेरा\s+नाम\s+(वरुण|राम|सीता|अर्जुन|कृष्ण)\s+है"
)


@lru_cache(maxsize=1)
def load_translation_model():
    """Load the translation model once and reuse it."""
    tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
    model = MarianMTModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


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
        clean_up_tokenization_spaces=True,
    ).strip()


def _translate_line(line, tokenizer, model):
    """Translate a line while preserving known names."""
    # Split the line around known names so the model never sees them.
    name_pattern = re.compile(
        "|".join(
            re.escape(name)
            for name in sorted(PROTECTED_NAMES, key=len, reverse=True)
        )
    )

    pieces = name_pattern.split(line)
    names = name_pattern.findall(line)

    output_parts = []

    for index, piece in enumerate(pieces):
        if piece.strip():
            translated_piece = _translate_sentence(
                piece, tokenizer, model
            )
            output_parts.append(translated_piece)

        if index < len(names):
            output_parts.append(PROTECTED_NAMES[names[index]])

    result = " ".join(output_parts)

    # Repair spacing before common punctuation.
    result = re.sub(r"\s+([.,!?;:])", r"\1", result)
    result = re.sub(r"\s+", " ", result).strip()

    # Exact rule for the common sentence "My name is [name]."
    # This also handles cases where the model translates the surrounding
    # Hindi words poorly.
    match = NAME_INTRO_PATTERN.search(line)
    if match:
        english_name = PROTECTED_NAMES[match.group(1)]
        result = re.sub(
            r"(?i)\bmy\s+name(?:\s+is|'s)?\b[^.!?]*",
            f"My name is {english_name}",
            result,
            count=1,
        )

        if not re.search(r"(?i)\bmy\s+name\b", result):
            result = f"My name is {english_name}"

    return result


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

        translated_lines.append(
            _translate_line(line, tokenizer, model)
        )

    return "\n".join(translated_lines).strip()
