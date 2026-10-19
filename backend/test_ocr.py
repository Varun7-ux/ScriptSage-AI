
from pathlib import Path
from paddleocr import PaddleOCR

# Find the image inside backend/samples
image_path = Path(__file__).parent / "samples" / "cropped.png"

if not image_path.exists():
    print("Image not found! Check the filename and extension.")
    raise SystemExit(1)

print("Loading Devanagari OCR model...")

ocr = PaddleOCR(
    lang="hi",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)

print("Reading image...")

results = ocr.predict(str(image_path))

print("\n===== RECOGNIZED TEXT =====")

for result in results:
    data = result.json
    texts = data.get("res", {}).get("rec_texts", [])

    if texts:
        for text in texts:
            print(text)
    else:
        print("No text detected.")

print("===========================")
