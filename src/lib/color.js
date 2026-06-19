/* ---------------------------------------------------------------------------
   Color conversion helpers
--------------------------------------------------------------------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const t = (x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return "#" + t(r) + t(g) + t(b);
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
const hsvToHex = ({ h, s, v }) => {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
};
const hexToHsv = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
};
function rgbToCmyk(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}
function cmykToRgb(c, m, y, k) {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return {
    r: 255 * (1 - c) * (1 - k),
    g: 255 * (1 - m) * (1 - k),
    b: 255 * (1 - y) * (1 - k),
  };
}
function lerpHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}
function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}
// apply an alpha multiplier to a color that may be a hex or an existing rgba() (e.g. from a 'none' stop)
function withAlpha(col, a) {
  if (!col) return "rgba(0,0,0,0)";
  if (col[0] === "#") { const { r, g, b } = hexToRgb(col); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
  const m = col.match(/rgba?\(([^)]+)\)/);
  if (!m) return col;
  const p = m[1].split(",").map((s) => s.trim());
  const baseA = p[3] !== undefined ? parseFloat(p[3]) : 1;
  return `rgba(${p[0]},${p[1]},${p[2]},${baseA * a})`;
}
// --- fast pixel path: parse a color string once (cached) into [r,g,b,a255], blend straight-alpha source-over ---
const _colorCache = new Map();
function parseColorRGBA(str) {
  if (!str || str === "none") return null;
  const hit = _colorCache.get(str);
  if (hit !== undefined) return hit;
  let out = null;
  if (str.charCodeAt(0) === 35) { // '#rrggbb' or '#rgb'
    if (str.length === 7) out = [parseInt(str.slice(1, 3), 16), parseInt(str.slice(3, 5), 16), parseInt(str.slice(5, 7), 16), 255];
    else if (str.length === 4) out = [17 * parseInt(str[1], 16), 17 * parseInt(str[2], 16), 17 * parseInt(str[3], 16), 255];
  } else {
    const o = str.indexOf("("); // 'rgb(...)' / 'rgba(...)'
    if (o >= 0) {
      const e = str.indexOf(")", o);
      const parts = str.slice(o + 1, e < 0 ? str.length : e).split(",");
      if (parts.length >= 3) {
        const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
        out = [(parseInt(parts[0], 10) || 0), (parseInt(parts[1], 10) || 0), (parseInt(parts[2], 10) || 0), Math.round(clamp(isNaN(a) ? 1 : a, 0, 1) * 255)];
      }
    }
  }
  if (_colorCache.size > 8192) _colorCache.clear(); // keep bounded; same strings recur heavily so hit-rate stays high
  _colorCache.set(str, out);
  return out;
}
function blendPx(data, idx, sr, sg, sb, sa) {
  if (sa >= 255) { data[idx] = sr; data[idx + 1] = sg; data[idx + 2] = sb; data[idx + 3] = 255; return; }
  if (sa <= 0) return;
  const a = sa / 255, ia = 1 - a, da = data[idx + 3] / 255, oa = a + da * ia;
  if (oa <= 0) { data[idx + 3] = 0; return; }
  data[idx] = (sr * a + data[idx] * da * ia) / oa;       // Uint8ClampedArray rounds/clamps on store
  data[idx + 1] = (sg * a + data[idx + 1] * da * ia) / oa;
  data[idx + 2] = (sb * a + data[idx + 2] * da * ia) / oa;
  data[idx + 3] = oa * 255;
}
function makeImageData(w, h) {
  try { return new ImageData(w, h); }
  catch (_) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv.getContext("2d").createImageData(w, h); }
}

export { clamp, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hsvToHex, hexToHsv, rgbToCmyk, cmykToRgb, lerpHex, hexToRgba, withAlpha, parseColorRGBA, blendPx, makeImageData };
