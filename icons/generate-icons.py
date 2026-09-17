#!/usr/bin/env python3
"""
Generates the extension icons (16/48/128 px) as PNG files.
Zero dependencies: writes a minimal valid PNG using only the stdlib.

Usage: python3 icons/generate-icons.py
"""
import os
import struct
import zlib

GRID = 16

# 16x16 logical grid: white "$" glyph on a green rounded square.
GLYPH = [
    "................",
    ".......##.......",
    "......####......",
    ".....##..##.....",
    ".....##..#......",
    ".....####.......",
    "......###.......",
    ".....####.......",
    "....##..##......",
    "....##...#......",
    ".....##.##......",
    "......###.......",
    ".......#........",
    "................",
    "................",
    "................",
]

GREEN = (34, 139, 87, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def draw_icon():
    """Return the icon as a flat list of RGBA pixels on a 16x16 grid."""
    pixels = []
    for y in range(GRID):
        for x in range(GRID):
            dx = min(x, GRID - 1 - x)
            dy = min(y, GRID - 1 - y)
            in_rounded_square = dx + dy >= 3  # simple rounded-corner mask
            is_glyph = GLYPH[y][x] == "#"
            if is_glyph:
                pixels.append(WHITE)
            elif in_rounded_square:
                pixels.append(GREEN)
            else:
                pixels.append(CLEAR)
    return pixels


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    )


def encode_png(size: int) -> bytes:
    pixels = draw_icon()
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # width, height, depth 8, RGBA
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type: none
        sy = (y * GRID) // size
        for x in range(size):
            sx = (x * GRID) // size
            raw.extend(pixels[sy * GRID + sx])
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            png_chunk(b"IHDR", header),
            png_chunk(b"IDAT", zlib.compress(bytes(raw))),
            png_chunk(b"IEND", b""),
        ]
    )


def main():
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    for size in (16, 48, 128):
        path = os.path.join(icons_dir, f"icon{size}.png")
        with open(path, "wb") as handle:
            handle.write(encode_png(size))
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
