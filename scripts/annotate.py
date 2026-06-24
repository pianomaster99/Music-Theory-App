"""Draw red dots on candidate knuckle points so we can verify alignment."""
from PIL import Image, ImageDraw

# --- Palm: 4 finger knuckles (measured from the top-edge profile) + thumb ---
palm = Image.open('public/hand/palm.png').convert('RGBA')
pw, ph = palm.size
d = ImageDraw.Draw(palm)

# (label, x, y) in palm-image pixels.
palm_points = [
    ('index',  225, 30),
    ('middle', 405, 16),
    ('ring',   510, 48),
    ('pinky',  600, 34),
    ('thumb',  650, 250),   # thumb on the RIGHT side of this hand
]
r = 16
for name, x, y in palm_points:
    d.ellipse([x - r, y - r, x + r, y + r], fill=(220, 30, 30, 255), outline=(255, 255, 255, 255), width=3)
    d.text((x + r + 4, y - 8), name, fill=(220, 30, 30, 255))
palm.save('public/hand/_palm_dots.png')
print('palm', pw, ph, '-> public/hand/_palm_dots.png')

# --- A single finger: its knuckle is the base (bottom-center) ---
fing = Image.open('public/hand/finger.png').convert('RGBA')
fw, fh = fing.size
d = ImageDraw.Draw(fing)
fx, fy = fw // 2, fh - 24
d.ellipse([fx - r, fy - r, fx + r, fy + r], fill=(220, 30, 30, 255), outline=(255, 255, 255, 255), width=3)
fing.save('public/hand/_finger_dots.png')
print('finger', fw, fh, 'knuckle@', fx, fy, '-> public/hand/_finger_dots.png')

# --- Thumb: knuckle at the base (bottom-center) ---
th = Image.open('public/hand/thumb.png').convert('RGBA')
tw, thh = th.size
d = ImageDraw.Draw(th)
tx, ty = tw // 2, thh - 24
d.ellipse([tx - r, ty - r, tx + r, ty + r], fill=(220, 30, 30, 255), outline=(255, 255, 255, 255), width=3)
th.save('public/hand/_thumb_dots.png')
print('thumb', tw, thh, 'knuckle@', tx, ty, '-> public/hand/_thumb_dots.png')
