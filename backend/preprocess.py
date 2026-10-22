
"""Image preprocessing optimized for Hindi Devanagari OCR."""

from pathlib import Path

import cv2
import numpy as np


def preprocess_array(image: np.ndarray) -> np.ndarray:
    """
    Enhance an RGB image for OCR while preserving Devanagari details.

    Accepts an RGB NumPy array and returns an enhanced RGB array.
    """

    if image is None or image.size == 0:
        raise ValueError("Input image is empty.")

    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("Expected an RGB image with 3 channels.")

    # Enlarge the image so small vowel marks and character details
    # are easier for the OCR model to detect.
    height, width = image.shape[:2]
    scale = 1.5

    enlarged = cv2.resize(
        image,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_CUBIC,
    )

    # Convert the enlarged RGB image to grayscale.
    gray = cv2.cvtColor(enlarged, cv2.COLOR_RGB2GRAY)

    # Improve local contrast without aggressively thresholding text.
    clahe = cv2.createCLAHE(
        clipLimit=1.8,
        tileGridSize=(8, 8),
    )
    enhanced = clahe.apply(gray)

    # Reduce image noise while retaining character edges.
    denoised = cv2.fastNlMeansDenoising(
        enhanced,
        None,
        h=5,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    # Apply mild sharpening to make character strokes clearer.
    blurred = cv2.GaussianBlur(
        denoised,
        (0, 0),
        sigmaX=1.0,
    )

    sharpened = cv2.addWeighted(
        denoised,
        1.35,
        blurred,
        -0.35,
        0,
    )

    # Keep grayscale intensity information for PaddleOCR.
    sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

    # PaddleOCR receives a three-channel RGB image.
    return cv2.cvtColor(
        sharpened,
        cv2.COLOR_GRAY2RGB,
    )


def preprocess_image(input_path: str, output_path: str) -> None:
    """Read an image, preprocess it, and save the result."""

    image = cv2.imread(input_path)

    if image is None:
        raise ValueError(f"Could not open image: {input_path}")

    # OpenCV reads images in BGR format.
    rgb_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    processed_rgb = preprocess_array(rgb_image)

    # Convert RGB back to BGR before saving.
    processed_bgr = cv2.cvtColor(
        processed_rgb,
        cv2.COLOR_RGB2BGR,
    )

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    if not cv2.imwrite(str(output), processed_bgr):
        raise RuntimeError("Failed to save processed image.")

    print(f"Preprocessed image saved to: {output}")
    print(f"Original dimensions: {width_height(image)}")
    print(f"Processed dimensions: {width_height(processed_bgr)}")


def width_height(image: np.ndarray) -> str:
    """Return image dimensions in width x height format."""
    height, width = image.shape[:2]
    return f"{width} x {height}"


if __name__ == "__main__":
    input_image = "samples/cropped.png"
    output_image = "samples/preprocessed.png"

    preprocess_image(input_image, output_image)
