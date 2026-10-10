// Grade (alpha) — "steal this look" colour transfer. Measures the colour
// statistics of a reference still and of the user's own footage in CIELAB,
// builds a per-pixel transfer that moves the footage's distribution onto the
// reference's, and bakes it into a 3D LUT that any editor (ScenePilot included)
// can load as a .cube.
//
// Methods:
// - "reinhard": Reinhard et al. 2001 style mean/std matching per LAB channel.
//   Smooth and safe; captures the overall cast, contrast and saturation.
// - "histogram": per-channel CDF (histogram) matching in LAB. Follows the
//   reference's tonal curve more closely, but can posterize on sparse stills.
// - "balanced": histogram-matched lightness + Reinhard chroma. Default.
//
// A colour transfer is a global function of the input colour, so it is exactly
// representable as a LUT — but it is tuned to the footage it was measured on.
// Pure and deterministic; no DOM. The browser page feeds it ImageData pixels.

export type Lab = [number, number, number];

export type LabStats = {
  mean: Lab;
  std: Lab;
  /** Cumulative distribution per channel over HISTOGRAM_BINS bins. */
  cdf: [Float64Array, Float64Array, Float64Array];
  count: number;
};

export type TransferMethod = "balanced" | "reinhard" | "histogram";

export type TransferOptions = {
  method?: TransferMethod;
  /** 0 = untouched, 1 = full transfer. */
  intensity?: number;
  /** Bound on how far a channel's spread may be stretched or squeezed. */
  maxScale?: number;
};

export const HISTOGRAM_BINS = 256;
/** LAB channel ranges used for histogram binning. */
const RANGES: Array<[number, number]> = [[0, 100], [-128, 128], [-128, 128]];

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

// ---------------------------------------------------------------- conversions

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number) {
  const v = clamp(value, 0, 1);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

// D65 reference white.
const XN = 0.95047, YN = 1, ZN = 1.08883;
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

const fLab = (t: number) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const fLabInv = (t: number) => {
  const cube = t * t * t;
  return cube > EPS ? cube : (116 * t - 16) / KAPPA;
};

/** sRGB (0..1 per channel, gamma-encoded) → CIELAB (D65). */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB (D65) → sRGB 0..1, clipped to gamut. */
export function labToRgb(l: number, a: number, bb: number): [number, number, number] {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - bb / 200;
  const x = fLabInv(fx) * XN, y = fLabInv(fy) * YN, z = fLabInv(fz) * ZN;
  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

// ---------------------------------------------------------------- statistics

const binOf = (value: number, channel: number) => {
  const [lo, hi] = RANGES[channel];
  return clamp(Math.floor(((value - lo) / (hi - lo)) * HISTOGRAM_BINS), 0, HISTOGRAM_BINS - 1);
};

/**
 * Colour statistics of RGBA pixels (e.g. ImageData.data). `step` samples every
 * Nth pixel to keep big frames fast; fully transparent pixels are ignored.
 * Several frames can be merged by concatenating or by `mergeLabStats`.
 */
export function measureLabStats(pixels: ArrayLike<number>, step = 1): LabStats {
  const stride = Math.max(1, Math.floor(step)) * 4;
  const histograms = [new Float64Array(HISTOGRAM_BINS), new Float64Array(HISTOGRAM_BINS), new Float64Array(HISTOGRAM_BINS)];
  const sum = [0, 0, 0];
  const sumSq = [0, 0, 0];
  let count = 0;
  for (let i = 0; i + 3 < pixels.length; i += stride) {
    if (pixels[i + 3] === 0) continue;
    const lab = rgbToLab(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255);
    for (let c = 0; c < 3; c++) {
      sum[c] += lab[c];
      sumSq[c] += lab[c] * lab[c];
      histograms[c][binOf(lab[c], c)] += 1;
    }
    count += 1;
  }
  return statsFromAccumulators(histograms, sum, sumSq, count);
}

function statsFromAccumulators(histograms: Float64Array[], sum: number[], sumSq: number[], count: number): LabStats {
  if (!count) throw new Error("No visible pixels to measure.");
  const mean = sum.map((value) => value / count) as Lab;
  const std = sumSq.map((value, c) => Math.sqrt(Math.max(0, value / count - mean[c] * mean[c]))) as Lab;
  const cdf = histograms.map((histogram) => {
    const out = new Float64Array(HISTOGRAM_BINS);
    let running = 0;
    for (let i = 0; i < HISTOGRAM_BINS; i++) { running += histogram[i]; out[i] = running / count; }
    return out;
  }) as LabStats["cdf"];
  return { mean, std, cdf, count };
}

/** Combine statistics measured on several frames into one, weighted by pixel count. */
export function mergeLabStats(list: LabStats[]): LabStats {
  const valid = list.filter((stats) => stats.count > 0);
  if (!valid.length) throw new Error("No statistics to merge.");
  const count = valid.reduce((total, stats) => total + stats.count, 0);
  const sum = [0, 0, 0];
  const sumSq = [0, 0, 0];
  const histograms = [new Float64Array(HISTOGRAM_BINS), new Float64Array(HISTOGRAM_BINS), new Float64Array(HISTOGRAM_BINS)];
  for (const stats of valid) {
    for (let c = 0; c < 3; c++) {
      sum[c] += stats.mean[c] * stats.count;
      sumSq[c] += (stats.std[c] * stats.std[c] + stats.mean[c] * stats.mean[c]) * stats.count;
      let previous = 0;
      for (let i = 0; i < HISTOGRAM_BINS; i++) {
        histograms[c][i] += (stats.cdf[c][i] - previous) * stats.count;
        previous = stats.cdf[c][i];
      }
    }
  }
  return statsFromAccumulators(histograms, sum, sumSq, count);
}

/**
 * Statistics of "typical neutral footage", used when the user has not loaded a
 * clip yet. A broad, neutral-grey distribution so the LUT mostly imposes the
 * reference's cast and contrast without assuming anything about the source.
 */
export function neutralLabStats(): LabStats {
  const pixels: number[] = [];
  // Even sampling of a mid-contrast, mildly saturated cube.
  for (let r = 0; r <= 8; r++) for (let g = 0; g <= 8; g++) for (let b = 0; b <= 8; b++) {
    const mix = (v: number) => Math.round(255 * (0.08 + 0.84 * (v / 8)));
    // Pull toward grey so chroma spread resembles real footage, not the full cube.
    const grey = (mix(r) + mix(g) + mix(b)) / 3;
    pixels.push(Math.round(grey + (mix(r) - grey) * 0.45), Math.round(grey + (mix(g) - grey) * 0.45), Math.round(grey + (mix(b) - grey) * 0.45), 255);
  }
  return measureLabStats(pixels);
}

// ---------------------------------------------------------------- transfer

/** Value in channel `c` at cumulative probability `p` (inverse CDF), bin-interpolated. */
function inverseCdf(cdf: Float64Array, p: number, channel: number) {
  const [lo, hi] = RANGES[channel];
  const width = (hi - lo) / HISTOGRAM_BINS;
  // First bin whose cumulative value reaches p.
  let low = 0, high = HISTOGRAM_BINS - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (cdf[mid] >= p) high = mid; else low = mid + 1;
  }
  const before = low > 0 ? cdf[low - 1] : 0;
  const span = cdf[low] - before;
  const within = span > 1e-12 ? (p - before) / span : 0.5;
  return lo + (low + clamp(within, 0, 1)) * width;
}

/** Cumulative probability of `value` in channel `c`, bin-interpolated. */
function cdfAt(cdf: Float64Array, value: number, channel: number) {
  const [lo, hi] = RANGES[channel];
  const position = clamp(((value - lo) / (hi - lo)) * HISTOGRAM_BINS, 0, HISTOGRAM_BINS);
  const bin = Math.min(HISTOGRAM_BINS - 1, Math.floor(position));
  const before = bin > 0 ? cdf[bin - 1] : 0;
  return before + (cdf[bin] - before) * (position - bin);
}

export type ColorTransfer = (r: number, g: number, b: number) => [number, number, number];

/**
 * Build the transfer that maps `source` footage onto the `reference` look.
 * Works on 0..1 sRGB triples and returns 0..1 sRGB. Intensity blends in LAB so
 * partial strengths stay perceptually even.
 */
export function buildColorTransfer(source: LabStats, reference: LabStats, options: TransferOptions = {}): ColorTransfer {
  const method = options.method ?? "balanced";
  const intensity = clamp(options.intensity ?? 1, 0, 1);
  const maxScale = Math.max(1, options.maxScale ?? 2.5);
  const scales = [0, 1, 2].map((c) => clamp(reference.std[c] / Math.max(1e-3, source.std[c]), 1 / maxScale, maxScale));
  const reinhard = (value: number, c: number) => (value - source.mean[c]) * scales[c] + reference.mean[c];
  const histogram = (value: number, c: number) => {
    // Clamp p away from the extremes so lone outliers can't map to the range ends.
    const p = clamp(cdfAt(source.cdf[c], value, c), 0.001, 0.999);
    return inverseCdf(reference.cdf[c], p, c);
  };
  const mapChannel = (value: number, c: number) => {
    if (method === "reinhard") return reinhard(value, c);
    if (method === "histogram") return histogram(value, c);
    return c === 0 ? histogram(value, c) : reinhard(value, c);
  };
  return (r, g, b) => {
    const lab = rgbToLab(r, g, b);
    const out: Lab = [0, 0, 0];
    for (let c = 0; c < 3; c++) out[c] = lab[c] + (mapChannel(lab[c], c) - lab[c]) * intensity;
    out[0] = clamp(out[0], 0, 100);
    return labToRgb(out[0], out[1], out[2]);
  };
}

// ---------------------------------------------------------------- LUT output

/** Bake a transfer into a 3D LUT table (.cube order: r fastest, then g, then b). */
export function bakeLut3d(transfer: ColorTransfer, size = 33): Float64Array {
  const n = Math.round(size);
  if (n < 2 || n > 65) throw new Error("LUT size must be between 2 and 65.");
  const table = new Float64Array(n * n * n * 3);
  let index = 0;
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const [or, og, ob] = transfer(r / (n - 1), g / (n - 1), b / (n - 1));
    table[index++] = or; table[index++] = og; table[index++] = ob;
  }
  return table;
}

/** Serialise a 3D LUT table as an Adobe/Resolve .cube file. */
export function serializeCubeLut(table: ArrayLike<number>, size: number, title = "ScenePilot Grade"): string {
  if (table.length !== size * size * size * 3) throw new Error("LUT table does not match its size.");
  const safeTitle = title.replace(/["\r\n]/g, "").slice(0, 120) || "ScenePilot Grade";
  const lines = [
    `TITLE "${safeTitle}"`,
    "# Created with ScenePilot Grade (alpha) — colour transfer from a reference still.",
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
  for (let i = 0; i < table.length; i += 3) {
    lines.push(`${clamp(table[i], 0, 1).toFixed(6)} ${clamp(table[i + 1], 0, 1).toFixed(6)} ${clamp(table[i + 2], 0, 1).toFixed(6)}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Pack a LUT table as RGBA8 voxels for a WebGL2 3D texture (same r-fastest order). */
export function lutToRgba8(table: ArrayLike<number>): Uint8Array {
  const voxels = table.length / 3;
  const out = new Uint8Array(voxels * 4);
  for (let i = 0; i < voxels; i++) {
    out[i * 4] = Math.round(clamp(table[i * 3], 0, 1) * 255);
    out[i * 4 + 1] = Math.round(clamp(table[i * 3 + 1], 0, 1) * 255);
    out[i * 4 + 2] = Math.round(clamp(table[i * 3 + 2], 0, 1) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------- palette

export type PaletteSwatch = { hex: string; share: number };

/**
 * The reference's dominant colours, for display: a coarse 3D histogram (4 bits
 * per channel) whose most populated cells are averaged and de-duplicated.
 */
export function dominantPalette(pixels: ArrayLike<number>, count = 5, step = 4): PaletteSwatch[] {
  const cells = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += Math.max(1, step) * 4) {
    if (pixels[i + 3] === 0) continue;
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
    const cell = cells.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cell.n += 1; cell.r += pixels[i]; cell.g += pixels[i + 1]; cell.b += pixels[i + 2];
    cells.set(key, cell);
    total += 1;
  }
  const picked: Array<{ r: number; g: number; b: number; n: number }> = [];
  for (const cell of [...cells.values()].sort((a, b) => b.n - a.n)) {
    const colour = { r: cell.r / cell.n, g: cell.g / cell.n, b: cell.b / cell.n, n: cell.n };
    const near = picked.find((p) => Math.hypot(p.r - colour.r, p.g - colour.g, p.b - colour.b) < 40);
    if (near) { near.n += colour.n; continue; }
    picked.push(colour);
    if (picked.length >= count * 3) break;
  }
  const hex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  return picked
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((p) => ({ hex: `#${hex(p.r)}${hex(p.g)}${hex(p.b)}`, share: total ? p.n / total : 0 }));
}
