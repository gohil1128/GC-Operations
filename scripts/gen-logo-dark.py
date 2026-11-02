"""
Generates public/logo-dark.png, the logo for dark themes.

The mark is two colours: a roast brown (the CHAi wordmark, most of the pixels)
and a rust (the "God's" script). The brown falls to about 1.3:1 on the dark
canvas and the wordmark disappears, which is why dark mode used to sit the logo
on a cream plate. This recolours the same artwork instead, so it can sit
straight on the page: the brown becomes the dashboard's cream, and the rust
steps up a little so it holds 4.5:1 on the dark olive.

Antialiasing is preserved: only RGB changes, alpha (the shape) is untouched, and
edge pixels blend between the two new colours the way they blended between the
old ones.

Run with:  python3 scripts/gen-logo-dark.py
(needs Pillow; the output is committed, so nobody has to run it to build)
"""
from PIL import Image

CREAM = (244, 242, 232)   # --dock-ink / foreground on the dark theme
RUST = (226, 128, 82)     # the logo rust, lifted for dark grounds

src = Image.open("public/logo.png").convert("RGBA")
out = Image.new("RGBA", src.size)
sp, op = src.load(), out.load()
for y in range(src.height):
    for x in range(src.width):
        r, g, b, a = sp[x, y]
        if a == 0:
            op[x, y] = (0, 0, 0, 0)
            continue
        # How rust-like the pixel is: the brown has little red over blue, the rust a lot.
        t = max(0.0, min(1.0, ((r - b) - 40) / 70))
        op[x, y] = tuple(round(CREAM[i] + (RUST[i] - CREAM[i]) * t) for i in range(3)) + (a,)
out.save("public/logo-dark.png", optimize=True)
print("wrote public/logo-dark.png", out.size)
