"""
Build OnlyBirdNerds how-to GIF — full-bleed 1280x720 version.
No text bar; screenshots fill the whole frame.
A small step counter sits in the lower-right corner of each step frame.
Output: howto.gif in the same folder.
"""
from PIL import Image, ImageDraw, ImageFont
import os

FOLDER = os.path.dirname(os.path.abspath(__file__))
OUT    = os.path.join(FOLDER, 'howto.gif')
W, H   = 1280, 720

# Brand palette
BG    = (10,  16,  11)
FERN  = (74,  124, 89)
SAGE  = (122, 171, 136)
CREAM = (247, 243, 236)
DIM   = (28,  44,  33)

STEPS = [
    dict(file='1Ebird_download.png',  num='01', total='06'),
    dict(file='2EbirdCsv.png',        num='02', total='06'),
    dict(file='3.1MapExample.png',    num='03', total='06'),
    dict(file='3.2MapExample.png',    num='04', total='06'),
    dict(file='4completequests.png',  num='05', total='06'),
    dict(file='5 Edit Map & Share .png', num='06', total='06'),
]

# ── Fonts ──────────────────────────────────────────────────────────────────
def load_font(paths, size):
    for p in paths:
        try: return ImageFont.truetype(p, size)
        except: pass
    return ImageFont.load_default()

BOLD = [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf']
REG  = [r'C:\Windows\Fonts\segoeui.ttf',  r'C:\Windows\Fonts\arial.ttf']
MONO = [r'C:\Windows\Fonts\consola.ttf',  r'C:\Windows\Fonts\cour.ttf']

f_step    = load_font(MONO, 13)
f_h1      = load_font(BOLD, 52)
f_h2      = load_font(REG,  20)
f_url     = load_font(MONO, 13)


# ── Helpers ────────────────────────────────────────────────────────────────
def cover_image(img, tw, th):
    """Scale to cover (center-crop) the target rectangle."""
    w, h = img.size
    scale = max(tw / w, th / h)
    nw, nh = int(w * scale), int(h * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return img.crop((x, y, x + tw, y + th))


def bottom_gradient(frame, strength=0.55):
    """Burn a dark gradient into the bottom third for text readability."""
    grad_h = H // 3
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(grad_h):
        alpha = int(strength * 255 * (y / grad_h))
        draw.line([(0, H - grad_h + y), (W, H - grad_h + y)],
                  fill=(4, 8, 5, alpha))
    return Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')


def text_shadow(draw, xy, text, font, fill):
    x, y = xy
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0))
    draw.text((x, y),         text, font=font, fill=fill)


# ── Frame builders ─────────────────────────────────────────────────────────
def make_hero_frame():
    """Full-bleed map photo + centred title overlay."""
    raw   = Image.open(os.path.join(FOLDER, '0_HowTo.png')).convert('RGB')
    base  = cover_image(raw, W, H)
    dark  = Image.new('RGB', (W, H), (4, 8, 5))
    frame = Image.blend(base, dark, alpha=0.55)
    frame = bottom_gradient(frame, strength=0.7)
    draw  = ImageDraw.Draw(frame)

    cx, cy = W // 2, H // 2

    line1 = 'How to create your'
    bb1 = draw.textbbox((0, 0), line1, font=f_h2)
    draw.text(((W - (bb1[2]-bb1[0])) // 2, cy - 72), line1, font=f_h2, fill=SAGE)

    line2 = 'OnlyBirdNerds map!'
    bb2 = draw.textbbox((0, 0), line2, font=f_h1)
    text_shadow(draw, ((W - (bb2[2]-bb2[0])) // 2, cy - 30), line2, f_h1, CREAM)

    draw.line([(cx - 130, cy + 42), (cx + 130, cy + 42)], fill=FERN, width=1)

    line3 = '6 simple steps  |  all in your browser'
    bb3 = draw.textbbox((0, 0), line3, font=f_url)
    draw.text(((W - (bb3[2]-bb3[0])) // 2, cy + 56), line3, font=f_url, fill=SAGE)

    url = 'onlybirdnerds.com'
    bb4 = draw.textbbox((0, 0), url, font=f_url)
    draw.text((W - (bb4[2]-bb4[0]) - 24, H - 30), url, font=f_url, fill=(55, 85, 62))

    return frame


def make_step_frame(step):
    """Full-bleed screenshot + small step counter in lower-right."""
    raw   = Image.open(os.path.join(FOLDER, step['file'])).convert('RGB')
    frame = cover_image(raw, W, H)
    frame = bottom_gradient(frame, strength=0.45)
    draw  = ImageDraw.Draw(frame)

    # Step pill — lower right
    pill = f"STEP  {step['num']} / {step['total']}"
    bb   = draw.textbbox((0, 0), pill, font=f_step)
    pw   = bb[2] - bb[0]
    px   = W - pw - 24
    py   = H - 34
    # Pill background
    pad = 6
    draw.rounded_rectangle([px - pad, py - pad + 2, px + pw + pad, py + (bb[3]-bb[1]) + pad],
                            radius=5, fill=(10, 16, 11, 180))
    draw.text((px, py), pill, font=f_step, fill=SAGE)

    return frame


# ── Cross-fade ─────────────────────────────────────────────────────────────
def fade_between(a, b, n=3):
    return [Image.blend(a, b, alpha=(i + 1) / (n + 1)) for i in range(n)]


# ── Assemble ───────────────────────────────────────────────────────────────
print('Building frames...')
hero        = make_hero_frame()
step_frames = [make_step_frame(s) for s in STEPS]

HERO_MS = 3200
HOLD_MS = 3000
LAST_MS = 5000
FADE_MS = 70    # 5 frames × 70ms = 350ms transition

frames, durations = [], []

def add(f, ms):
    frames.append(f.convert('P', palette=Image.ADAPTIVE, colors=128))
    durations.append(ms)

add(hero, HERO_MS)
for f in fade_between(hero, step_frames[0]): add(f, FADE_MS)

for i, sf in enumerate(step_frames):
    add(sf, LAST_MS if i == len(step_frames) - 1 else HOLD_MS)
    if i < len(step_frames) - 1:
        for f in fade_between(sf, step_frames[i + 1]): add(f, FADE_MS)

for f in fade_between(step_frames[-1], hero): add(f, FADE_MS)

print(f'Total frames: {len(frames)}')
print('Saving GIF (this may take a minute at 1280x720)...')

frames[0].save(
    OUT, save_all=True, append_images=frames[1:],
    duration=durations, loop=0, optimize=True,
)

kb = os.path.getsize(OUT) // 1024
print(f'Done! {OUT}  ({kb} KB)')
