"""ScriptSage AI FastAPI backend."""

import io
import logging
import os

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from starlette.concurrency import run_in_threadpool

from backend.local_translation import translate_hindi_to_english

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scriptsage")

app = FastAPI(title="ScriptSage AI", version="0.7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://script-sage-ai.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ocr_model = None


class TranslationRequest(BaseModel):
    text: str


@app.get("/")
def root():
    return {"message": "ScriptSage AI backend is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


def get_ocr_model():
    global _ocr_model

    if _ocr_model is None:
        from paddleocr import PaddleOCR

        logger.info("Loading PaddleOCR Hindi model")

        _ocr_model = PaddleOCR(
            use_angle_cls=False,
            lang="hi",
            show_log=False,
            use_gpu=False,
        )

    return _ocr_model


def extract_text(image_bytes, enhance=True):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Keep images small to reduce memory usage.
    image.thumbnail((1200, 1200))

    image_array = np.array(image)

    model = get_ocr_model()

    # PaddleOCR 2.x uses .ocr(), not .predict().
    results = model.ocr(image_array, cls=False)

    lines = []

    for page in results or []:
        if not page:
            continue

        for item in page:
            if not item or len(item) < 2:
                continue

            text_info = item[1]

            if isinstance(text_info, (list, tuple)) and text_info:
                text = str(text_info[0]).strip()

                if text:
                    lines.append(text)

    return "\n".join(lines)


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    enhance: bool = True,
):
    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Empty image",
            )

        text = await run_in_threadpool(
            extract_text,
            image_bytes,
            enhance,
        )

        return {
            "text": text,
            "extracted_text": text,
            "filename": file.filename,
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("OCR processing failed")
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@app.post("/translate")
async def translate(request: TranslationRequest):
    try:
        translated = await run_in_threadpool(
            translate_hindi_to_english,
            request.text,
        )

        return {
            "translated_text": translated,
            "translation": translated,
        }

    except Exception as exc:
        logger.exception("Translation failed")
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
