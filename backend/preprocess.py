
from pathlib import Path

import cv2


def preprocess_image(input_path: str, output_path: str) -> None:
    image = cv2.imread(input_path)

    if image is None:
        raise ValueError(f"Could not open image: {input_path}")

    # Convert the image to grayscale.
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Improve local contrast.
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )
    enhanced = clahe.apply(gray)

    # Reduce small amounts of image noise.
    denoised = cv2.fastNlMeansDenoising(
        enhanced,
        None,
        h=7,
        templateWindowSize=7,
        searchWindowSize=21
    )

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    if not cv2.imwrite(str(output), denoised):
        raise RuntimeError("Failed to save processed image.")

    print(f"Preprocessed image saved to: {output}")


if __name__ == "__main__":
    input_image = "samples/cropped.png"
    output_image = "samples/preprocessed.png"

    preprocess_image(input_image, output_image)
