#!/usr/bin/env python3
"""Derive a pixel-aligned emissive atlas from the approved residential base color.

The mask is intentionally conservative: it selects locally bright warm/cool
interior light and red beacon colors while leaving façade materials black.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "references" / "textures" / "residential-atlas-v1"
SOURCE = ATLAS_DIR / "residential-atlas-v1-basecolor-2048.png"
OUTPUT = ATLAS_DIR / "residential-atlas-v1-emissive-2048.png"


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    normalized = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return normalized * normalized * (3.0 - 2.0 * normalized)


def main() -> None:
    source_image = Image.open(SOURCE).convert("RGB")
    source = np.asarray(source_image, dtype=np.float32) / 255.0
    red, green, blue = source[..., 0], source[..., 1], source[..., 2]

    maximum = np.maximum.reduce((red, green, blue))
    minimum = np.minimum.reduce((red, green, blue))
    saturation = (maximum - minimum) / np.maximum(maximum, 1e-5)
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    blurred = np.asarray(
        Image.fromarray(np.uint8(np.clip(luminance, 0.0, 1.0) * 255.0)).filter(
            ImageFilter.GaussianBlur(12.0)
        ),
        dtype=np.float32,
    ) / 255.0
    local_contrast = np.maximum(luminance - blurred, 0.0)

    height, width = luminance.shape
    y = np.arange(height, dtype=np.float32)[:, None] / height

    # Large façade panels need local contrast to reject warm masonry. The
    # authored storefront and window-module rows can retain broader light areas.
    facade_region = y < 0.64
    storefront_region = (y >= 0.64) & (y < 0.72)
    module_region = y >= 0.79
    relaxed_region = storefront_region | module_region

    warm_hue = (
        smoothstep(0.015, 0.13, red - green)
        * smoothstep(0.02, 0.16, green - blue)
        * smoothstep(0.08, 0.34, saturation)
    )
    warm_brightness = smoothstep(0.24, 0.66, luminance)
    warm_local = smoothstep(0.018, 0.13, local_contrast)
    warm_strength = warm_hue * warm_brightness * np.where(
        relaxed_region, 1.0, warm_local
    )

    cool_hue = (
        smoothstep(0.015, 0.16, blue - red)
        * smoothstep(0.005, 0.12, blue - green)
        * smoothstep(0.04, 0.3, saturation)
    )
    cool_strength = cool_hue * smoothstep(0.28, 0.72, luminance) * np.where(
        relaxed_region, 1.0, smoothstep(0.02, 0.12, local_contrast)
    )

    # Neutral interior light is limited to high-contrast highlights to avoid
    # turning pale precast cladding into an emissive surface.
    neutral_color = 1.0 - smoothstep(0.08, 0.24, saturation)
    neutral_strength = (
        neutral_color
        * smoothstep(0.52, 0.78, luminance)
        * smoothstep(0.045, 0.18, local_contrast)
        * relaxed_region
    )

    red_hue = (
        smoothstep(0.12, 0.45, red - green)
        * smoothstep(0.1, 0.4, red - blue)
        * smoothstep(0.22, 0.65, saturation)
    )
    red_strength = red_hue * smoothstep(0.15, 0.62, luminance)

    # The unused material-swatch band must stay black even when a source
    # material contains a warm highlight.
    swatch_band = (y >= 0.72) & (y < 0.79)
    warm_strength = np.where(swatch_band, 0.0, warm_strength)
    cool_strength = np.where(swatch_band, 0.0, cool_strength)
    neutral_strength = np.where(swatch_band, 0.0, neutral_strength)
    red_strength = np.where(swatch_band, 0.0, red_strength)

    output = np.zeros_like(source)
    output += warm_strength[..., None] * np.array([1.0, 0.58, 0.24])
    output += neutral_strength[..., None] * np.array([1.0, 0.9, 0.72])
    output += cool_strength[..., None] * np.array([0.46, 0.78, 1.0])
    output += red_strength[..., None] * np.array([1.0, 0.055, 0.018])

    # A light blur keeps antialiased window edges and beacon halos smooth while
    # retaining the exact atlas coordinates.
    output_image = Image.fromarray(np.uint8(np.clip(output, 0.0, 1.0) * 255.0))
    output_image = output_image.filter(ImageFilter.GaussianBlur(0.65))
    output_image.save(OUTPUT, optimize=True)

    lit_pixels = int(np.count_nonzero(np.max(np.asarray(output_image), axis=2) > 8))
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({lit_pixels:,} lit pixels).")


if __name__ == "__main__":
    main()
