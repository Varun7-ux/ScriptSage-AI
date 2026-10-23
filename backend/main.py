
from io import BytesIO
from threading import Lock
import logging

import torch  # Load PyTorch DLLs before PaddleOCR on Windows
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from paddleocr import PaddleOCR
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.local_translation import translate_hindi_to_english
from backend.preprocess import preprocess_array


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scriptsage")

app = FastAPI(
    title="ScriptSage AI API",
    description="Backend API for the ScriptSage AI manuscript project.",
    version="0.6.2",
)

# Allow the local frontend and the production Vercel frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://script-sage-ai.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

ocr_model = None
ocr_lock = Lock()


def get_ocr_model():
    global ocr_model

    if ocr_model is None:
        ocr_model = PaddleOCR(
            lang="hi",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

    return ocr_model


def arrange_text_in_reading_order(results):
    """Arrange detected text from top to bottom, left to right."""
    text_regions = []

    for result in results:
        data = result.json

        if callable(data):
            data = data()

        page = data.get("res", data)

        texts = page.get("rec_texts", [])
        polygons = page.get("rec_polys", [])
        boxes = page.get("rec_boxes", [])

        for index, text in enumerate(texts):
            text = str(text).strip()

            if not text:
                continue

            x_min = None
            y_min = None
            y_max = None

            if index < len(polygons):
                polygon = np.asarray(polygons[index])

                if polygon.ndim == 2 and polygon.shape[1] >= 2:
                    x_min = float(np.min(polygon[:, 0]))
                    y_min = float(np.min(polygon[:, 1]))
                    y_max = float(np.max(polygon[:, 1]))

            if x_min is None and index < len(boxes):
                box = np.asarray(boxes[index])

                if box.ndim == 1 and box.size >= 4:
                    x_min = float(box[0])
                    y_min = float(box[1])
                    y_max = float(box[3])

            if x_min is None:
                continue

            text_regions.append(
                {
                    "text": text,
                    "x": x_min,
                    "center_y": (y_min + y_max) / 2,
                    "height": max(y_max - y_min, 1),
                }
            )

    if not text_regions:
        return "", 0

    text_regions.sort(
        key=lambda region: (region["center_y"], region["x"])
    )

    grouped_lines = []

    for region in text_regions:
        best_line = None
        best_distance = float("inf")

        for line in grouped_lines:
            distance = abs(region["center_y"] - line["center_y"])
            tolerance = min(region["height"], line["height"]) * 0.5

            if distance <= tolerance and distance < best_distance:
                best_line = line
                best_distance = distance

        if best_line is None:
            grouped_lines.append(
                {
                    "regions": [region],
                    "center_y": region["center_y"],
                    "height": region["height"],
                }
            )
        else:
            best_line["regions"].append(region)

            centers = [
                item["center_y"] for item in best_line["regions"]
            ]
            heights = [
                item["height"] for item in best_line["regions"]
            ]

            best_line["center_y"] = sum(centers) / len(centers)
            best_line["height"] = sum(heights) / len(heights)

    grouped_lines.sort(key=lambda line: line["center_y"])

    final_lines = []

    for line in grouped_lines:
        line["regions"].sort(key=lambda region: region["x"])

        final_lines.append(
            " ".join(region["text"] for region in line["regions"])
        )

    return "\n".join(final_lines), len(final_lines)


@app.get("/")
def root():
    return {
        "message": "ScriptSage AI backend is running!",
        "status": "success",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_manuscript(
    file: UploadFile = File(...),
    enhance: bool = False,
):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WebP image.",
        )

    try:
        contents = await file.read()
    finally:
        await file.close()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The file is empty.",
        )

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be smaller than 10 MB.",
        )

    try:
        with Image.open(BytesIO(contents)) as image:
            image.verify()

        with Image.open(BytesIO(contents)) as image:
            width, height = image.size
            image_array = np.array(image.convert("RGB"))

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        ) from exc

    try:
        ocr_image = (
            preprocess_array(image_array) if enhance else image_array
        )

        with ocr_lock:
            model = get_ocr_model()
            results = model.predict(ocr_image)

        extracted_text, lines_detected = (
            arrange_text_in_reading_order(results)
        )

    except Exception as exc:
        logger.exception("OCR processing failed")
        raise HTTPException(
            status_code=500,
            detail="OCR processing failed. Check the backend logs.",
        ) from exc

    return {
        "message": "Manuscript processed successfully.",
        "filename": file.filename,
        "width": width,
        "height": height,
        "size_bytes": len(contents),
        "ocr_status": "completed",
        "extracted_text": extracted_text,
        "lines_detected": lines_detected,
        "enhancement_applied": enhance,
    }


class TranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


@app.post("/translate")
async def translate_text(request: TranslationRequest):
    logger.info("Received translation request")

    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Enter text to translate.",
        )

    try:
        translated = await run_in_threadpool(
            translate_hindi_to_english,
            text,
        )

        if not isinstance(translated, str) or not translated.strip():
            logger.error("Translation returned empty or invalid text")
            raise HTTPException(
                status_code=500,
                detail="Translation returned no text. Check backend logs.",
            )

        logger.info("Translation completed successfully")

        return {
            "translated_text": translated.strip(),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception(
            "Translation failed (%s)",
            type(exc).__name__,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Translation failed. Check Render logs for the "
                "underlying error."
            ),
        ) from exc
