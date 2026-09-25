#!/usr/bin/env python3
"""Conventionally upscale the island board and report round-trip error.

The output is a deterministic 2x Lanczos resize with a restrained unsharp
mask. No image generation or content-aware reconstruction is performed.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat


DEFAULT_INPUT = Path("public/assets/board/ilha-v4.png")
DEFAULT_OUTPUT = Path("public/assets/board/ilha-v4-2x.webp")
SCALE = 2


def upscale(input_path: Path, output_path: Path) -> tuple[Image.Image, Image.Image]:
    """Create the upscaled image and return (source, encoded_output)."""
    with Image.open(input_path) as source_file:
        source = source_file.convert("RGB")

    expected_size = (source.width * SCALE, source.height * SCALE)
    upscaled = source.resize(expected_size, Image.Resampling.LANCZOS)
    # A small radius and percentage retain painted detail without halos.
    sharpened = upscaled.filter(ImageFilter.UnsharpMask(radius=1.0, percent=15, threshold=3))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sharpened.save(output_path, format="WEBP", quality=95, method=6)

    with Image.open(output_path) as encoded_file:
        encoded = encoded_file.convert("RGB")

    return source, encoded


def round_trip_metrics(source: Image.Image, encoded: Image.Image) -> tuple[float, float, int]:
    """Compare a Lanczos downsample of the encoded output against the source."""
    restored = encoded.resize(source.size, Image.Resampling.LANCZOS)
    difference = ImageChops.difference(source, restored)
    stats = ImageStat.Stat(difference)
    mae = sum(stats.mean) / len(stats.mean)
    rmse = sum(stats.rms) / len(stats.rms)
    extrema = difference.getextrema()
    max_error = max(channel_max for channel in extrema for channel_max in channel)
    return mae, rmse, max_error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    source, encoded = upscale(args.input, args.output)
    mae, rmse, max_error = round_trip_metrics(source, encoded)

    print(f"input={args.input} size={source.width}x{source.height}")
    print(f"output={args.output} size={encoded.width}x{encoded.height}")
    print(f"output_bytes={args.output.stat().st_size}")
    print(f"round_trip_mae={mae:.4f}/255")
    print(f"round_trip_rmse={rmse:.4f}/255")
    print(f"round_trip_max_error={max_error}/255")


if __name__ == "__main__":
    main()
