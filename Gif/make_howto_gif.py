"""
Build OnlyBirdNerds how-to GIF from screenshots.
Output: howto.gif in the same folder.
Frames:
  0  — hero overlay on map photo
  01 — Download eBird data
  02 — Drop CSV on site
  03 — Map appears
  04 — Click a hotspot
  05 — Quest on!
  06 — Build a profile & share
"""
from PIL import Image, ImageDraw, ImageFont
import os

FOLDER = os.path.dirname(os.path.abspath(__file__))
OUT    = os.path.join(FOLDER, 'howto.gif')
W, H   = 800, 520
IMG_H  = 340   # image area height
BAR_H  = H - IMG_H  # text bar height = 180

# Brand palette
BG    = (10,  16,  11)
FERN  = (74,  124, 89)
SAGE  = (122, 171, 136)
CREAM = (247, 243, 236)
MIST  = (200, 221, 208)
DIM   = (28,  44,  33)

STEPS = [
    dict(file='1Ebird_download.png',
         num='01', total='06',
         title='Download your eBird data',
         sub='My eBird  →  Download My Data  →  Save MyEBirdData.csv'),
    dict(file='2EbirdCsv.png',
         num='02', total='06',
         title='Drop your CSV on the site',
         sub='Everything runs in your browser — your data never leaves your device.'),
    dict(file='3.1MapExample.png',
         num='03', total='06',
         title='Your personalized map is built!',
         sub='Every hotspot, county & state — with rare bird photos on each marker.'),
    dict(file='3.2MapExample.png',
         num='04', total='06',
         title='Click any hotspot to explore',
         sub='See every species observed there, with photos and All About Birds links.'),
    dict(file='4completequests.png',
         num='05', total='06',
         title='Quest on!',
         sub='Earn badges and track progress toward your next birding milestone.'),
    dict(file='5 Edit Map & Share .png',
         num='06', total='06',
         title='Build a profile & share',
         sub='Save your look, then share selected trips — only if you want to.'),
]


# ── Fonts ──────────────────────────────────────────────────────────────────
def load_font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()

BOLD = [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf']
REG  = [r'C:\Windows\Fonts\segoeui.ttf',  r'C:\Windows\Fonts\arial.ttf']
MONO = [r'C:\Windows\Fonts\consola.ttf',  r'C:\Windows\Fonts\cour.ttf']

f_hero_small = load_font(REG,  16)
f_hero_big   = load_font(BOLD, 36)
f_num        = load_font(MONO, 11)
f_title      = load_font(BOLD, 22)
f_sub        = load_font(REG,  13)
f_logo       = load_font(MONO, 10)


# ── Helpers ────────────────────────────────────────────────────────────────
def fit_image(img, max_w, max_h):
    w, h = img.size
    scale = min(max_w / w, max_h / h)
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def cover_image(img, target_w, target_h):
    """Scale to cover (crop to fill) the target rectangle."""
    w, h = img.size
    scale = max(target_w / w, target_h / h)
    nw, nh = int(w * scale), int(h * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    x = (nw - target_w) // 2
    y = (nh - target_h) // 2
    return img.crop((x, y, x + target_w, y + target_h))


def centered_text(draw, text, font, y, color):
    bb = draw.textbbox((0, 0), text, font=font)
    x  = (W - (bb[2] - bb[0])) // 2
    draw.text((x + 1, y + 1), text, font=font, fill=(0, 0, 0))  # shadow
    draw.text((x, y),         text, font=font, fill=color)


# ── Frame builders ─────────────────────────────────────────────────────────
def make_hero_frame():
    """Frame 0: full-bleed map photo + centered title overlay."""
    raw  = Image.open(os.path.join(FOLDER, '0_HowTo.png')).convert('RGB')
    base = cover_image(raw, W, H)

    # Dark overlay blended over the photo
    dark = Image.new('RGB', (W, H), (4, 8, 5))
    frame = Image.blend(base, dark, alpha=0.58)
    draw  = ImageDraw.Draw(frame)

    cy = H // 2

    # Top line
    line1 = 'How to create your'
    bb1 = draw.textbbox((0, 0), line1, font=f_hero_small)
    x1  = (W - (bb1[2] - bb1[0])) // 2
    draw.text((x1, cy - 60), line1, font=f_hero_small, fill=SAGE)

    # Main title
    line2 = 'OnlyBirdNerds map!'
    bb2 = draw.textbbox((0, 0), line2, font=f_hero_big)
    x2  = (W - (bb2[2] - bb2[0])) // 2
    draw.text((x2 + 2, cy - 20 + 2), line2, font=f_hero_big, fill=(0, 0, 0))   # shadow
    draw.text((x2,     cy - 20),      line2, font=f_hero_big, fill=CREAM)

    # Divider
    draw.line([(W//2 - 100, cy + 30), (W//2 + 100, cy + 30)], fill=FERN, width=1)

    # Sub line
    line3 = '6 simple steps  ·  all in your browser'
    bb3 = draw.textbbox((0, 0), line3, font=f_logo)
    x3  = (W - (bb3[2] - bb3[0])) // 2
    draw.text((x3, cy + 42), line3, font=f_logo, fill=SAGE)

    # URL bottom-right
    url = 'onlybirdnerds.com'
    bb  = draw.textbbox((0, 0), url, font=f_logo)
    draw.text((W - (bb[2]-bb[0]) - 16, H - 20), url, font=f_logo, fill=(55, 85, 62))

    return frame


def make_step_frame(step):
    frame = Image.new('RGB', (W, H), BG)
    draw  = ImageDraw.Draw(frame)

    # ── Image area ──────────────────────────────────────
    pad = 16
    raw = Image.open(os.path.join(FOLDER, step['file'])).convert('RGB')
    img = fit_image(raw, W - pad * 2, IMG_H - pad * 2)
    iw, ih = img.size
    ix = (W - iw) // 2
    iy = pad + ((IMG_H - pad * 2) - ih) // 2

    # Shadow
    shadow = Image.new('RGB', (iw + 8, ih + 8), (5, 10, 6))
    frame.paste(shadow, (ix - 4, iy - 4))
    # Border
    border = Image.new('RGB', (iw + 2, ih + 2), (38, 68, 48))
    frame.paste(border, (ix - 1, iy - 1))
    frame.paste(img, (ix, iy))

    # ── Text bar ─────────────────────────────────────────
    bar_y = IMG_H
    bar   = Image.new('RGB', (W, BAR_H), DIM)
    frame.paste(bar, (0, bar_y))
    draw.line([(0, bar_y), (W, bar_y)], fill=FERN, width=2)

    # Step pill
    pill = f"STEP  {step['num']} / {step['total']}"
    draw.text((24, bar_y + 12), pill, font=f_num, fill=SAGE)

    # Title
    draw.text((25, bar_y + 31), step['title'], font=f_title, fill=(0, 0, 0))  # shadow
    draw.text((24, bar_y + 30), step['title'], font=f_title, fill=CREAM)

    # Sub
    draw.text((24, bar_y + 62), step['sub'], font=f_sub, fill=MIST)

    # URL watermark
    url = 'onlybirdnerds.com'
    bb  = draw.textbbox((0, 0), url, font=f_logo)
    draw.text((W - (bb[2]-bb[0]) - 16, bar_y + BAR_H - 18), url, font=f_logo, fill=(50, 78, 58))

    return frame


# ── Cross-fade helper ──────────────────────────────────────────────────────
def fade_between(a, b, n=4):
    """n blended RGB frames from a → b."""
    return [Image.blend(a, b, alpha=(i+1)/(n+1)) for i in range(n)]


# ── Assemble ───────────────────────────────────────────────────────────────
print('Building frames...')
hero       = make_hero_frame()
step_frames = [make_step_frame(s) for s in STEPS]

HERO_MS  = 3200   # hero hold
HOLD_MS  = 3000   # normal step hold
LAST_MS  = 5000   # last step hold (longer read time)
FADE_MS  = 75     # ms per fade frame (4 × 75 = 300ms transition)

frames, durations = [], []

def add(f, ms):
    frames.append(f.convert('P', palette=Image.ADAPTIVE, colors=220))
    durations.append(ms)

# Hero → step 1
add(hero, HERO_MS)
for f in fade_between(hero, step_frames[0]):
    add(f, FADE_MS)

# Steps with fades between
for i, sf in enumerate(step_frames):
    hold = LAST_MS if i == len(step_frames) - 1 else HOLD_MS
    add(sf, hold)
    if i < len(step_frames) - 1:
        for f in fade_between(sf, step_frames[i + 1]):
            add(f, FADE_MS)

# Fade back to hero for seamless loop
for f in fade_between(step_frames[-1], hero):
    add(f, FADE_MS)

print(f'Total frames: {len(frames)}')
print('Saving GIF...')

frames[0].save(
    OUT,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    optimize=True,
)

kb = os.path.getsize(OUT) // 1024
print(f'Done! {OUT}  ({kb} KB)')
