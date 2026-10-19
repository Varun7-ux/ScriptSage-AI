
from pathlib import Path
from PIL import Image

samples = Path(__file__).parent / "samples"

input_path = samples / "test.jpeg"
output_path = samples / "cropped.png"

image = Image.open(input_path).convert("RGB")

width, height = image.size
print("Original image size:", width, height)

# Crop the central region of the screenshot
left = int(width * 0.08)
top = int(height * 0.19)
right = int(width * 0.92)
bottom = int(height * 0.82)

cropped = image.crop((left, top, right, bottom))
cropped.save(output_path)

print("Cropped image saved:", output_path)
