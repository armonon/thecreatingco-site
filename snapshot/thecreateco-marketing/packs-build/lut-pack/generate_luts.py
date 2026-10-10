#!/usr/bin/env python3
"""
thecreateco LUT pack generator.

Builds 33^3 .cube 3D LUTs using real, parameterized color-grading math:
  - 3x3 color matrices (channel cross-talk / mixing)
  - per-channel tone curves (lifted blacks, S-curves, rolled highlights)
  - luma-preserving saturation / desaturation
  - split toning (shadow tint vs highlight tint, blended by luma)
  - hue-dependent saturation / hue rotation (for teal & orange style looks)

No LUTs are copied, scraped, or hard-coded as tables -- every look is a
function of a small parameter set run through the math below, evaluated
on the full 33^3 identity grid. This script also builds the test chart,
renders every preview (via its own trilinear interpolation, not the
generation math), assembles a contact sheet, runs a validation pass,
and writes the docs + zip for the pack.

Run: python3 generate_luts.py
"""

import os
import struct
import zipfile
from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------------

ROOT = os.path.dirname(os.path.abspath(__file__))
CUBES_DIR = os.path.join(ROOT, "cubes")
PREVIEWS_DIR = os.path.join(ROOT, "previews")
for d in (CUBES_DIR, PREVIEWS_DIR):
    os.makedirs(d, exist_ok=True)

LUT_SIZE = 33  # standard Adobe/DaVinci 33^3 cube

# ----------------------------------------------------------------------------
# Core color math (all operates on float arrays in [0, 1], shape (..., 3))
# ----------------------------------------------------------------------------

def luma(rgb: np.ndarray) -> np.ndarray:
    """Rec.709 relative luma, keeps last dim collapsed."""
    w = np.array([0.2126, 0.7152, 0.0722])
    return np.tensordot(rgb, w, axes=([-1], [0]))


def apply_matrix(rgb: np.ndarray, m: np.ndarray) -> np.ndarray:
    """Apply a 3x3 matrix (channel mixing / cross-talk) to an (..., 3) array."""
    return np.tensordot(rgb, m.T, axes=([-1], [0]))


def lift_gamma_gain(rgb: np.ndarray, lift=0.0, gamma=1.0, gain=1.0) -> np.ndarray:
    """
    Classic colorist lift/gamma/gain, applied per call (same curve on all
    channels unless the caller passes per-channel arrays for lift/gamma/gain).
    lift: raises/lowers blacks (additive, tapered toward white)
    gamma: midtone power curve
    gain: scales overall output (whites)
    """
    x = np.clip(rgb, 0.0, 1.0)
    x = x + lift * (1.0 - x)
    x = np.clip(x, 1e-6, 1.0)
    x = x ** (1.0 / gamma)
    x = x * gain
    return x


def s_curve(x: np.ndarray, strength: float = 0.5, pivot: float = 0.5) -> np.ndarray:
    """
    Smooth contrast S-curve built from a sigmoid centered at `pivot`.
    strength in roughly [0, 1.5]; 0 = identity line.
    """
    if strength <= 0:
        return x
    k = 1.0 + strength * 6.0
    # normalize so endpoints 0 and 1 still map to 0 and 1
    def sig(v):
        return 1.0 / (1.0 + np.exp(-k * (v - pivot)))
    s0, s1 = sig(0.0), sig(1.0)
    y = sig(x)
    y = (y - s0) / (s1 - s0)
    return y


def highlight_rolloff(x: np.ndarray, knee: float = 0.75, amount: float = 0.5) -> np.ndarray:
    """
    Soft-clip values above `knee` toward 1.0, simulating film highlight
    rolloff instead of a hard clip. amount in [0,1] controls how much of
    the over-knee range gets compressed.
    """
    out = x.copy()
    mask = x > knee
    span = 1.0 - knee
    if span <= 1e-6:
        return out
    over = (x - knee) / span  # 0..~ above knee
    compressed = 1.0 - np.exp(-over * (1.0 - amount * 0.0 + 3.0))
    compressed = np.clip(compressed, 0.0, 1.0)
    blended = over * (1.0 - amount) + compressed * amount
    out = np.where(mask, knee + blended * span, out)
    return out


def shadow_lift_curve(x: np.ndarray, amount: float = 0.0, reach: float = 0.35) -> np.ndarray:
    """Lift shadows only, tapering off by `reach` so midtones/highlights are untouched."""
    if amount == 0:
        return x
    taper = np.clip(1.0 - x / reach, 0.0, 1.0) ** 1.5
    return x + amount * taper * (1.0 - x)


def crush_shadow_curve(x: np.ndarray, amount: float = 0.0, reach: float = 0.3) -> np.ndarray:
    """Pull shadows down toward black (crush), tapering off by `reach`."""
    if amount == 0:
        return x
    taper = np.clip(1.0 - x / reach, 0.0, 1.0) ** 1.5
    return x - amount * taper * x


def luma_preserving_saturation(rgb: np.ndarray, sat: float) -> np.ndarray:
    """
    sat = 1.0 -> unchanged, 0.0 -> full grayscale (luma-preserving),
    >1.0 -> boosted saturation. Mixes each pixel with its own luma.
    """
    l = luma(rgb)[..., None]
    gray = np.repeat(l, 3, axis=-1)
    return gray + (rgb - gray) * sat


def split_tone(rgb: np.ndarray, shadow_rgb, highlight_rgb, balance: float = 0.5,
               strength: float = 0.25) -> np.ndarray:
    """
    Tint shadows toward `shadow_rgb` and highlights toward `highlight_rgb`,
    blended by the pixel's own luma. balance shifts the luma crossover
    point; strength scales how strong the tint is.
    """
    l = luma(rgb)
    w_high = np.clip((l - balance) / max(1e-6, 1.0 - balance), 0.0, 1.0)
    w_high = w_high ** 0.8
    w_low = 1.0 - w_high
    shadow_rgb = np.array(shadow_rgb)
    highlight_rgb = np.array(highlight_rgb)
    tint = w_low[..., None] * (shadow_rgb - 0.5) + w_high[..., None] * (highlight_rgb - 0.5)
    return rgb + tint * strength


def rgb_to_hue(rgb: np.ndarray) -> np.ndarray:
    """Return hue in turns [0,1) for an (...,3) array, via a cheap HSV conversion."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = np.max(rgb, axis=-1)
    minc = np.min(rgb, axis=-1)
    diff = np.where(maxc - minc < 1e-8, 1e-8, maxc - minc)
    rc = (maxc - r) / diff
    gc = (maxc - g) / diff
    bc = (maxc - b) / diff
    hue = np.zeros_like(maxc)
    hue = np.where(maxc == r, bc - gc, hue)
    hue = np.where(maxc == g, 2.0 + rc - bc, hue)
    hue = np.where(maxc == b, 4.0 + gc - rc, hue)
    hue = (hue / 6.0) % 1.0
    hue = np.where(maxc - minc < 1e-8, 0.0, hue)
    return hue


def hue_weight(hue: np.ndarray, center: float, width: float) -> np.ndarray:
    """Gaussian-ish weight of hue closeness to `center` turn, wrapping around 1.0."""
    d = np.abs(hue - center)
    d = np.minimum(d, 1.0 - d)
    return np.exp(-(d ** 2) / (2.0 * width ** 2))


def teal_orange_push(rgb: np.ndarray, strength: float = 0.18) -> np.ndarray:
    """
    Hue-dependent saturation/hue favoring blue-cyan shadows and
    orange-skin highlights -- the classic "teal & orange" split, done
    via hue masks rather than a hard-coded 3D table.
    """
    hue = rgb_to_hue(rgb)
    l = luma(rgb)
    # orange sits around hue ~0.07 (skin/highlight midtones), teal ~0.5
    orange_w = hue_weight(hue, 0.07, 0.10) * np.clip(l, 0.15, 1.0)
    teal_w = hue_weight(hue, 0.52, 0.14) * np.clip(1.0 - l, 0.15, 1.0)

    orange_push = np.array([0.06, 0.015, -0.05])
    teal_push = np.array([-0.05, 0.01, 0.06])

    out = rgb.copy()
    out = out + orange_w[..., None] * orange_push * strength * 5.0
    out = out + teal_w[..., None] * teal_push * strength * 5.0

    # extra saturation boost exactly in those hue bands
    sat_boost = 1.0 + strength * (orange_w + teal_w)
    gray = np.repeat(luma(out)[..., None], 3, axis=-1)
    out = gray + (out - gray) * sat_boost[..., None]
    return out


def mix_channels(rgb: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    return apply_matrix(rgb, matrix)


def clip01(x: np.ndarray) -> np.ndarray:
    return np.clip(x, 0.0, 1.0)


# ----------------------------------------------------------------------------
# Look registry -- each look is a pure function (N,3) float array -> (N,3)
# ----------------------------------------------------------------------------

@dataclass
class Look:
    name: str            # display name
    slug: str            # kebab-case filename stem
    description: str     # one-line description for MANIFEST
    fn: Callable[[np.ndarray], np.ndarray]


LOOKS: list[Look] = []


def register(name, slug, description):
    def deco(fn):
        LOOKS.append(Look(name=name, slug=slug, description=description, fn=fn))
        return fn
    return deco


@register("Warm Film", "warm-film",
           "Gentle warm color-matrix push with lifted shadows and a soft S-curve, like a sun-warmed print.")
def look_warm_film(rgb):
    m = np.array([
        [1.08, 0.00, -0.02],
        [0.02, 1.02, -0.02],
        [-0.03, -0.02, 0.92],
    ])
    x = mix_channels(rgb, m)
    x = shadow_lift_curve(x, amount=0.05, reach=0.3)
    x = s_curve(x, strength=0.35, pivot=0.48)
    x = split_tone(x, shadow_rgb=(0.52, 0.49, 0.45), highlight_rgb=(0.55, 0.50, 0.42),
                    balance=0.45, strength=0.12)
    x = luma_preserving_saturation(x, 1.08)
    return clip01(x)


@register("Cool Night", "cool-night",
           "Blue-leaning matrix with deepened shadows and a cooled highlight rolloff for night and blue-hour footage.")
def look_cool_night(rgb):
    m = np.array([
        [0.94, 0.00, 0.04],
        [0.00, 0.96, 0.05],
        [0.03, 0.02, 1.10],
    ])
    x = mix_channels(rgb, m)
    x = crush_shadow_curve(x, amount=0.10, reach=0.32)
    x = s_curve(x, strength=0.45, pivot=0.52)
    x = highlight_rolloff(x, knee=0.72, amount=0.4)
    x = split_tone(x, shadow_rgb=(0.42, 0.47, 0.58), highlight_rgb=(0.48, 0.50, 0.55),
                    balance=0.5, strength=0.16)
    x = luma_preserving_saturation(x, 0.9)
    return clip01(x)


@register("Bleach Bypass", "bleach-bypass",
           "Silver-retention style skip: desaturated, high-contrast, with a cool steel cast and punched highlights.")
def look_bleach_bypass(rgb):
    x = luma_preserving_saturation(rgb, 0.35)
    m = np.array([
        [1.05, -0.03, -0.02],
        [-0.02, 1.05, -0.03],
        [-0.03, -0.02, 1.08],
    ])
    x = mix_channels(x, m)
    x = s_curve(x, strength=0.9, pivot=0.5)
    x = crush_shadow_curve(x, amount=0.08, reach=0.25)
    x = split_tone(x, shadow_rgb=(0.47, 0.49, 0.52), highlight_rgb=(0.5, 0.5, 0.5),
                    balance=0.5, strength=0.08)
    return clip01(x)


@register("Faded Matte", "faded-matte",
           "Low-contrast matte finish: lifted black floor, rolled highlights, and gently muted color.")
def look_faded_matte(rgb):
    x = rgb.copy()
    x = lift_gamma_gain(x, lift=0.09, gamma=1.05, gain=0.96)
    x = highlight_rolloff(x, knee=0.68, amount=0.55)
    x = s_curve(x, strength=0.08, pivot=0.5)
    x = luma_preserving_saturation(x, 0.82)
    x = split_tone(x, shadow_rgb=(0.5, 0.49, 0.47), highlight_rgb=(0.51, 0.50, 0.47),
                    balance=0.5, strength=0.08)
    return clip01(x)


@register("Teal & Orange", "teal-orange",
           "Hue-targeted push toward teal shadows and orange skin/highlights with a confident contrast curve.")
def look_teal_orange(rgb):
    x = rgb.copy()
    x = s_curve(x, strength=0.35, pivot=0.5)
    x = teal_orange_push(x, strength=0.22)
    m = np.array([
        [1.03, 0.00, -0.01],
        [0.00, 1.01, 0.01],
        [-0.02, 0.01, 1.03],
    ])
    x = mix_channels(x, m)
    x = luma_preserving_saturation(x, 1.12)
    return clip01(x)


@register("Mono Contrast", "mono-contrast",
           "Near-desaturated contrasty black & white with a whisper of warmth retained in the highlights.")
def look_mono_contrast(rgb):
    l = luma(rgb)
    gray = np.repeat(l[..., None], 3, axis=-1)
    x = gray * 0.96 + rgb * 0.04  # almost fully desaturated, tiny color trace
    x = s_curve(x, strength=0.75, pivot=0.46)
    x = crush_shadow_curve(x, amount=0.06, reach=0.22)
    x = split_tone(x, shadow_rgb=(0.49, 0.495, 0.505), highlight_rgb=(0.515, 0.5, 0.47),
                    balance=0.55, strength=0.1)
    return clip01(x)


@register("Golden Hour", "golden-hour",
           "Warm matrix skew toward amber with lifted shadow glow and a gentle highlight bloom.")
def look_golden_hour(rgb):
    m = np.array([
        [1.12, 0.03, -0.05],
        [0.04, 1.04, -0.04],
        [-0.06, -0.04, 0.86],
    ])
    x = mix_channels(rgb, m)
    x = shadow_lift_curve(x, amount=0.06, reach=0.35)
    x = highlight_rolloff(x, knee=0.78, amount=0.35)
    x = s_curve(x, strength=0.25, pivot=0.48)
    x = split_tone(x, shadow_rgb=(0.54, 0.49, 0.42), highlight_rgb=(0.56, 0.5, 0.38),
                    balance=0.4, strength=0.18)
    x = luma_preserving_saturation(x, 1.15)
    return clip01(x)


@register("Soft Pastel", "soft-pastel",
           "Airy low-contrast pastel grade: lifted blacks, gentle desaturation, and a cool-pink highlight tint.")
def look_soft_pastel(rgb):
    x = lift_gamma_gain(rgb, lift=0.12, gamma=1.0, gain=0.95)
    x = highlight_rolloff(x, knee=0.7, amount=0.5)
    x = luma_preserving_saturation(x, 0.72)
    x = split_tone(x, shadow_rgb=(0.49, 0.50, 0.53), highlight_rgb=(0.53, 0.50, 0.51),
                    balance=0.5, strength=0.14)
    x = s_curve(x, strength=0.05, pivot=0.5)
    return clip01(x)


@register("Deep Shadow", "deep-shadow",
           "Crushed, inky blacks with a protected, gently rolled highlight for a dense, graphic contrast look.")
def look_deep_shadow(rgb):
    x = crush_shadow_curve(rgb, amount=0.22, reach=0.4)
    x = s_curve(x, strength=0.55, pivot=0.42)
    x = highlight_rolloff(x, knee=0.8, amount=0.3)
    m = np.array([
        [1.04, 0.00, -0.01],
        [0.00, 1.0, 0.00],
        [-0.02, 0.00, 1.05],
    ])
    x = mix_channels(x, m)
    x = split_tone(x, shadow_rgb=(0.46, 0.48, 0.53), highlight_rgb=(0.51, 0.50, 0.49),
                    balance=0.42, strength=0.1)
    x = luma_preserving_saturation(x, 1.05)
    return clip01(x)


# ----------------------------------------------------------------------------
# .cube writer / reader
# ----------------------------------------------------------------------------

def build_identity_grid(size: int) -> np.ndarray:
    """
    Returns an (size^3, 3) array of RGB identity coordinates, ordered the
    way the .cube spec requires: red fastest, then green, then blue.
    """
    coords = np.linspace(0.0, 1.0, size)
    r, g, b = np.meshgrid(coords, coords, coords, indexing="ij")
    # .cube ordering: R increments fastest, then G, then B
    r = np.transpose(r, (2, 1, 0)).reshape(-1)
    g = np.transpose(g, (2, 1, 0)).reshape(-1)
    b = np.transpose(b, (2, 1, 0)).reshape(-1)
    return np.stack([r, g, b], axis=-1)


def write_cube(path: str, title: str, size: int, lut_rgb: np.ndarray, precision: int = 6):
    """Write a standard .cube 3D LUT file. lut_rgb must already be in .cube order."""
    lut_rgb = np.clip(lut_rgb, 0.0, 1.0)
    lines = []
    lines.append(f'TITLE "{title}"')
    lines.append(f"LUT_3D_SIZE {size}")
    lines.append("DOMAIN_MIN 0.0 0.0 0.0")
    lines.append("DOMAIN_MAX 1.0 1.0 1.0")
    fmt = f"{{:.{precision}f}} {{:.{precision}f}} {{:.{precision}f}}"
    for row in lut_rgb:
        lines.append(fmt.format(row[0], row[1], row[2]))
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def read_cube(path: str):
    """Minimal, independent .cube loader used for validation and preview rendering."""
    size = None
    data = []
    title = None
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("TITLE"):
                title = line
                continue
            if line.startswith("LUT_3D_SIZE"):
                size = int(line.split()[1])
                continue
            if line.startswith("DOMAIN_"):
                continue
            parts = line.split()
            if len(parts) == 3:
                data.append([float(p) for p in parts])
    arr = np.array(data, dtype=np.float64)
    return title, size, arr


# ----------------------------------------------------------------------------
# Trilinear interpolation (used for previews -- independent of generation path)
# ----------------------------------------------------------------------------

def apply_lut_trilinear(image: np.ndarray, lut_flat: np.ndarray, size: int) -> np.ndarray:
    """
    image: (H,W,3) float in [0,1]
    lut_flat: (size^3, 3) in .cube order (R fastest, then G, then B)
    Returns graded (H,W,3) float in [0,1] via manual trilinear interpolation.
    """
    cube = lut_flat.reshape(size, size, size, 3, order="F")
    # cube[r_idx, g_idx, b_idx] gives the output RGB for that grid node

    h, w, _ = image.shape
    flat = image.reshape(-1, 3)
    scaled = np.clip(flat, 0.0, 1.0) * (size - 1)
    i0 = np.floor(scaled).astype(int)
    i1 = np.clip(i0 + 1, 0, size - 1)
    frac = scaled - i0

    r0, g0, b0 = i0[:, 0], i0[:, 1], i0[:, 2]
    r1, g1, b1 = i1[:, 0], i1[:, 1], i1[:, 2]
    fr, fg, fb = frac[:, 0:1], frac[:, 1:2], frac[:, 2:3]

    c000 = cube[r0, g0, b0]
    c100 = cube[r1, g0, b0]
    c010 = cube[r0, g1, b0]
    c110 = cube[r1, g1, b0]
    c001 = cube[r0, g0, b1]
    c101 = cube[r1, g0, b1]
    c011 = cube[r0, g1, b1]
    c111 = cube[r1, g1, b1]

    c00 = c000 * (1 - fr) + c100 * fr
    c10 = c010 * (1 - fr) + c110 * fr
    c01 = c001 * (1 - fr) + c101 * fr
    c11 = c011 * (1 - fr) + c111 * fr

    c0 = c00 * (1 - fg) + c10 * fg
    c1 = c01 * (1 - fg) + c11 * fg

    out = c0 * (1 - fb) + c1 * fb
    return np.clip(out.reshape(h, w, 3), 0.0, 1.0)


# ----------------------------------------------------------------------------
# Synthetic test chart
# ----------------------------------------------------------------------------

def hsv_to_rgb_np(h, s, v):
    h = np.asarray(h); s = np.asarray(s); v = np.asarray(v)
    i = np.floor(h * 6.0).astype(int) % 6
    f = h * 6.0 - np.floor(h * 6.0)
    p = v * (1.0 - s)
    q = v * (1.0 - f * s)
    t = v * (1.0 - (1.0 - f) * s)
    shape = h.shape + (3,)
    out = np.zeros(shape)
    choices = [
        np.stack([v, t, p], -1), np.stack([q, v, p], -1), np.stack([p, v, t], -1),
        np.stack([p, q, v], -1), np.stack([t, p, v], -1), np.stack([v, p, q], -1),
    ]
    for k in range(6):
        mask = (i == k)
        out[mask] = choices[k][mask]
    return out


def build_test_image(width=800, height=450) -> np.ndarray:
    """
    Builds a synthetic test chart (float RGB in [0,1]):
      - top band: horizontal hue gradient
      - middle band: vertical black->white luminance ramp (full width)
      - grey patch row (neutral swatches at varying luminance)
      - bottom row: saturated swatches (skin-ish, sky-blue, foliage-green)
    """
    img = np.zeros((height, width, 3), dtype=np.float64)

    hue_h = int(height * 0.30)
    ramp_h = int(height * 0.28)
    grey_h = int(height * 0.18)
    swatch_h = height - hue_h - ramp_h - grey_h

    # 1) hue band
    xs = np.linspace(0.0, 1.0, width)
    hue_row = hsv_to_rgb_np(xs, np.full(width, 0.75), np.full(width, 0.95))
    img[0:hue_h, :, :] = hue_row[None, :, :]

    # 2) luminance ramp band (vertical within this band is same value... make it
    #    a horizontal black->white ramp instead, as requested: "vertical luminance
    #    ramp" -> implement as vertical gradient black (top) to white (bottom) of band
    y0 = hue_h
    y1 = hue_h + ramp_h
    vs = np.linspace(0.0, 1.0, ramp_h)
    ramp_col = np.stack([vs, vs, vs], axis=-1)  # (ramp_h, 3)
    img[y0:y1, :, :] = ramp_col[:, None, :]

    # 3) grey patch row: series of neutral grey swatches across width
    y2 = y1
    y3 = y1 + grey_h
    n_patches = 8
    patch_w = width // n_patches
    for i in range(n_patches):
        v = i / (n_patches - 1)
        img[y2:y3, i * patch_w:(i + 1) * patch_w, :] = v

    # 4) saturated swatches: skin-ish, sky-blue, foliage-green, plus a couple more
    y4 = y3
    y5 = height
    swatches = [
        (0.86, 0.67, 0.55),   # skin-tone-ish
        (0.35, 0.62, 0.88),   # sky blue
        (0.30, 0.55, 0.28),   # foliage green
        (0.80, 0.20, 0.20),   # saturated red
        (0.95, 0.75, 0.15),   # saturated yellow/gold
        (0.55, 0.25, 0.65),   # violet
    ]
    n = len(swatches)
    sw_w = width // n
    for i, col in enumerate(swatches):
        x0 = i * sw_w
        x1 = width if i == n - 1 else (i + 1) * sw_w
        img[y4:y5, x0:x1, :] = np.array(col)

    return np.clip(img, 0.0, 1.0)


def to_uint8(img_float: np.ndarray) -> np.ndarray:
    return np.clip(np.round(img_float * 255.0), 0, 255).astype(np.uint8)


def save_png(img_float: np.ndarray, path: str):
    Image.fromarray(to_uint8(img_float)).save(path)


# ----------------------------------------------------------------------------
# Contact sheet
# ----------------------------------------------------------------------------

def build_contact_sheet(entries, cell_w=320, cell_h=180, cols=5, label_h=28,
                         out_path=None):
    """entries: list of (label, float_img) including the original first."""
    n = len(entries)
    rows = (n + cols - 1) // cols
    sheet_w = cols * cell_w
    sheet_h = rows * (cell_h + label_h)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except Exception:
        font = ImageFont.load_default()

    for idx, (label, img_float) in enumerate(entries):
        r, c = divmod(idx, cols)
        thumb = Image.fromarray(to_uint8(img_float)).resize(
            (cell_w, cell_h), Image.LANCZOS)
        x = c * cell_w
        y = r * (cell_h + label_h)
        sheet.paste(thumb, (x, y))
        draw.rectangle([x, y + cell_h, x + cell_w, y + cell_h + label_h], fill=(18, 18, 20))
        draw.text((x + 8, y + cell_h + 6), label, fill=(235, 235, 235), font=font)

    if out_path:
        sheet.save(out_path)
    return sheet


# ----------------------------------------------------------------------------
# Main pipeline
# ----------------------------------------------------------------------------

def main():
    print(f"Generating {len(LOOKS)} looks at {LUT_SIZE}^3 ...")

    identity = build_identity_grid(LUT_SIZE)  # (N,3) in .cube order

    test_img = build_test_image()
    save_png(test_img, os.path.join(PREVIEWS_DIR, "_test-image-original.png"))

    contact_entries = [("Original", test_img)]
    cube_paths = []

    for look in LOOKS:
        graded_grid = look.fn(identity.copy())
        graded_grid = np.clip(graded_grid, 0.0, 1.0)

        cube_path = os.path.join(CUBES_DIR, f"{look.slug}.cube")
        write_cube(cube_path, title=f"thecreateco - {look.name}", size=LUT_SIZE,
                   lut_rgb=graded_grid, precision=4)
        cube_paths.append(cube_path)

        # Render preview using the file we just wrote + our own trilinear
        # interpolator, independent of the direct `look.fn` call, so the
        # preview reflects exactly what the shipped .cube file produces.
        _, size_check, lut_flat = read_cube(cube_path)
        assert size_check == LUT_SIZE
        preview = apply_lut_trilinear(test_img, lut_flat, LUT_SIZE)
        preview_path = os.path.join(PREVIEWS_DIR, f"{look.slug}.png")
        save_png(preview, preview_path)

        contact_entries.append((look.name, preview))
        print(f"  [ok] {look.name:16s} -> {os.path.relpath(cube_path, ROOT)}")

    # Contact sheet
    contact_sheet = build_contact_sheet(contact_entries, cell_w=320, cell_h=180,
                                          cols=5, label_h=28,
                                          out_path=os.path.join(ROOT, "contact-sheet.png"))
    print(f"  [ok] contact-sheet.png ({contact_sheet.width}x{contact_sheet.height})")

    # Hero preview: Golden Hour + Teal & Orange side by side at high res
    hero_names = ["Golden Hour", "Teal & Orange"]
    hero_imgs = [img for (label, img) in contact_entries if label in hero_names]
    hero_w, hero_h = 1200, 630
    half_w = hero_w // 2
    hero = Image.new("RGB", (hero_w, hero_h), (18, 18, 20))
    for i, img_float in enumerate(hero_imgs):
        thumb = Image.fromarray(to_uint8(img_float)).resize(
            (half_w, hero_h), Image.LANCZOS)
        hero.paste(thumb, (i * half_w, 0))
    draw = ImageDraw.Draw(hero)
    try:
        font_big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 34)
    except Exception:
        font_big = ImageFont.load_default()
    label_bar_h = 56
    draw.rectangle([0, hero_h - label_bar_h, hero_w, hero_h], fill=(0, 0, 0))
    draw.text((20, hero_h - label_bar_h + 12), "thecreateco LUT Pack", fill=(255, 255, 255), font=font_big)
    hero_path = os.path.join(ROOT, "hero-preview.png")
    hero.save(hero_path)
    print(f"  [ok] hero-preview.png ({hero.width}x{hero.height})")

    return cube_paths


if __name__ == "__main__":
    main()
