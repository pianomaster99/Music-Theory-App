"""Key out the baked-in checkerboard background from generated hand assets.

The image generator drew a light gray/white checkerboard to fake transparency,
so the PNGs are RGB with no alpha. We flood-fill from the borders over
light, low-saturation pixels and make them transparent, preserving interior
detail (e.g. the fingernail) that isn't connected to the border.
"""

import sys
from collections import deque
from PIL import Image


def is_background(r, g, b):
    mx = max(r, g, b)
    mn = min(r, g, b)
    val = mx / 255.0
    sat = 0.0 if mx == 0 else (mx - mn) / mx
    # Checkerboard is bright and nearly gray; skin is warmer/more saturated.
    return val > 0.70 and sat < 0.18


def cut(path_in, path_out):
    img = Image.open(path_in).convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = bytearray(w * h)
    q = deque()

    def consider(x, y):
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, _ = px[x, y]
        if is_background(r, g, b):
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        consider(x, 0)
        consider(x, h - 1)
    for y in range(h):
        consider(0, y)
        consider(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        if x > 0:
            consider(x - 1, y)
        if x < w - 1:
            consider(x + 1, y)
        if y > 0:
            consider(x, y - 1)
        if y < h - 1:
            consider(x, y + 1)

    img.save(path_out)
    cleared = sum(visited)
    print(f"{path_out}: cleared {cleared} / {w * h} px")


if __name__ == "__main__":
    for name in sys.argv[1:]:
        cut(name, name)
