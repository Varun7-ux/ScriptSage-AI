
from io import BytesIO
from threading import Lock

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from paddleocr import PaddleOCR

app = FastAPI(
    title="ScriptSage AI API",
    description="Backend API for the ScriptSage AI manuscript project.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the model only once, on the first OCR request.
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
async def upload_manuscript(file: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

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
            image = image.convert("RGB")
            # Convert to an array accepted by PaddleOCR.
            import numpy as np
            image_array = np.array(image)

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )

    try:
        # Prevent simultaneous requests from using the same
        # OCR model at the same time.
        with ocr_lock:
            model = get_ocr_model()
            results = model.predict(image_array)

        recognized_lines = []

        for result in results:
            data = result.json
            lines = data.get("res", {}).get("rec_texts", [])
            recognized_lines.extend(lines)

        extracted_text = "\n".join(recognized_lines)

    except Exception as exc:
        print(f"OCR processing error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="OCR processing failed. Check the backend terminal.",
        ) from exc

    return {
        "message": "Manuscript processed successfully.",
        "filename": file.filename,
        "width": width,
        "height": height,
        "size_bytes": len(contents),
        "ocr_status": "completed",
        "extracted_text": extracted_text,
        "lines_detected": len(recognized_lines),
    }
