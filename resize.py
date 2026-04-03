"""
Resize .webp images for mobile: max 550x550px, preserving aspect ratio.
Usage: python resize_webp.py <input_folder> [output_folder]

- If output_folder is omitted, resized images are saved to <input_folder>/mobile/
- Original files are never overwritten.
"""

import sys
from pathlib import Path
from PIL import Image

MAX_SIZE = (550, 550)


def resize_images(input_folder: str, output_folder: str = None):
    input_path = Path(input_folder)
    if not input_path.is_dir():
        print(f"Error: '{input_folder}' is not a valid directory.")
        sys.exit(1)

    output_path = Path(output_folder) if output_folder else input_path / "mobile"
    output_path.mkdir(parents=True, exist_ok=True)

    webp_files = list(input_path.glob("*.webp"))
    if not webp_files:
        print(f"No .webp files found in '{input_folder}'.")
        sys.exit(0)

    print(f"Found {len(webp_files)} .webp file(s). Resizing to max {MAX_SIZE[0]}x{MAX_SIZE[1]}px...")
    print(f"Output folder: {output_path}\n")

    for img_path in sorted(webp_files):
        with Image.open(img_path) as img:
            original_size = img.size
            img.thumbnail(MAX_SIZE, Image.LANCZOS)
            new_size = img.size
            out_file = output_path / img_path.name
            img.save(out_file, "WEBP", quality=95)
            print(f"  {img_path.name}: {original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]}")

    print(f"\nDone! {len(webp_files)} image(s) saved to '{output_path}'.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python resize_webp.py <input_folder> [output_folder]")
        sys.exit(1)

    input_folder = sys.argv[1]
    output_folder = sys.argv[2] if len(sys.argv) > 2 else None
    resize_images(input_folder, output_folder)