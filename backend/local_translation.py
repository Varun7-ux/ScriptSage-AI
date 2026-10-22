"""Offline Hindi-to-English translation using Helsinki-NLP OPUS-MT."""

import re
from functools import lru_cache
from threading import Lock

import torch
from transformers import MarianMTModel, MarianTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-hi-en"
_model_lock = Lock()


@lru_cache(maxsize=1)
def load_translation_model():
    tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
    model = MarianMTModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


def _token_chunks(text, tokenizer, max_tokens=300):
    """Split at Hindi/English sentence boundaries, then tokens if necessary."""
    sentences = re.split(r"(?<=[\u0964.!?])\s+", text.strip())
    chunks = []
    current = ""
    for sentence in sentences:
        candidate = (current + " " + sentence).strip()
        if len(tokenizer.encode(candidate, add_special_tokens=False)) <= max_tokens:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = ""
        tokens = tokenizer.encode(sentence, add_special_tokens=False)
        if len(tokens) <= max_tokens:
            current = sentence
        else:
            for start in range(0, len(tokens), max_tokens):
                chunks.append(tokenizer.decode(tokens[start:start + max_tokens], skip_special_tokens=True))
    if current:
        chunks.append(current)
    return chunks


def translate_hindi_to_english(text: str) -> str:
    tokenizer, model = load_translation_model()
    # Retain empty lines and manuscript line breaks.
    lines = text.split("\n")
    translated_lines = []
    for line in lines:
        if not line.strip():
            translated_lines.append("")
            continue
        translated_chunks = []
        for chunk in _token_chunks(line, tokenizer):
            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=512)
            with _model_lock, torch.inference_mode():
                outputs = model.generate(**inputs, max_new_tokens=384, num_beams=4)
            translated_chunks.append(tokenizer.decode(outputs[0], skip_special_tokens=True).strip())
        translated_lines.append(" ".join(translated_chunks))
    return "\n".join(translated_lines).strip()
