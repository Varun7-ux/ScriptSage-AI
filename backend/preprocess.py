
from pathlib import Path

import cv2
import numpy as np


def preprocess_array(image: np.ndarray) -> np.ndarray:
    """
    Enhance an RGB image for OCR.

    Accepts a NumPy RGB image array and returns
    an enhanced RGB image array.
    """

    # Convert RGB image to grayscale.
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    # Improve local contrast.
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8),
    )
    enhanced = clahe.apply(gray)

    # Reduce small amounts of image noise.
    denoised = cv2.fastNlMeansDenoising(
        enhanced,
        None,
        h=7,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    # Convert back to RGB for PaddleOCR.
    return cv2.cvtColor(
        denoised,
        cv2.COLOR_GRAY2RGB,
    )


def preprocess_image(input_path: str, output_path: str) -> None:
    """
    Read an image, preprocess it, and save the result.
    """

    image = cv2.imread(input_path)

    if image is None:
        raise ValueError(f"Could not open image: {input_path}")

    # OpenCV reads images in BGR format.
    rgb_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    processed_rgb = preprocess_array(rgb_image)

    # Convert RGB back to BGR for saving.
    processed_bgr = cv2.cvtColor(
        processed_rgb,
        cv2.COLOR_RGB2BGR,
    )

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    if not cv2.imwrite(str(output), processed_bgr):
        raise RuntimeError("Failed to save processed image.")

    print(f"Preprocessed image saved to: {output}")


if __name__ == "__main__":
    input_image = "samples/cropped.png"
    output_image = "samples/preprocessed.png"

    preprocess_image(input_image, output_image)
