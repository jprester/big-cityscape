#!/usr/bin/env python3
"""Derive a pixel-aligned roughness atlas from the residential base color.

Output follows the glTF/Principled convention: black is smooth and white is
rough. The heuristic favors rough masonry/concrete and smooth glazing, polished
metal, lit interiors, and beacon lenses.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "references" / "textures" / "residential-atlas-v1"
SOURCE = ATLAS_DIR / "residential-atlas-v1-basecolor-2048.png"
EMISSIVE = ATLAS_DIR / "residential-atlas-v1-emissive-2048.png"
OUTPUT = ATLAS_DIR / "residential-atlas-v1-roughness-2048.png"


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    normalized = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return normalized * normalized * (3.0 - 2.0 * normalized)


def blurred(channel: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(channel, 0.0, 1.0) * 255.0))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def main() -> None:
    source = np.asarray(Image.open(SOURCE).convert("RGB"), dtype=np.float32) / 255.0
    red, green, blue = source[..., 0], source[..., 1], source[..., 2]
    maximum = np.maximum.reduce((red, green, blue))
    minimum = np.minimum.reduce((red, green, blue))
    saturation = (maximum - minimum) / np.maximum(maximum, 1e-5)
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    local_mean = blurred(luminance, 4.0)
    local_detail = np.abs(luminance - local_mean)
    broad_mean = blurred(luminance, 15.0)
    broad_detail = np.abs(luminance - broad_mean)

    if EMISSIVE.exists():
        emissive_rgb = np.asarray(Image.open(EMISSIVE).convert("RGB"), dtype=np.float32) / 255.0
        emissive = smoothstep(0.025, 0.38, np.max(emissive_rgb, axis=2))
    else:
        emissive = np.zeros_like(luminance)

    dark = 1.0 - smoothstep(0.08, 0.42, luminance)
    locally_smooth = 1.0 - smoothstep(0.018, 0.095, local_detail)
    blue_glass_bias = smoothstep(-0.015, 0.075, blue - red)
    low_saturation_glass = 1.0 - smoothstep(0.22, 0.52, saturation)

    # Dark, locally smooth, neutral/navy regions are likely glazing. The bias
    # prevents rough dark brick from becoming as glossy as window panes.
    glass = dark * locally_smooth * np.maximum(
        0.45 * low_saturation_glass,
        blue_glass_bias,
    )

    # Highly saturated dark details are usually coated metal, rails, doors, or
    # beacon housings. They are smoother than masonry but rougher than glass.
    coated_metal = (
        dark
        * smoothstep(0.12, 0.5, saturation)
        * (1.0 - smoothstep(0.04, 0.16, broad_detail))
    )

    # Begin with a rough architectural surface, add restrained micro-variation,
    # then lower roughness for the smoother material classes.
    roughness = 0.76 + 0.22 * smoothstep(0.018, 0.11, local_detail)
    roughness -= 0.5 * glass
    roughness -= 0.18 * coated_metal
    roughness -= 0.28 * emissive

    # Pale precast and concrete remain distinctly rough even where their broad
    # tonal gradients are smooth.
    pale_mineral = smoothstep(0.42, 0.7, luminance) * (
        1.0 - smoothstep(0.12, 0.36, saturation)
    )
    mineral_floor = 0.68 + 0.14 * pale_mineral
    roughness = np.where(
        pale_mineral > 0.02,
        np.maximum(roughness, mineral_floor),
        roughness,
    )

    # Atlas gutters are intentionally maximally rough so mip bleeding cannot
    # introduce glossy seams around UV islands.
    gutter = luminance < 0.012
    roughness = np.where(gutter, 1.0, roughness)
    roughness = np.clip(roughness, 0.18, 0.96)

    output = Image.fromarray(np.uint8(roughness * 255.0)).convert("L")
    output.save(OUTPUT, optimize=True)

    values = np.asarray(output, dtype=np.uint8)
    print(
        f"Wrote {OUTPUT.relative_to(ROOT)} "
        f"(range {values.min()}–{values.max()}, mean {values.mean():.1f})."
    )


if __name__ == "__main__":
    main()
