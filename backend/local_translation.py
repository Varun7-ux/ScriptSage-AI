
"""Offline Hindi-to-English translation with known-name preservation."""

import re
from functools import lru_cache
from threading import Lock

import torch
from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-hi-en"
_model_lock = Lock()

PROTECTED_NAMES = {
    "कृष्ण": "Krishna",
    "अर्जुन": "Arjun",
    "वरुण": "Varun",
    "सीता": "Sita",
    "राम": "Ram",
}

NAME_INTRO_PATTERN = re.compile(
    r"मेरा\s+नाम\s+(वरुण|राम|सीता|अर्जुन|कृष्ण)\s+है"
)

# Split at Hindi or English sentence-ending punctuation.
SENTENCE_PATTERN = re.compile(r"(?<=[।!?])\s+|(?<=[.!?])\s+")


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
    """Translate a line sentence by sentence and preserve known names."""
    sentences = SENTENCE_PATTERN.split(line.strip())
    translated_sentences = []

    name_pattern = re.compile(
        "|".join(
            re.escape(name)
            for name in sorted(PROTECTED_NAMES, key=len, reverse=True)
        )
    )

    for sentence in sentences:
        if not sentence.strip():
            continue

        # Handle known name-introduction sentences deterministically.
        intro_match = NAME_INTRO_PATTERN.search(sentence)
        if intro_match:
            english_name = PROTECTED_NAMES[intro_match.group(1)]
            translated_sentences.append(f"My name is {english_name}.")
            continue

        # Translate text around protected names separately.
        pieces = name_pattern.split(sentence)
        names = name_pattern.findall(sentence)
        output_parts = []

        for index, piece in enumerate(pieces):
            if piece.strip():
                translated_piece = _translate_sentence(
                    piece, tokenizer, model
                )
                if translated_piece:
                    output_parts.append(translated_piece)

            if index < len(names):
                output_parts.append(PROTECTED_NAMES[names[index]])

        result = " ".join(output_parts)
        result = re.sub(r"\s+([.,!?;:।])", r"\1", result)
        result = re.sub(r"\s+", " ", result).strip()

        if result:
            translated_sentences.append(result)

    return " ".join(translated_sentences)


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
