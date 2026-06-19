import React, { useState, useRef, useEffect } from "react";

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

/* ---------------------------------------------------------------------------
   Sweep effect helpers (an animated, cyclic gradient that scrolls across a rect)
--------------------------------------------------------------------------- */
const SWEEP_DIRS = {
  E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1],
  SE: [1, 1], NW: [-1, -1], SW: [-1, 1], NE: [1, -1],
};
const RAINBOW = ["#ff0000", "#ffaa00", "#ffff00", "#00cc00", "#00bccc", "#0066ff", "#7a00ff", "#ff00aa"];

// cyclic gradient: stops wrap (…→last→first→…), so 2 colors read A→B→A→B
// mix two gradient stops; a stop may be "none" (transparent) → fade alpha toward the neighbour's hue
function mixStop(a, b, f) {
  const an = (a === "none" || a == null), bn = (b === "none" || b == null);
  if (an && bn) return "rgba(0,0,0,0)";
  if (an) { const c = hexToRgb(b); return `rgba(${c.r},${c.g},${c.b},${f})`; }
  if (bn) { const c = hexToRgb(a); return `rgba(${c.r},${c.g},${c.b},${1 - f})`; }
  return lerpHex(a, b, f);
}
function sampleCyclicGradient(colors, phase) {
  const n = colors.length;
  if (n === 0) return "rgba(0,0,0,0)";
  if (n === 1) return colors[0] === "none" ? "rgba(0,0,0,0)" : colors[0];
  const t = ((phase % 1) + 1) % 1; // wrap to [0,1)
  const scaled = t * n;            // [0, n)
  const i = Math.floor(scaled) % n;
  const f = scaled - Math.floor(scaled);
  return mixStop(colors[i], colors[(i + 1) % n], f);
}

// Render one frame of a sweep into a grid via setPixel(c, r, hex).
// sw: { rect:{c0,r0,c1,r1}, colors:[], dir, cycleFrames, bands }
function renderSweep(sw, frame, setPixel) {
  const rect = sw.rect;
  if (!rect || !sw.colors || sw.colors.length < 1) return;
  const x0 = Math.min(rect.c0, rect.c1), x1 = Math.max(rect.c0, rect.c1);
  const y0 = Math.min(rect.r0, rect.r1), y1 = Math.max(rect.r0, rect.r1);
  const v = SWEEP_DIRS[sw.dir] || SWEEP_DIRS.SE;
  const mag = Math.hypot(v[0], v[1]) || 1;
  const dx = v[0] / mag, dy = v[1] / mag;
  const projs = [x0 * dx + y0 * dy, x1 * dx + y0 * dy, x0 * dx + y1 * dy, x1 * dx + y1 * dy];
  const pmin = Math.min(...projs), pmax = Math.max(...projs);
  const extent = Math.max(1e-6, pmax - pmin);
  const cellsPerCycle = extent / Math.max(1, sw.bands || 1);
  const frameOffset = frame / Math.max(1, sw.cycleFrames || 12);
  if (sw.particles) {
    const px = -dy, py = dx;
    const perp = [x0 * px + y0 * py, x1 * px + y0 * py, x0 * px + y1 * py, x1 * px + y1 * py];
    const qmin = Math.min(...perp), qmax = Math.max(...perp);
    const N = particleCount(rect, sw.density);
    const period = Math.max(1, sw.cycleFrames || 12);
    for (let i = 0; i < N; i++) {
      const lane = qmin + hash2(sw.seed || 1, i) * (qmax - qmin);
      const start = hash2(sw.seed || 1, i + 1001);
      const along = pmin + ((((start + frame / period) % 1) + 1) % 1) * extent;
      const c = Math.round(along * dx + lane * px), r = Math.round(along * dy + lane * py);
      if (c >= x0 && c <= x1 && r >= y0 && r <= y1) setPixel(c, r, sampleCyclicGradient(sw.colors, (along - pmin) / cellsPerCycle));
    }
    return;
  }
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      const phase = (c * dx + r * dy - pmin) / cellsPerCycle - frameOffset; // travels toward +dir
      setPixel(c, r, sampleCyclicGradient(sw.colors, phase));
    }
  }
}

// Rotate: like sweep but the gradient is angular (conic) and spins over time.
// rt: { rect, colors, dir:'CW'|'CCW', cycleFrames, bands }
function renderRotate(rt, frame, setPixel) {
  const rect = rt.rect;
  if (!rect || !rt.colors || rt.colors.length < 1) return;
  const x0 = Math.min(rect.c0, rect.c1), x1 = Math.max(rect.c0, rect.c1);
  const y0 = Math.min(rect.r0, rect.r1), y1 = Math.max(rect.r0, rect.r1);
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  const bands = Math.max(1, rt.bands || 1);
  const sign = rt.dir === "CCW" ? -1 : 1;
  const frameOffset = (frame / Math.max(1, rt.cycleFrames || 16)) * sign;
  const TWO_PI = Math.PI * 2;
  if (rt.particles) {
    const rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
    const N = particleCount(rect, rt.density);
    const period = Math.max(1, rt.cycleFrames || 16);
    for (let i = 0; i < N; i++) {
      const rf = 0.15 + 0.85 * hash2(rt.seed || 1, i + 200);
      const base = hash2(rt.seed || 1, i) * TWO_PI;
      const ang = base + sign * TWO_PI * (frame / period);
      const c = Math.round(cx + Math.cos(ang) * rx * rf - 0.5), r = Math.round(cy + Math.sin(ang) * ry * rf - 0.5);
      if (c >= x0 && c <= x1 && r >= y0 && r <= y1) setPixel(c, r, sampleCyclicGradient(rt.colors, (base / TWO_PI) * bands));
    }
    return;
  }
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      const ang = Math.atan2((r + 0.5) - cy, (c + 0.5) - cx); // -π..π
      const t = ang / TWO_PI + 0.5; // 0..1 around the circle
      setPixel(c, r, sampleCyclicGradient(rt.colors, t * bands - frameOffset));
    }
  }
}

// Snake: a body of `length` segments follows an ordered `path`, advancing one
// path cell every `speed` frames. colors[i] is the color of segment i (0 = head;
// null = transparent). sn: { length, colors:[hex|null], speed, path:[{c,r}] }
function gcdInt(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
// snake head position + loop period, supporting speed < 1 (multiple cells per frame = faster than 1×)
function snakeHead(frame, L, S) {
  if (S >= 1) return Math.floor(frame / Math.max(1, Math.round(S))) % L;
  const step = Math.max(1, Math.round(1 / S));
  return (((frame * step) % L) + L) % L;
}
function snakePeriod(L, S) {
  if (!L) return 1;
  if (S >= 1) return L * Math.max(1, Math.round(S));
  const step = Math.max(1, Math.round(1 / S));
  return Math.max(1, Math.round(L / gcdInt(L, step)));
}
function renderSnake(sn, frame, setPixel) {
  const path = sn.path;
  if (!path || path.length === 0) return;
  const L = path.length;
  const N = Math.max(1, sn.length || 1);
  const S = sn.speed || 1;
  const headIdx = snakeHead(frame, L, S);
  const electric = !!sn.electric;
  const arcSize = Math.max(1, sn.arcSize || 3);
  let arc = 0, fp = 0;
  if (electric) {
    const P = snakePeriod(L, S);
    fp = ((frame % P) + P) % P;
    const nb = Math.max(1, sn.arcBursts || 3), bw = Math.max(1, Math.floor(P * 0.08)); // burst windows per loop
    for (let k = 0; k < nb; k++) {
      const center = Math.floor(hash2(sn.seed || 1, k + 4242) * P);
      let dd = Math.abs(fp - center); dd = Math.min(dd, P - dd); // wrap distance
      if (dd < bw) arc = Math.max(arc, 1 - dd / bw); // 0 normally, ramps to 1 mid-burst
    }
  }
  for (let i = N - 1; i >= 0; i--) { // tail → head so the head draws on top
    const col = sn.colors[i];
    if (col == null) continue; // transparent segment shows the underlying pixel
    const idx = ((headIdx - i) % L + L) % L;
    const cell = path[idx];
    if (electric && arc > 0) { // haywire: jagged perpendicular jitter that flickers each frame
      const a = path[((idx - 1) % L + L) % L], b2 = path[(idx + 1) % L];
      const tx = b2.c - a.c, ty = b2.r - a.r, plen = Math.hypot(tx, ty) || 1;
      const pxn = -ty / plen, pyn = tx / plen;
      const amp = arc * (1 + Math.floor(hash3(sn.seed || 1, i, fp) * arcSize));
      const sign = hash3(sn.seed || 1, i + 99, fp) < 0.5 ? -1 : 1;
      setPixel(Math.round(cell.c + pxn * amp * sign), Math.round(cell.r + pyn * amp * sign), col);
    } else {
      setPixel(cell.c, cell.r, col);
    }
  }
  if (electric && arc > 0.35) { // a lightning branch leaps off the head
    const ec = sn.electricColor || "#bfefff";
    const steps = 2 + Math.floor(arc * arcSize);
    let c = path[headIdx].c, r = path[headIdx].r, ang = hash2(sn.seed || 1, fp + 7) * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      ang += (hash3(sn.seed || 1, s + 1, fp) - 0.5) * 1.7; // wiggle for the jagged arc
      c += Math.round(Math.cos(ang)); r += Math.round(Math.sin(ang));
      setPixel(c, r, ec);
    }
  }
}

/* ---- deterministic helpers (random effects must loop seamlessly) ---- */
function hash01(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}
function hash2(a, b) { return hash01(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)); }
function hash3(a, b, c) { return hash01(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)); }

// non-cyclic gradient: t in [0,1] spans the stops without wrapping
function sampleGradientLinear(colors, t) {
  const n = colors.length;
  if (n === 0) return "rgba(0,0,0,0)";
  if (n === 1) return colors[0] === "none" ? "rgba(0,0,0,0)" : colors[0];
  const tt = Math.max(0, Math.min(1, t));
  const scaled = tt * (n - 1);
  const i = Math.min(n - 2, Math.floor(scaled));
  return mixStop(colors[i], colors[i + 1], scaled - i);
}

// heartbeat envelope over t in [0,1): snappy attack, then a springy rebound, short rest. e(0)=e(1)=0
function heartbeat(t) {
  if (t >= 0.86) return 0;                 // short rest
  const x = t / 0.86;                       // 0..1 active span
  if (x < 0.13) { const a = x / 0.13; return a * a * (3 - 2 * a); } // fast attack to 1
  const u = (x - 0.13) / 0.87;              // 0..1 settle
  const damp = Math.pow(1 - u, 1.25);
  return Math.max(0, damp * (0.5 + 0.5 * Math.cos(Math.PI * 3 * u))); // bounces: peak → dip → rebound → 0
}

// point-in-polygon (ray cast), pts = [[x,y],...] in any units matching (x,y)
function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const SHAPE_KINDS = [["rectangle", "Rectangle"], ["ellipse", "Ellipse / circle"], ["triangle", "Triangle"], ["diamond", "Diamond"], ["star", "Star"], ["heart", "Heart"]];
// returns a test fn(u,v)->bool, with u,v the cell-center normalized to [0,1] within the shape's bounding box
function shapeMaskTest(kind) {
  if (kind === "ellipse") return (u, v) => { const a = 2 * u - 1, b = 2 * v - 1; return a * a + b * b <= 1; };
  if (kind === "triangle") return (u, v) => Math.abs(u - 0.5) <= v * 0.5; // apex up, base at bottom
  if (kind === "diamond") return (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) <= 0.5;
  if (kind === "star") {
    const pts = [];
    for (let k = 0; k < 10; k++) { const R = (k % 2 === 0) ? 0.5 : 0.205; const a = -Math.PI / 2 + k * Math.PI / 5; pts.push([0.5 + R * Math.cos(a), 0.5 + R * Math.sin(a)]); }
    return (u, v) => pointInPoly(u, v, pts);
  }
  if (kind === "heart") return (u, v) => {
    const x = (u - 0.5) * 2.2, y = (0.5 - v) * 2.2 + 0.35; // center & scale into heart curve space
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  };
  return () => true; // rectangle
}

function rectBounds(rect) {
  return { x0: Math.min(rect.c0, rect.c1), x1: Math.max(rect.c0, rect.c1), y0: Math.min(rect.r0, rect.r1), y1: Math.max(rect.r0, rect.r1) };
}
function particleCount(rect, density) {
  const b = rectBounds(rect);
  const area = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
  return Math.max(1, Math.round((area * (density || 12)) / 100));
}

// Pulse: a radial gradient disc that throbs outward like a heartbeat (fast out, slow back, rest).
// p: { rect, colors, cycleFrames, bands, particles, density, seed }
function renderPulse(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2;
  const halfW = Math.max(0.5, (b.x1 + 1 - b.x0) / 2), halfH = Math.max(0.5, (b.y1 + 1 - b.y0) / 2);
  const period = Math.max(1, p.cycleFrames || 24);
  const beat = heartbeat((frame % period) / period);
  const scale = Math.max(0.04, 0.2 + 0.8 * beat); // floored — never disappears at rest
  if (p.particles) {
    const N = particleCount(rect, p.density);
    for (let i = 0; i < N; i++) {
      const ang = hash2(p.seed || 1, i) * Math.PI * 2;
      const rf = hash2(p.seed || 1, i + 9001);
      const c = Math.floor(cx + Math.cos(ang) * rf * scale * halfW), r = Math.floor(cy + Math.sin(ang) * rf * scale * halfH);
      if (c >= b.x0 && c <= b.x1 && r >= b.y0 && r <= b.y1) setPixel(c, r, sampleGradientLinear(p.colors, rf));
    }
    return;
  }
  for (let r = b.y0; r <= b.y1; r++) for (let c = b.x0; c <= b.x1; c++) {
    const nx = (c + 0.5 - cx) / halfW, ny = (r + 0.5 - cy) / halfH;
    const dd = Math.hypot(nx, ny); // 0 at center, 1 at the edge midpoints (ellipse), >1 in the corners
    if (dd <= scale) setPixel(c, r, sampleGradientLinear(p.colors, dd / scale));
  }
}

// Radiates: continuous radial flow away from ("out") or toward ("in") the center.
function renderRadiates(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2;
  const maxR = Math.max(1e-6, Math.hypot(Math.max(cx - b.x0, b.x1 + 1 - cx), Math.max(cy - b.y0, b.y1 + 1 - cy)));
  const period = Math.max(1, p.cycleFrames || 16);
  const bands = Math.max(1, p.bands || 1);
  if (p.particles) {
    const N = particleCount(rect, p.density);
    for (let i = 0; i < N; i++) {
      const ang = hash2(p.seed || 1, i) * Math.PI * 2;
      const start = hash2(p.seed || 1, i + 5003);
      const g = (((start + frame / period) % 1) + 1) % 1; // 0..1 progress
      const rr = p.dir === "in" ? 1 - g : g;
      const c = Math.floor(cx + Math.cos(ang) * rr * maxR), r = Math.floor(cy + Math.sin(ang) * rr * maxR);
      if (c >= b.x0 && c <= b.x1 && r >= b.y0 && r <= b.y1) setPixel(c, r, sampleCyclicGradient(p.colors, g * bands));
    }
    return;
  }
  const dirSign = p.dir === "in" ? -1 : 1;
  const frameOffset = (frame / period) * dirSign;
  for (let r = b.y0; r <= b.y1; r++) for (let c = b.x0; c <= b.x1; c++) {
    const d = Math.hypot(c + 0.5 - cx, r + 0.5 - cy);
    setPixel(c, r, sampleCyclicGradient(p.colors, (d / maxR) * bands - frameOffset));
  }
}

// Cascade: a waterfall — a directional (8-way) scrolling gradient, or falling streaks in particle mode.
function renderCascade(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const v = SWEEP_DIRS[p.dir] || SWEEP_DIRS.S;
  const mag = Math.hypot(v[0], v[1]) || 1;
  const dx = v[0] / mag, dy = v[1] / mag;
  const px = -dy, py = dx; // perpendicular
  const projs = [b.x0 * dx + b.y0 * dy, b.x1 * dx + b.y0 * dy, b.x0 * dx + b.y1 * dy, b.x1 * dx + b.y1 * dy];
  const pmin = Math.min(...projs), pmax = Math.max(...projs);
  const extent = Math.max(1e-6, pmax - pmin);
  const period = Math.max(1, p.cycleFrames || 14);
  const bands = Math.max(1, p.bands || 1);
  if (p.particles) {
    const N = particleCount(rect, p.density);
    const perp = [b.x0 * px + b.y0 * py, b.x1 * px + b.y0 * py, b.x0 * px + b.y1 * py, b.x1 * px + b.y1 * py];
    const qmin = Math.min(...perp), qmax = Math.max(...perp);
    for (let i = 0; i < N; i++) {
      const lane = qmin + hash2(p.seed || 1, i) * (qmax - qmin);
      const spd = 1 + Math.floor(hash2(p.seed || 1, i + 3001) * 3); // 1..3 full traversals/loop (integer → seamless)
      const len = 1 + Math.floor(hash2(p.seed || 1, i + 7001) * 3);
      const start = hash2(p.seed || 1, i + 1001);
      const along = pmin + ((((start + (frame / period) * spd) % 1) + 1) % 1) * extent;
      for (let s = 0; s < len; s++) {
        const ap = along - s;
        const c = Math.round(ap * dx + lane * px), r = Math.round(ap * dy + lane * py);
        if (c >= b.x0 && c <= b.x1 && r >= b.y0 && r <= b.y1) setPixel(c, r, sampleCyclicGradient(p.colors, ((ap - pmin) / extent) * bands));
      }
    }
    return;
  }
  const cellsPerCycle = extent / bands;
  const frameOffset = frame / period;
  for (let r = b.y0; r <= b.y1; r++) for (let c = b.x0; c <= b.x1; c++) {
    setPixel(c, r, sampleCyclicGradient(p.colors, (c * dx + r * dy - pmin) / cellsPerCycle - frameOffset));
  }
}

// Trace: streaming particles that leave a fading trail. Each particle walks the
// gradient on its OWN phase (spread) so colors stagger instead of moving in lockstep.
// Loops seamlessly: positions use integer traversals/loop, color uses integer cycles/loop.
// shared color pick for a trace cell — identical logic for rect and circle modes
function traceColor(colors, isRand, spaceGrad, bands, g, drift, t, jitter, randPhase, colorSpeed, trailGrad, headPhase, u, along) {
  if (isRand) return sampleCyclicGradient(colors, randPhase + (spaceGrad ? drift : colorSpeed) * t); // exact palette color
  if (spaceGrad) return bands === 1
    ? sampleGradientLinear(colors, clamp(g + drift * t + jitter, 0, 1)) // non-wrapping: clean first→last, no end-to-end bleed
    : sampleCyclicGradient(colors, g * bands + drift * t + jitter);      // multiple bands tile smoothly (wrap intended)
  return sampleCyclicGradient(colors, trailGrad ? headPhase - u * along : headPhase); // color follows the particle
}
function renderTrace(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const period = Math.max(1, p.cycleFrames || 24);
  const N = particleCount(rect, p.density);
  const t = frame / period;
  const trailLen = Math.max(1, Math.round(p.trailLen || 4));
  const fade = clamp(p.trailFade == null ? 0.85 : p.trailFade, 0, 1);
  const colorSpeed = Math.max(0, Math.round(p.colorSpeed == null ? 1 : p.colorSpeed)); // integer cycles/loop
  const spread = clamp(p.spread == null ? 1 : p.spread, 0, 1);
  const trailGrad = !!p.trailGrad;
  const along = clamp(p.gradAlong == null ? 0.5 : p.gradAlong, 0, 4); // gradient walk head→tail
  const spaceGrad = !!p.spaceGrad;                          // color follows position, not particle
  const bands = Math.max(1, Math.round(p.bands || 1));      // gradient cycles across the area
  const variation = clamp(p.variation == null ? 0.15 : p.variation, 0, 2); // per-particle early/late offset
  const drift = Math.max(0, Math.round(p.drift || 0));      // integer cycles/loop the fixed gradient scrolls
  const randomize = clamp(p.randomize == null ? 0 : p.randomize, 0, 1); // fraction given a shuffled palette color
  const horizon = !!p.horizon;
  const horizonPow = clamp(p.horizonPow == null ? 2.4 : p.horizonPow, 1, 6);
  const nc = Math.max(1, p.colors.length);
  const circle = p.shape === "circle";

  // geometry: rectangle flows along a direction; circle flows radially from a center
  let dx, dy, px, py, pmin, extent, qmin, qmax, cx, cy, maxR, dirOut;
  if (circle) {
    cx = (b.x0 + b.x1 + 1) / 2; cy = (b.y0 + b.y1 + 1) / 2;
    maxR = Math.max(1, Math.min(b.x1 + 1 - b.x0, b.y1 + 1 - b.y0) / 2); // inscribed circle
    dirOut = p.dir !== "in"; // "out" (default) or "in"
  } else {
    const v = SWEEP_DIRS[p.dir] || SWEEP_DIRS.E;
    const mag = Math.hypot(v[0], v[1]) || 1;
    dx = v[0] / mag; dy = v[1] / mag;
    px = -dy; py = dx; // lane (perpendicular) axis
    const projs = [b.x0 * dx + b.y0 * dy, b.x1 * dx + b.y0 * dy, b.x0 * dx + b.y1 * dy, b.x1 * dx + b.y1 * dy];
    pmin = Math.min(...projs); extent = Math.max(1e-6, Math.max(...projs) - pmin);
    const perp = [b.x0 * px + b.y0 * py, b.x1 * px + b.y0 * py, b.x0 * px + b.y1 * py, b.x1 * px + b.y1 * py];
    qmin = Math.min(...perp); qmax = Math.max(...perp);
  }

  for (let i = 0; i < N; i++) {
    const spd = 1 + Math.floor(hash2(p.seed || 1, i + 3001) * 3); // 1..3 full traversals/loop (integer → seamless)
    const start = hash2(p.seed || 1, i + 1001);
    let flow = ((((start + t * spd) % 1) + 1) % 1); // 0..1 progress along the flow
    if (horizon) flow = 1 - Math.pow(1 - flow, horizonPow); // ease: slows & piles up near the destination edge
    const phi = hash2(p.seed || 1, i + 5003);          // per-particle color phase
    const headPhase = phi * spread + t * colorSpeed;
    const jitter = (hash2(p.seed || 1, i + 7919) - 0.5) * variation * 0.35; // a touch early/late on the gradient
    const isRand = randomize > 0 && hash2(p.seed || 1, i + 2718) < randomize;
    const randPhase = Math.floor(hash2(p.seed || 1, i + 31415) * nc) / nc; // exact palette color (same colors, different order)

    if (circle) {
      const ang = hash2(p.seed || 1, i) * Math.PI * 2; // lane = angle
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const rfHead = dirOut ? flow : 1 - flow; // radius fraction 0(center)..1(rim)
      for (let s = 0; s < trailLen; s++) {
        const rfc = rfHead + (dirOut ? -1 : 1) * (s / maxR); // trail trails opposite the flow, 1 cell/step in radius
        if (rfc < 0 || rfc > 1.02) continue;
        const c = Math.floor(cx + ca * rfc * maxR), r = Math.floor(cy + sa * rfc * maxR);
        if (c < b.x0 || c > b.x1 || r < b.y0 || r > b.y1) continue;
        const u = trailLen > 1 ? s / (trailLen - 1) : 0;
        const alpha = 1 - fade * u; if (alpha <= 0.02) continue;
        const g = Math.min(1, Math.hypot(c + 0.5 - cx, r + 0.5 - cy) / maxR); // color anchored to this cell's radius
        setPixel(c, r, withAlpha(traceColor(p.colors, isRand, spaceGrad, bands, g, drift, t, jitter, randPhase, colorSpeed, trailGrad, headPhase, u, along), alpha));
      }
    } else {
      const lane = qmin + hash2(p.seed || 1, i) * (qmax - qmin);
      const head = pmin + flow * extent;
      for (let s = 0; s < trailLen; s++) {
        const ap = head - s; // tail trails opposite the flow
        const c = Math.round(ap * dx + lane * px), r = Math.round(ap * dy + lane * py);
        if (c < b.x0 || c > b.x1 || r < b.y0 || r > b.y1) continue;
        const u = trailLen > 1 ? s / (trailLen - 1) : 0;
        const alpha = 1 - fade * u; if (alpha <= 0.02) continue;
        const g = ((c * dx + r * dy) - pmin) / extent; // color anchored to this cell's position
        setPixel(c, r, withAlpha(traceColor(p.colors, isRand, spaceGrad, bands, g, drift, t, jitter, randPhase, colorSpeed, trailGrad, headPhase, u, along), alpha));
      }
    }
  }
}

// Glitters: each cell twinkles on its OWN staggered phase + frequency (loops over stepFrames*steps).
function renderGlitters(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const stepFrames = Math.max(1, p.cycleFrames || 4);
  const steps = Math.max(1, p.steps || 8);
  const period = stepFrames * steps;
  const prob = Math.min(1, Math.max(0, (p.density || 12) / 100));
  const sd = (p.seed || 1) * 131;
  for (let r = b.y0; r <= b.y1; r++) for (let c = b.x0; c <= b.x1; c++) {
    // per-cell phase offset and an integer rate → cells flip at different frames and different speeds,
    // yet everything still repeats exactly every `period` frames (steps*freq is a whole number of cycles)
    const off = Math.floor(hash2(c + sd, r) * period);
    const freq = 1 + Math.floor(hash2(c, r + 7777) * 3); // 1..3
    const bucket = Math.floor((frame * freq + off) / stepFrames) % steps;
    if (hash3(c + sd, r, bucket) < prob) {
      const ci = Math.floor(hash3(c, r, bucket + 777) * p.colors.length) % p.colors.length;
      setPixel(c, r, p.colors[ci]);
    }
  }
}

// Electron: each dot rides its OWN seeded ellipse (offset, size, tilt, direction) with irregular speed.
function renderElectron(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2;
  const halfW = Math.max(0.5, (b.x1 - b.x0 + 1) / 2 - 0.5), halfH = Math.max(0.5, (b.y1 - b.y0 + 1) / 2 - 0.5);
  const count = Math.max(1, p.count || 3);
  const period = Math.max(1, p.cycleFrames || 40);
  const TWO_PI = Math.PI * 2;
  const s = p.seed || 1, tt = (frame % period) / period;
  for (let i = 0; i < count; i++) {
    const ox = (hash2(s, i * 8 + 1) - 0.5) * 0.4 * halfW;       // distinct ellipse center
    const oy = (hash2(s, i * 8 + 2) - 0.5) * 0.4 * halfH;
    const ax = (0.4 + 0.55 * hash2(s, i * 8 + 3)) * halfW;       // distinct semi-axes
    const ay = (0.4 + 0.55 * hash2(s, i * 8 + 4)) * halfH;
    const rot = hash2(s, i * 8 + 5) * TWO_PI;                    // distinct tilt
    const phase = hash2(s, i * 8 + 6) * TWO_PI;                  // distinct starting angle
    const k = 1 + Math.floor(hash2(s, i * 8 + 7) * 3);          // wobble freq (integer → loops)
    const dir = hash2(s, i * 8 + 8) < 0.5 ? -1 : 1;             // some orbit each way
    const ang = phase + dir * TWO_PI * tt + (0.5 + 0.5 * hash2(s, i)) * Math.sin(TWO_PI * k * tt + phase); // irregular speed
    const ex = ax * Math.cos(ang), ey = ay * Math.sin(ang);
    const c = Math.round(cx + ox + ex * Math.cos(rot) - ey * Math.sin(rot) - 0.5);
    const r = Math.round(cy + oy + ex * Math.sin(rot) + ey * Math.cos(rot) - 0.5);
    if (c >= b.x0 && c <= b.x1 && r >= b.y0 && r <= b.y1) setPixel(c, r, p.colors[i % p.colors.length]);
  }
}

// Flies: `count` dots wander between seeded waypoints, switching heading at regular intervals (loops).
function renderFlies(p, frame, setPixel) {
  const rect = p.rect;
  if (!rect || !p.colors || p.colors.length < 1) return;
  const b = rectBounds(rect);
  const count = Math.max(1, p.count || 4);
  const period = Math.max(1, p.cycleFrames || 48);
  const K = Math.max(2, p.turns || 6);
  const tt = (frame % period) / period;
  const seg = tt * K;
  const si = Math.floor(seg), f = seg - si;
  const wp = (i, k) => {
    const kk = ((k % K) + K) % K; // wraps so waypoint K == waypoint 0 → closed loop
    return { x: b.x0 + hash3((p.seed || 1) + i, 0, kk) * (b.x1 - b.x0), y: b.y0 + hash3((p.seed || 1) + i, 555, kk) * (b.y1 - b.y0) };
  };
  for (let i = 0; i < count; i++) {
    const a = wp(i, si), z = wp(i, si + 1);
    const c = Math.round(a.x + (z.x - a.x) * f), r = Math.round(a.y + (z.y - a.y) * f);
    if (c >= b.x0 && c <= b.x1 && r >= b.y0 && r <= b.y1) setPixel(c, r, p.colors[i % p.colors.length]);
  }
}

/* Preset color palette (swatch) */
const PALETTE = [
  "#000000", "#404040", "#808080", "#c0c0c0", "#ffffff",
  "#7f0000", "#ff0000", "#ff7f00", "#ffbf00", "#ffff00",
  "#bfff00", "#00a300", "#00bfa0", "#00bfff", "#0066ff",
  "#0000ff", "#7f00ff", "#ff00ff", "#ff007f", "#a0522d",
];

/* ---------------------------------------------------------------------------
   GIF89a encoder (self-contained, no dependencies)
   - builds a palette from the frames (exact when <=256 colors, median-cut
     fallback for gradients), then GIF-variant LZW per frame.
   - supports per-frame delays, looping, and 1-bit transparency.
   This is fed by computeFrames(), the same source the live preview uses.
--------------------------------------------------------------------------- */
function gifMedianCut(colors, maxColors) {
  if (colors.length === 0) return [[0, 0, 0]];
  if (colors.length <= maxColors) return colors.slice();
  let boxes = [colors.slice()];
  while (boxes.length < maxColors) {
    let bestIdx = -1, bestRange = -1, bestCh = 0;
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      if (box.length < 2) continue;
      let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
      for (const p of box) {
        if (p[0] < rmin) rmin = p[0]; if (p[0] > rmax) rmax = p[0];
        if (p[1] < gmin) gmin = p[1]; if (p[1] > gmax) gmax = p[1];
        if (p[2] < bmin) bmin = p[2]; if (p[2] > bmax) bmax = p[2];
      }
      const rr = rmax - rmin, gr = gmax - gmin, br = bmax - bmin;
      const range = Math.max(rr, gr, br);
      if (range > bestRange) { bestRange = range; bestIdx = bi; bestCh = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2; }
    }
    if (bestIdx === -1) break;
    const box = boxes[bestIdx];
    box.sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(bestIdx, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
    const n = box.length || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function gifBuildPalette(frames) {
  const distinct = new Map();
  let hasTransparent = false;
  for (const f of frames) {
    const d = f.rgba;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { hasTransparent = true; continue; }
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (!distinct.has(key)) distinct.set(key, [d[i], d[i + 1], d[i + 2]]);
    }
  }
  const usable = 256 - (hasTransparent ? 1 : 0);
  let colors, exact;
  if (distinct.size <= usable) { colors = Array.from(distinct.values()); exact = true; }
  else { colors = gifMedianCut(Array.from(distinct.values()), usable); exact = false; }
  if (colors.length === 0) colors = [[0, 0, 0]];
  return { colors, exact, hasTransparent, transparentIndex: hasTransparent ? colors.length : -1 };
}

function gifMakeMapper(pal) {
  const { colors, exact } = pal;
  if (exact) {
    const m = new Map();
    for (let i = 0; i < colors.length; i++) m.set((colors[i][0] << 16) | (colors[i][1] << 8) | colors[i][2], i);
    return (r, g, b) => m.get((r << 16) | (g << 8) | b) || 0;
  }
  const cache = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestD) { bestD = dist; best = i; if (dist === 0) break; }
    }
    cache.set(key, best);
    return best;
  };
}

// GIF-variant LZW (ported from the omggif algorithm; code+symbol dictionary).
function gifLZW(minCodeSize, indices) {
  const out = [];
  let cur = 0, curShift = 0;
  let curCodeSize = minCodeSize + 1;
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const codeMask = clearCode - 1;
  let nextCode = eoiCode + 1;
  let table = new Map();
  const emit = (code) => {
    cur |= code << curShift;
    curShift += curCodeSize;
    while (curShift >= 8) { out.push(cur & 0xff); cur >>= 8; curShift -= 8; }
  };
  emit(clearCode);
  let ib = indices[0] & codeMask;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i] & codeMask;
    const key = (ib << 8) | k;
    if (table.has(key)) { ib = table.get(key); continue; }
    emit(ib);
    if (nextCode === 4096) {
      emit(clearCode);
      nextCode = eoiCode + 1;
      curCodeSize = minCodeSize + 1;
      table = new Map();
    } else {
      if (nextCode >= (1 << curCodeSize)) curCodeSize++;
      table.set(key, nextCode++);
    }
    ib = k;
  }
  emit(ib);
  emit(eoiCode);
  if (curShift > 0) out.push(cur & 0xff);
  return out;
}

// frames: [{ rgba: Uint8ClampedArray, delayMs }]; loop: 0 = forever
function encodeGIF(width, height, frames, loop) {
  const pal = gifBuildPalette(frames);
  const mapper = gifMakeMapper(pal);
  const P = pal.colors.length + (pal.hasTransparent ? 1 : 0);
  let k = 1;
  while ((1 << k) < P) k++;
  const tableSize = 1 << k;
  const sizeField = k - 1;
  const minCodeSize = Math.max(2, k);

  const out = [];
  const byte = (b) => out.push(b & 0xff);
  const u16 = (v) => { out.push(v & 0xff); out.push((v >> 8) & 0xff); };
  const str = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };

  str("GIF89a");
  u16(width); u16(height);
  byte(0x80 | 0x70 | (sizeField & 0x07)); // global color table, 8-bit color res
  byte(0); // background color index
  byte(0); // pixel aspect ratio
  for (let i = 0; i < tableSize; i++) {
    if (i < pal.colors.length) { byte(pal.colors[i][0]); byte(pal.colors[i][1]); byte(pal.colors[i][2]); }
    else { byte(0); byte(0); byte(0); }
  }

  // looping (NETSCAPE2.0)
  byte(0x21); byte(0xFF); byte(0x0B); str("NETSCAPE2.0");
  byte(0x03); byte(0x01); u16((loop || 0) & 0xffff); byte(0x00);

  const disposal = pal.hasTransparent ? 2 : 1;
  const tIndex = pal.hasTransparent ? pal.transparentIndex : 0;

  for (const f of frames) {
    const delay = Math.max(2, Math.round((f.delayMs || 100) / 10)); // centiseconds
    byte(0x21); byte(0xF9); byte(0x04);
    byte((disposal << 2) | (pal.hasTransparent ? 1 : 0));
    u16(delay);
    byte(tIndex & 0xff);
    byte(0x00);

    byte(0x2C); // image descriptor
    u16(0); u16(0); u16(width); u16(height);
    byte(0x00); // no local color table

    const d = f.rgba;
    const indices = new Uint8Array(width * height);
    for (let p = 0, q = 0; q < indices.length; p += 4, q++) {
      if (pal.hasTransparent && d[p + 3] < 128) indices[q] = pal.transparentIndex;
      else indices[q] = mapper(d[p], d[p + 1], d[p + 2]);
    }

    byte(minCodeSize);
    const lzw = gifLZW(minCodeSize, indices);
    let off = 0;
    while (off < lzw.length) {
      const n = Math.min(255, lzw.length - off);
      byte(n);
      for (let i = 0; i < n; i++) out.push(lzw[off + i]);
      off += n;
    }
    byte(0x00); // block terminator
  }

  byte(0x3B); // trailer
  return Uint8Array.from(out);
}

/* ---------------------------------------------------------------------------
   Component
--------------------------------------------------------------------------- */
export default function PixelArtStudio() {
  const ART_ID = 0;
  const LAYER_LABEL = { art: "Artwork", sweep: "Sweep", rotate: "Rotate", blink: "Blink", snake: "Snake", pulse: "Pulse", radiates: "Radiates", cascade: "Cascade", glitters: "Glitters", electron: "Electron", flies: "Flies", trace: "Trace" };
  const LAYER_ACCENT = { art: "#f59e0b", sweep: "#06b6d4", rotate: "#8b5cf6", blink: "#6366f1", snake: "#10b981", pulse: "#ef4444", radiates: "#f97316", cascade: "#0ea5e9", glitters: "#eab308", electron: "#14b8a6", flies: "#84cc16", trace: "#f43f5e" };
  const GRADIENT_TYPES = ["sweep", "rotate", "pulse", "radiates", "cascade"]; // share the gradient editor + particle toggle
  const EFFECT_TYPES = ["sweep", "rotate", "pulse", "radiates", "cascade", "trace", "glitters", "electron", "flies", "blink", "snake"];

  const [dims, setDims] = useState({ w: 32, h: 32 });
  const [inputW, setInputW] = useState("32");
  const [inputH, setInputH] = useState("32");

  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 }); // start black
  const currentColor = hsvToHex(hsv);

  const [paintTool, setPaintTool] = useState("brush"); // brush | gradient | pick | shape (artwork layer)
  const [shapeKind, setShapeKind] = useState("rectangle"); // rectangle | ellipse | triangle | diamond | star | heart
  const [shapeFill, setShapeFill] = useState("solid"); // solid | gradient
  const [gradStops, setGradStops] = useState(["#000000", "#ffffff"]); // gradient tool stops
  const [gradDir, setGradDir] = useState("E"); // gradient tool direction (8-way)

  const [hexField, setHexField] = useState("#000000");
  const [error, setError] = useState(null);
  const [eraseMode, setEraseMode] = useState(false); // "none" brush: paints transparency

  const [recent, setRecent] = useState([]); // color history (most recent first)
  const [customPalette, setCustomPalette] = useState([]); // user-saved colors
  const [savedPalettes, setSavedPalettes] = useState([]); // [{name, colors}] persisted across sessions
  const [activeSaved, setActiveSaved] = useState("");      // which saved palette is shown as a section
  const [paletteMenuOpen, setPaletteMenuOpen] = useState(false); // saved-palette dropdown
  const [designText, setDesignText] = useState("");        // import/export design code
  const [paletteName, setPaletteName] = useState("");      // inline name for saving a palette
  const [copiedDesign, setCopiedDesign] = useState(false); // transient "Copied!" feedback
  const [paletteDragOver, setPaletteDragOver] = useState(false);
  const [undoCount, setUndoCount] = useState(0);

  // unified layer stack: index 0 = back/bottom, last = front/top. Render bottom->top,
  // opaque-inset (the topmost layer with content at a pixel wins).
  const [layers, setLayers] = useState([{ id: ART_ID, type: "art", visible: true }]);
  const [selectedLayerId, setSelectedLayerId] = useState(ART_ID);
  const [dropTarget, setDropTarget] = useState(null); // { id, where: "above" | "below" } — insertion line

  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [frameInfo, setFrameInfo] = useState({ i: 0, n: 1 });
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef(null);
  const bufferRef = useRef(null); // offscreen 1px-per-cell artwork (source of truth) — points at the active art layer
  const buffersRef = useRef({});  // id -> offscreen canvas, one per art layer
  const containerRef = useRef(null);
  const dragRef = useRef({ active: false });
  const hoverRef = useRef(null);
  const historyRef = useRef([]);
  const pendingSnapRef = useRef(null);

  const playingRef = useRef(false);
  const rafRef = useRef(null);
  const framesRef = useRef(null);
  const frameIdxRef = useRef(0);
  const lastTsRef = useRef(null);
  const fpsRef = useRef(fps); fpsRef.current = fps;
  const checkerRef = useRef(null);

  const layersRef = useRef(layers); layersRef.current = layers;
  const selectedLayerIdRef = useRef(selectedLayerId); selectedLayerIdRef.current = selectedLayerId;
  const paintToolRef = useRef(paintTool); paintToolRef.current = paintTool;
  const idRef = useRef(1); // 0 reserved for the artwork layer
  const dragLayerIdRef = useRef(null); // layer being drag-reordered in the panel
  const dragSwatchRef = useRef(null); // { kind, i } for drag-reordering color/stop swatches

  const dimsRef = useRef(dims); dimsRef.current = dims;
  const colorRef = useRef(currentColor); colorRef.current = currentColor;
  const gradStopsRef = useRef(gradStops); gradStopsRef.current = gradStops;
  const gradDirRef = useRef(gradDir); gradDirRef.current = gradDir;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => { setHexField(currentColor); }, [currentColor]);

  /* ---------------- layer model ---------------- */
  function genId() { return idRef.current++; }
  function selectedLayer() { return layersRef.current.find((l) => l.id === selectedLayerIdRef.current) || null; }
  function artLayer() { return layersRef.current.find((l) => l.type === "art") || null; }
  function updateLayer(id, updater) { setLayers((arr) => arr.map((l) => (l.id === id ? updater(l) : l))); }
  function updateSelectedLayer(updater) { updateLayer(selectedLayerIdRef.current, updater); }
  function selectArtLayer() { const a = artLayer(); if (a) setSelectedLayerId(a.id); }
  function getArtBuffer(id) {
    const w = dimsRef.current.w, h = dimsRef.current.h;
    let c = buffersRef.current[id];
    if (!c || c.width !== w || c.height !== h) {
      c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d");
      buffersRef.current[id] = c;
    }
    return c;
  }
  function artLayerCount() { return layersRef.current.filter((l) => l.type === "art").length; }

  function defaultLayer(type) {
    const id = genId();
    const seed = Math.floor(Math.random() * 1e6) + 1;
    if (type === "sweep") return { id, type, visible: true, colors: ["#00bfff", "#ff00ff"], dir: "SE", cycleFrames: 12, bands: 1, particles: false, density: 12, seed, rect: null };
    if (type === "rotate") return { id, type, visible: true, colors: ["#00bfff", "#ff00ff"], dir: "CW", cycleFrames: 16, bands: 1, particles: false, density: 12, seed, rect: null };
    if (type === "pulse") return { id, type, visible: true, colors: ["#ff5555", "#330000"], cycleFrames: 24, bands: 1, particles: false, density: 14, seed, rect: null };
    if (type === "radiates") return { id, type, visible: true, colors: ["#ffdd00", "#ff3300"], dir: "out", cycleFrames: 16, bands: 2, particles: true, density: 14, seed, rect: null };
    if (type === "cascade") return { id, type, visible: true, colors: ["#00ccff", "#ffffff"], dir: "S", cycleFrames: 14, bands: 1, particles: true, density: 14, seed, rect: null };
    if (type === "glitters") return { id, type, visible: true, colors: ["#ffffff", "#ffe066", "#88ccff"], cycleFrames: 4, steps: 8, density: 14, seed, rect: null };
    if (type === "electron") return { id, type, visible: true, colors: ["#66ffff", "#ffffff"], cycleFrames: 40, count: 3, seed, rect: null };
    if (type === "flies") return { id, type, visible: true, colors: ["#aaffaa", "#ffffaa"], cycleFrames: 48, count: 30, turns: 6, seed, rect: null };
    if (type === "trace") return { id, type, visible: true, shape: "rect", colors: ["#3b2144", "#722c5a", "#9c3855", "#df6d56", "#fbb96d", "#ffcd75", "#53c567", "#2e946e", "#4d607a", "#849fb3"], dir: "E", cycleFrames: 28, density: 32, trailLen: 5, trailFade: 0.85, colorSpeed: 1, spread: 1, trailGrad: false, gradAlong: 0.5, spaceGrad: false, bands: 1, variation: 0.15, drift: 0, randomize: 0, horizon: false, horizonPow: 2.4, seed, rect: null };
    if (type === "blink") return { id, type, visible: true, cells: new Set(), sequence: [currentColor, null], stepFrames: 1 };
    if (type === "snake") return { id, type, visible: true, length: 4, colors: Array.from({ length: 4 }, () => currentColor), bodyStops: [currentColor, "#1e1b4b"], speed: 2, path: [], electric: false, electricColor: "#bfefff", arcBursts: 3, arcSize: 3, seed };
    return { id, type: "art", visible: true };
  }
  function addLayer(type) {
    const layer = defaultLayer(type);
    setLayers((arr) => {
      const idx = arr.findIndex((l) => l.id === selectedLayerIdRef.current);
      const at = idx < 0 ? arr.length : idx + 1; // insert above the selected layer
      const next = arr.slice();
      next.splice(at, 0, layer);
      return next;
    });
    setSelectedLayerId(layer.id);
  }
  function deleteLayer(id) {
    const arr = layersRef.current;
    const target = arr.find((l) => l.id === id);
    if (!target) return;
    if (target.type === "art" && artLayerCount() <= 1) return; // keep at least one artwork
    const idx = arr.findIndex((l) => l.id === id);
    const next = arr.filter((l) => l.id !== id);
    if (target.type === "art") delete buffersRef.current[id];
    setLayers(next);
    if (selectedLayerIdRef.current === id) {
      const fallback = next[Math.max(0, idx - 1)] || next[0];
      setSelectedLayerId(fallback ? fallback.id : (next[0] && next[0].id));
    }
    drawCanvas();
  }
  function canMergeDown(l) {
    if (!l || l.type !== "art") return false;
    const arr = layersRef.current;
    const i = arr.findIndex((x) => x.id === l.id);
    return i > 0 && arr[i - 1].type === "art"; // both this and the one below are artwork
  }
  function mergeDown(id) {
    const arr = layersRef.current;
    const i = arr.findIndex((x) => x.id === id);
    if (i <= 0 || arr[i].type !== "art" || arr[i - 1].type !== "art") return;
    const below = arr[i - 1];
    try {
      const bBuf = getArtBuffer(below.id), tBuf = getArtBuffer(id);
      bBuf.getContext("2d").drawImage(tBuf, 0, 0); // paint the upper artwork onto the lower
    } catch (_) {}
    delete buffersRef.current[id];
    setLayers(arr.filter((x) => x.id !== id));
    setSelectedLayerId(below.id);
    historyRef.current = []; setUndoCount(0); // merge isn't part of the paint-undo stack
    drawCanvas();
  }
  function cloneLayer(l) {
    const c = { ...l, id: genId() };
    if (l.colors) c.colors = l.colors.slice();
    if (l.sequence) c.sequence = l.sequence.slice();
    if (l.bodyStops) c.bodyStops = l.bodyStops.slice();
    if (l.path) c.path = l.path.map((p) => ({ ...p }));
    if (l.cells) c.cells = new Set(l.cells);
    if (l.rect) c.rect = { ...l.rect };
    return c;
  }
  function duplicateLayer(id) {
    const arr = layersRef.current;
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const copy = cloneLayer(arr[idx]);
    if (arr[idx].type === "art") { try { getArtBuffer(copy.id).getContext("2d").drawImage(getArtBuffer(id), 0, 0); } catch (_) {} }
    const next = arr.slice(); next.splice(idx + 1, 0, copy); // directly above the original
    setLayers(next);
    setSelectedLayerId(copy.id);
    drawCanvas();
  }
  function arrMove(a, from, to) { const x = a.slice(); const [m] = x.splice(from, 1); x.splice(to, 0, m); return x; }
  function toggleLayerVisible(id) { updateLayer(id, (l) => ({ ...l, visible: !l.visible })); }
  function moveLayer(id, delta) { // delta +1 = toward front (up in panel), -1 = toward back
    setLayers((arr) => {
      const i = arr.findIndex((l) => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const next = arr.slice();
      const [m] = next.splice(i, 1);
      next.splice(j, 0, m);
      return next;
    });
  }
  function dropOnLayer(targetId, where) {
    const draggedId = dragLayerIdRef.current;
    if (draggedId == null) return;
    setLayers((arr) => {
      let vis = [...arr].reverse().map((l) => l.id); // panel order: front -> back
      vis = vis.filter((id) => id !== draggedId);
      const t = vis.indexOf(targetId);
      if (t < 0) return arr; // dropped on itself
      vis.splice(where === "below" ? t + 1 : t, 0, draggedId);
      const byId = {}; arr.forEach((l) => { byId[l.id] = l; });
      return vis.map((id) => byId[id]).reverse();
    });
  }
  function isRectEffect(type) { return GRADIENT_TYPES.indexOf(type) >= 0 || type === "glitters" || type === "electron" || type === "flies" || type === "trace"; }
  function layerColorHint(l) {
    if (l.type === "blink") return l.sequence.find((s) => s != null) || null;
    if (l.type === "snake") return l.colors.find((c) => c != null) || null;
    if (l.type === "art") return null; // artwork has no single color
    return (l.colors && l.colors.find((c) => c != null)) || null; // all effects expose a color list
  }

  /* ---------------- rendering ---------------- */
  function getChecker() {
    if (checkerRef.current) return checkerRef.current;
    const t = document.createElement("canvas");
    t.width = 16; t.height = 16;
    const tc = t.getContext("2d");
    tc.fillStyle = "#ffffff"; tc.fillRect(0, 0, 16, 16);
    tc.fillStyle = "#d6d6d6"; tc.fillRect(0, 0, 8, 8); tc.fillRect(8, 8, 8, 8);
    checkerRef.current = t;
    return t;
  }
  const scratchRef = useRef(null);
  function getScratch(w, h) {
    let s = scratchRef.current;
    if (!s || s.w !== w || s.h !== h) { const imageData = makeImageData(w, h); s = { w, h, imageData, data: imageData.data }; scratchRef.current = s; }
    return s;
  }
  function blendLayerInto(s, layer, frame, artData) {
    if (!layer.visible) return;
    const data = s.data, w = s.w, h = s.h;
    if (layer.type === "art") {
      let src = artData && artData[layer.id];
      if (!src) { try { src = getArtBuffer(layer.id).getContext("2d").getImageData(0, 0, w, h).data; } catch (_) { return; } }
      for (let i = 0; i < data.length; i += 4) { const sa = src[i + 3]; if (sa) blendPx(data, i, src[i], src[i + 1], src[i + 2], sa); }
      return;
    }
    if (layer.type === "blink") {
      if (layer.cells.size && layer.sequence.length) {
        const sf = Math.max(1, layer.stepFrames || 1);
        const step = layer.sequence[Math.floor(frame / sf) % layer.sequence.length];
        const px = parseColorRGBA(step);
        if (px) for (const key of layer.cells) { const ci = key.indexOf(","); const c = +key.slice(0, ci), r = +key.slice(ci + 1); if (c >= 0 && c < w && r >= 0 && r < h) blendPx(data, (r * w + c) * 4, px[0], px[1], px[2], px[3]); }
      }
      return;
    }
    // particle / gradient effects share one bounds-checked, cached-parse blend sink
    const set = (c, r, color) => {
      if (c < 0 || c >= w || r < 0 || r >= h) return;
      const px = parseColorRGBA(color); if (!px) return;
      blendPx(data, (r * w + c) * 4, px[0], px[1], px[2], px[3]);
    };
    if (!layer.colors || !layer.colors.length) { if (layer.type !== "snake") return; }
    switch (layer.type) {
      case "sweep": if (layer.rect) renderSweep(layer, frame, set); break;
      case "rotate": if (layer.rect) renderRotate(layer, frame, set); break;
      case "pulse": if (layer.rect) renderPulse(layer, frame, set); break;
      case "radiates": if (layer.rect) renderRadiates(layer, frame, set); break;
      case "cascade": if (layer.rect) renderCascade(layer, frame, set); break;
      case "trace": if (layer.rect) renderTrace(layer, frame, set); break;
      case "glitters": if (layer.rect) renderGlitters(layer, frame, set); break;
      case "electron": if (layer.rect) renderElectron(layer, frame, set); break;
      case "flies": if (layer.rect) renderFlies(layer, frame, set); break;
      case "snake": if (layer.path && layer.path.length && layer.colors && layer.colors.length) renderSnake(layer, frame, set); break;
      default: break;
    }
  }
  function compositeFrameCanvas(frame, list, artData) {
    const buf = bufferRef.current;
    const w = buf.width, h = buf.height;
    const s = getScratch(w, h);
    s.data.fill(0); // reset to transparent (buffer reused across frames)
    for (const layer of list) blendLayerInto(s, layer, frame, artData);
    const fc = document.createElement("canvas");
    fc.width = w; fc.height = h;
    fc.getContext("2d").putImageData(s.imageData, 0, 0); // single write replaces thousands of fillRects
    return fc;
  }
  function previewLayers() {
    const d = dragRef.current;
    const arr = layersRef.current;
    if (!d.active || d.layerId == null) return arr;
    return arr.map((l) => {
      if (l.id !== d.layerId) return l;
      if (isRectEffect(l.type) && d.kind === "rect")
        return { ...l, rect: { c0: d.start.c, r0: d.start.r, c1: d.last.c, r1: d.last.r } };
      if (l.type === "snake" && d.kind === "path") return { ...l, path: d.cells };
      return l;
    });
  }

  function drawCanvas() {
    const canvas = canvasRef.current, buf = bufferRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext("2d");
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    const playing = playingRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cssW, cssH);

    const pat = ctx.createPattern(getChecker(), "repeat");
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, cssW, cssH); }

    const W = dimsRef.current.w, H = dimsRef.current.h;
    const cw = cssW / W, ch = cssH / H;
    const d = dragRef.current;

    let srcCanvas;
    if (playing && framesRef.current && framesRef.current.length) srcCanvas = framesRef.current[frameIdxRef.current].canvas;
    else srcCanvas = compositeFrameCanvas(0, previewLayers());
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, cssW, cssH);

    if (playing) return;

    if (cw >= 8 && ch >= 8) {
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= W; i++) { const x = Math.round(i * cw) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, cssH); }
      for (let j = 0; j <= H; j++) { const y = Math.round(j * ch) + 0.5; ctx.moveTo(0, y); ctx.lineTo(cssW, y); }
      ctx.stroke();
    }

    const pv = previewLayers();
    const selId = selectedLayerIdRef.current;
    const selL = pv.find((l) => l.id === selId);

    for (const l of pv) {
      if (!l.visible) continue;
      if (isRectEffect(l.type) && l.rect) {
        const isSel = l.id === selId;
        const r = l.rect;
        const x0 = Math.min(r.c0, r.c1), x1 = Math.max(r.c0, r.c1);
        const y0 = Math.min(r.r0, r.r1), y1 = Math.max(r.r0, r.r1);
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isSel ? "rgba(79,70,229,0.95)" : "rgba(100,116,139,0.45)";
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.strokeRect(x0 * cw + 1, y0 * ch + 1, (x1 - x0 + 1) * cw - 2, (y1 - y0 + 1) * ch - 2);
        ctx.restore();
      }
    }

    if (selL && selL.type === "snake" && selL.path && selL.path.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(79,70,229,0.5)";
      ctx.lineWidth = 1;
      for (const cell of selL.path) ctx.strokeRect(cell.c * cw + 0.5, cell.r * ch + 0.5, cw - 1, ch - 1);
      const head = selL.path[0];
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = "rgba(79,70,229,0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(head.c * cw + 1, head.r * ch + 1, cw - 2, ch - 2);
      ctx.restore();
    }

    if (selL && selL.type === "blink" && selL.cells.size) {
      const tiny = cw < 5 || ch < 5;
      for (const key of selL.cells) {
        const ci = key.indexOf(","); const c = +key.slice(0, ci), r = +key.slice(ci + 1);
        const x = c * cw, y = r * ch;
        if (tiny) { ctx.fillStyle = "rgba(99,102,241,0.6)"; ctx.fillRect(x, y, cw, ch); }
        else {
          ctx.strokeStyle = "rgba(79,70,229,0.95)"; ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
          ctx.fillStyle = "rgba(79,70,229,0.95)";
          const m = Math.min(6, cw, ch);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + m, y); ctx.lineTo(x, y + m); ctx.closePath(); ctx.fill();
        }
      }
    }

    if (selL && selL.type === "art" && d.active && (d.kind === "paint-rect" || d.kind === "paint-grad")) {
      const x0 = Math.min(d.start.c, d.last.c), x1 = Math.max(d.start.c, d.last.c);
      const y0 = Math.min(d.start.r, d.last.r), y1 = Math.max(d.start.r, d.last.r);
      const px = x0 * cw, py = y0 * ch, pw = (x1 - x0 + 1) * cw, ph = (y1 - y0 + 1) * ch;
      if (d.kind === "paint-rect" && d.erase) {
        ctx.save(); ctx.setLineDash([3, 2]); ctx.strokeStyle = "rgba(239,68,68,0.9)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5); ctx.restore();
      } else {
        if (d.kind === "paint-rect") { ctx.fillStyle = hexToRgba(colorRef.current, 0.5); ctx.fillRect(px, py, pw, ph); }
        else {
          const stops = gradStopsRef.current && gradStopsRef.current.length >= 2 ? gradStopsRef.current : ["#000000", "#ffffff"];
          const v = SWEEP_DIRS[gradDirRef.current] || SWEEP_DIRS.E;
          const mag = Math.hypot(v[0], v[1]) || 1;
          const ux = v[0] / mag, uy = v[1] / mag;
          const corners = [[x0, y0], [x1 + 1, y0], [x0, y1 + 1], [x1 + 1, y1 + 1]];
          let lo = corners[0], hi = corners[0], lp = Infinity, hp = -Infinity;
          for (const cn of corners) { const pr = cn[0] * ux + cn[1] * uy; if (pr < lp) { lp = pr; lo = cn; } if (pr > hp) { hp = pr; hi = cn; } }
          const grad = ctx.createLinearGradient(lo[0] * cw, lo[1] * ch, hi[0] * cw, hi[1] * ch);
          for (let i = 0; i < stops.length; i++) grad.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, stops[i] === "none" ? "rgba(0,0,0,0)" : stops[i]);
          ctx.fillStyle = grad; ctx.fillRect(px, py, pw, ph);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }
    }

    if (selL && selL.type === "art" && d.active && d.kind === "shape") {
      const x0 = Math.min(d.start.c, d.last.c), x1 = Math.max(d.start.c, d.last.c);
      const y0 = Math.min(d.start.r, d.last.r), y1 = Math.max(d.start.r, d.last.r);
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const px = x0 * cw, py = y0 * ch, pw = w * cw, ph = h * ch;
      const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext("2d");
      const useGrad = d.fill === "gradient" && gradStopsRef.current && gradStopsRef.current.length >= 2;
      const erasing = d.erase && !useGrad;
      const proj = useGrad ? gradProjector(x0, y0, x1, y1, gradDirRef.current) : null;
      forEachShapeCell(d.shape, x0, y0, x1, y1, (x, y) => { tctx.fillStyle = useGrad ? sampleGradientLinear(gradStopsRef.current, proj(x, y)) : (erasing ? "#ffffff" : colorRef.current); tctx.fillRect(x - x0, y - y0, 1, 1); });
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (erasing) {
        ctx.globalAlpha = 0.25; ctx.drawImage(tmp, px, py, pw, ph); ctx.globalAlpha = 1;
        ctx.setLineDash([3, 2]); ctx.strokeStyle = "rgba(239,68,68,0.9)"; ctx.lineWidth = 1.5; ctx.strokeRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5);
      } else {
        ctx.globalAlpha = 0.6; ctx.drawImage(tmp, px, py, pw, ph); ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }
      ctx.restore();
    }

    const hv = hoverRef.current;
    if (selL && selL.type === "art" && hv && !d.active) {
      ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1;
      ctx.strokeRect(hv.c * cw + 0.5, hv.r * ch + 0.5, cw - 1, ch - 1);
    }
  }

  function resizeAndDraw() {
    const container = containerRef.current, canvas = canvasRef.current;
    if (!container || !canvas) return;
    const W = dimsRef.current.w, H = dimsRef.current.h;
    const maxW = container.clientWidth || 320;
    const maxH = Math.min((typeof window !== "undefined" ? window.innerHeight : 800) * 0.7, 600);
    const cell = Math.min(maxW / W, maxH / H);
    const cssW = Math.max(1, Math.floor(cell * W));
    const cssH = Math.max(1, Math.floor(cell * H));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    drawCanvas();
  }

  useEffect(() => {
    try {
      buffersRef.current = {}; // resize is lossy → fresh transparent buffers for every art layer
      for (const l of layersRef.current) if (l.type === "art") getArtBuffer(l.id);
      const s = layersRef.current.find((l) => l.id === selectedLayerIdRef.current);
      const target = (s && s.type === "art") ? s : layersRef.current.find((l) => l.type === "art");
      if (target) bufferRef.current = getArtBuffer(target.id);
      else { const sc = document.createElement("canvas"); sc.width = dims.w; sc.height = dims.h; bufferRef.current = sc; }
    } catch (e) {
      setError("That size is too large for the browser to render.");
    }
    resizeAndDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  useEffect(() => {
    const s = layersRef.current.find((l) => l.id === selectedLayerId);
    if (s && s.type === "art") bufferRef.current = getArtBuffer(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => resizeAndDraw());
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undoRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!playingRef.current) setFrameInfo({ i: 0, n: Math.min(600, animationFrameCount(layers)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  useEffect(() => {
    if (!playingRef.current) drawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, selectedLayerId]);

  /* ---------------- buffer painting ---------------- */
  function paintCell(c, r, color) {
    const buf = bufferRef.current;
    if (!buf) return;
    if (c < 0 || r < 0 || c >= buf.width || r >= buf.height) return;
    const ctx = buf.getContext("2d");
    if (color === null) { ctx.clearRect(c, r, 1, 1); return; }
    ctx.fillStyle = color;
    ctx.fillRect(c, r, 1, 1);
  }
  function paintLine(c0, r0, c1, r1, color) {
    const dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0);
    const sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1;
    let err = dx - dy, x = c0, y = r0;
    while (true) {
      paintCell(x, y, color);
      if (x === c1 && y === r1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  function fillRect(c0, r0, c1, r1, color) {
    const x0 = Math.min(c0, c1), x1 = Math.max(c0, c1);
    const y0 = Math.min(r0, r1), y1 = Math.max(r0, r1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) paintCell(x, y, color);
  }
  function applyGradient(c0, r0, c1, r1, stops, dir) {
    const x0 = Math.min(c0, c1), x1 = Math.max(c0, c1);
    const y0 = Math.min(r0, r1), y1 = Math.max(r0, r1);
    const v = SWEEP_DIRS[dir] || SWEEP_DIRS.E;
    const mag = Math.hypot(v[0], v[1]) || 1;
    const dx = v[0] / mag, dy = v[1] / mag;
    const projs = [x0 * dx + y0 * dy, x1 * dx + y0 * dy, x0 * dx + y1 * dy, x1 * dx + y1 * dy];
    const pmin = Math.min(...projs), pmax = Math.max(...projs);
    const extent = Math.max(1e-6, pmax - pmin);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        paintCell(x, y, sampleGradientLinear(stops, (x * dx + y * dy - pmin) / extent));
      }
    }
  }
  function gradProjector(c0, r0, c1, r1, dir) {
    const x0 = Math.min(c0, c1), x1 = Math.max(c0, c1), y0 = Math.min(r0, r1), y1 = Math.max(r0, r1);
    const v = SWEEP_DIRS[dir] || SWEEP_DIRS.E;
    const mag = Math.hypot(v[0], v[1]) || 1, dx = v[0] / mag, dy = v[1] / mag;
    const projs = [x0 * dx + y0 * dy, x1 * dx + y0 * dy, x0 * dx + y1 * dy, x1 * dx + y1 * dy];
    const pmin = Math.min(...projs), pmax = Math.max(...projs), extent = Math.max(1e-6, pmax - pmin);
    return (x, y) => (x * dx + y * dy - pmin) / extent;
  }
  function forEachShapeCell(kind, c0, r0, c1, r1, cb) {
    const x0 = Math.min(c0, c1), x1 = Math.max(c0, c1), y0 = Math.min(r0, r1), y1 = Math.max(r0, r1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, test = shapeMaskTest(kind);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const u = (x - x0 + 0.5) / w, vv = (y - y0 + 0.5) / h; if (test(u, vv)) cb(x, y); }
  }

  /* ---------------- history ---------------- */
  function takeSnapshot() {
    const buf = bufferRef.current;
    if (!buf) return null;
    try {
      const clone = document.createElement("canvas");
      clone.width = buf.width; clone.height = buf.height;
      clone.getContext("2d").drawImage(buf, 0, 0);
      return { id: selectedLayerIdRef.current, w: buf.width, h: buf.height, canvas: clone };
    } catch (_) { return null; }
  }
  function commitSnapshot(snap) {
    if (!snap) return;
    const stack = historyRef.current;
    stack.push(snap);
    if (stack.length > 30) stack.shift();
    setUndoCount(stack.length);
  }
  function undo() {
    const stack = historyRef.current;
    if (stack.length === 0) return;
    const snap = stack.pop();
    setUndoCount(stack.length);
    const nb = document.createElement("canvas");
    nb.width = snap.w; nb.height = snap.h;
    nb.getContext("2d").drawImage(snap.canvas, 0, 0);
    if (snap.id != null) buffersRef.current[snap.id] = nb;
    if (snap.id === selectedLayerIdRef.current) bufferRef.current = nb;
    if (snap.w !== dimsRef.current.w || snap.h !== dimsRef.current.h) {
      setInputW(String(snap.w)); setInputH(String(snap.h)); setDims({ w: snap.w, h: snap.h });
    } else { drawCanvas(); }
  }
  const undoRef = useRef(() => {});
  undoRef.current = undo;

  function rememberColor(hex) {
    setRecent((prev) => { const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())]; return next.slice(0, 12); });
  }
  function addCustomColor(hex) {
    if (!hex) return;
    setCustomPalette((prev) => (prev.some((c) => c.toLowerCase() === hex.toLowerCase()) ? prev : [...prev, hex].slice(0, 32)));
  }
  function removeCustomColor(i) { setCustomPalette((prev) => prev.filter((_, j) => j !== i)); }
  function persistPalettes(list) {
    setSavedPalettes(list);
    try { if (typeof window !== "undefined" && window.storage) window.storage.set("palettes:list", JSON.stringify(list)); } catch (_) {}
  }
  function saveCustomPalette(rawName) {
    const name = (rawName || "").trim();
    if (!name || !customPalette.length) return;
    persistPalettes(savedPalettes.filter((p) => p.name !== name).concat([{ name, colors: customPalette.slice() }]));
    setActiveSaved(name);
    setPaletteName("");
  }
  function deleteSavedPalette(name) {
    persistPalettes(savedPalettes.filter((p) => p.name !== name));
    if (activeSaved === name) setActiveSaved("");
  }
  // ---- design export / import: every parameter in a fixed key order so it round-trips identically ----
  const DESIGN_KEYS = ["id", "type", "visible", "shape", "colors", "dir", "cycleFrames", "bands", "particles", "density", "count", "turns", "steps", "length", "speed", "path", "sequence", "cells", "bodyStops", "rect", "seed", "trailLen", "trailFade", "colorSpeed", "spread", "trailGrad", "gradAlong", "spaceGrad", "variation", "drift", "randomize", "horizon", "horizonPow", "electric", "electricColor", "arcBursts", "arcSize"];
  function serializeDesign() {
    const layersOut = layersRef.current.map((l) => {
      const o = {};
      DESIGN_KEYS.forEach((k) => { if (l[k] !== undefined) o[k] = (l[k] instanceof Set ? Array.from(l[k]) : l[k]); });
      return o;
    });
    const art = {};
    for (const l of layersRef.current) if (l.type === "art") { try { art[l.id] = getArtBuffer(l.id).toDataURL("image/png"); } catch (_) {} }
    const obj = { v: 1, w: dimsRef.current.w, h: dimsRef.current.h, fps, customPalette, layers: layersOut, art };
    const json = JSON.stringify(obj);
    try { return btoa(unescape(encodeURIComponent(json))); } catch (_) { return json; }
  }
  function copyDesign() {
    const s = serializeDesign();
    setDesignText(s);
    let done = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s); done = true; } } catch (_) {}
    if (!done) { try { const ta = document.createElement("textarea"); ta.value = s; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (_) {} }
    setCopiedDesign(true); setTimeout(() => setCopiedDesign(false), 1200);
  }
  function applyDesign(str) {
    if (!str || !str.trim()) return false;
    let obj = null;
    try { obj = JSON.parse(decodeURIComponent(escape(atob(str.trim())))); } catch (_) { try { obj = JSON.parse(str); } catch (e) { return false; } }
    if (!obj || !Array.isArray(obj.layers) || !obj.layers.length) return false;
    const layers2 = obj.layers.map((l) => { const c = { ...l }; if (c.type === "blink" && Array.isArray(c.cells)) c.cells = new Set(c.cells); return c; });
    buffersRef.current = {};
    setCustomPalette(Array.isArray(obj.customPalette) ? obj.customPalette.slice(0, 32) : []);
    if (obj.fps) setFps(clamp(obj.fps, 1, 60));
    const w = clamp(obj.w || 32, 1, 4096), h = clamp(obj.h || 32, 1, 4096);
    setInputW(String(w)); setInputH(String(h));
    setLayers(layers2);
    const firstArt = layers2.find((l) => l.type === "art");
    setSelectedLayerId(firstArt ? firstArt.id : (layers2[0] && layers2[0].id));
    historyRef.current = []; setUndoCount(0);
    idRef.current = Math.max(idRef.current, layers2.reduce((m, l) => Math.max(m, typeof l.id === "number" ? l.id : 0), 0) + 1);
    setDims({ w, h });
    const art = obj.art || {};
    setTimeout(() => {
      Object.keys(art).forEach((id) => {
        const img = new Image();
        img.onload = () => { try { const buf = getArtBuffer(Number(id)); const cx = buf.getContext("2d"); cx.clearRect(0, 0, buf.width, buf.height); cx.drawImage(img, 0, 0); drawCanvas(); } catch (_) {} };
        img.src = art[id];
      });
    }, 80);
    return true;
  }
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== "undefined" && window.storage) {
          const res = await window.storage.get("palettes:list");
          if (res && res.value) { const arr = JSON.parse(res.value); if (Array.isArray(arr)) setSavedPalettes(arr); }
        }
      } catch (_) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function pickAt(c, r) {
    try {
      const fc = compositeFrameCanvas(0, previewLayers());
      const d = fc.getContext("2d").getImageData(c, r, 1, 1).data;
      if (d[3] > 0) { const hex = rgbToHex(d[0], d[1], d[2]); setHsv(hexToHsv(hex)); setEraseMode(false); rememberColor(hex); }
    } catch (_) {}
  }
  function exportPng() {
    try {
      const fc = compositeFrameCanvas(0, layersRef.current);
      const url = fc.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url; a.download = `pixel-art-${fc.width}x${fc.height}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (_) { setError("Export failed for this size."); }
  }

  /* ---------------- color selection ---------------- */
  function selectPaletteColor(color) {
    setHsv(hexToHsv(color));
    setEraseMode(false);
    if (paintTool === "pick") setPaintTool("brush");
  }
  function selectNone() { setEraseMode(true); setPaintTool("brush"); }
  function toggleGradient() { const s = selectedLayer(); if (!s || s.type !== "art") selectArtLayer(); setEraseMode(false); setPaintTool((t) => (t === "gradient" ? "brush" : "gradient")); }
  function togglePick() { setPaintTool((t) => (t === "pick" ? "brush" : "pick")); }
  function addGradStop() { setGradStops((s) => (s.length >= 16 ? s : [...s, currentColor])); }
  function removeGradStop(i) { setGradStops((s) => (s.length <= 2 ? s : s.filter((_, j) => j !== i))); }

  const svRef = useRef(null), svDrag = useRef(false);
  function svUpdate(e) {
    setEraseMode(false);
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    setHsv((prev) => ({ ...prev, s, v }));
  }
  const hueRef = useRef(null), hueDrag = useRef(false);
  function hueUpdate(e) {
    setEraseMode(false);
    const rect = hueRef.current.getBoundingClientRect();
    const h = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360;
    setHsv((prev) => ({ ...prev, h }));
  }

  const rgbNow = hexToRgb(currentColor);
  const cmyk = rgbToCmyk(rgbNow.r, rgbNow.g, rgbNow.b);
  function setCmyk(part, val) {
    const v = clamp(parseInt(val, 10) || 0, 0, 100);
    const next = { ...cmyk, [part]: v };
    const rgb = cmykToRgb(next.c, next.m, next.y, next.k);
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    setEraseMode(false);
  }
  function onHexChange(val) {
    setHexField(val);
    let v = val.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#([0-9a-fA-F]{6})$/.test(v)) { setHsv(hexToHsv(v)); setEraseMode(false); }
  }

  function applyDims() {
    const w = Math.max(1, Math.floor(Number(inputW) || 0));
    const h = Math.max(1, Math.floor(Number(inputH) || 0));
    if (!w || !h) { setError("Enter valid width and height."); return; }
    const prevSnap = takeSnapshot();
    try {
      const nb = document.createElement("canvas");
      nb.width = w; nb.height = h;
      if (!nb.getContext("2d")) throw new Error("no-ctx");
      bufferRef.current = nb;
      commitSnapshot(prevSnap);
      setLayers((arr) => arr.map((l) => {
        if (l.type === "blink") return { ...l, cells: new Set() };
        if (l.type === "snake") return { ...l, path: [] };
        if (l.type === "sweep" || l.type === "rotate") return { ...l, rect: null };
        return l;
      }));
      setError(null);
      setDims({ w, h });
    } catch (err) { setError("That size is too large for the browser to allocate."); }
  }

  /* ---------------- blink editing (selected layer) ---------------- */
  function addBlinkColor() { updateSelectedLayer((b) => (b.sequence.length >= 32 ? b : { ...b, sequence: [...b.sequence, currentColor] })); }
  function addBlinkNone() { updateSelectedLayer((b) => (b.sequence.length >= 32 ? b : { ...b, sequence: [...b.sequence, null] })); }
  function removeBlinkStep(i) { updateSelectedLayer((b) => ({ ...b, sequence: b.sequence.filter((_, j) => j !== i) })); }
  function setBlinkStepFrames(n) { const v = clamp(parseInt(n, 10) || 1, 1, 60); updateSelectedLayer((b) => ({ ...b, stepFrames: v })); }
  function clearBlinkCells() { updateSelectedLayer((b) => ({ ...b, cells: new Set() })); drawCanvas(); }
  function blinkStroke(c0, r0, c1, r1, erase) {
    const b = selectedLayer();
    if (!b || b.type !== "blink") return;
    const dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0);
    const sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1;
    let err = dx - dy, x = c0, y = r0;
    while (true) {
      const key = x + "," + y;
      if (erase) b.cells.delete(key); else b.cells.add(key);
      if (x === c1 && y === r1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  /* ---------------- snake editing (selected layer) ---------------- */
  function setSnakeLength(n) {
    const len = clamp(parseInt(n, 10) || 1, 1, 64);
    updateSelectedLayer((s) => {
      const colors = s.colors.slice(0, len);
      while (colors.length < len) colors.push(colors.length ? colors[colors.length - 1] : currentColor);
      return { ...s, length: len, colors };
    });
  }
  function setSnakeSegment(i) { updateSelectedLayer((s) => { const colors = s.colors.slice(); colors[i] = eraseMode ? null : currentColor; return { ...s, colors }; }); }
  function fillSnakeBody() { updateSelectedLayer((s) => ({ ...s, colors: s.colors.map(() => (eraseMode ? null : currentColor)) })); }
  function fadeSnakeBody() {
    updateSelectedLayer((s) => {
      const n = s.length;
      const stops = (s.bodyStops && s.bodyStops.length >= 1) ? s.bodyStops : [currentColor, "#1e1b4b"];
      const colors = [];
      for (let i = 0; i < n; i++) colors.push(sampleGradientLinear(stops, n > 1 ? i / (n - 1) : 0));
      return { ...s, colors };
    });
  }
  function addSnakeStop() { updateSelectedLayer((s) => { const b = (s.bodyStops || []).slice(); if (b.length >= 16) return s; b.push(eraseMode ? "#000000" : currentColor); return { ...s, bodyStops: b }; }); }
  function removeSnakeStop(i) { updateSelectedLayer((s) => { const b = (s.bodyStops || []).slice(); if (b.length <= 2) return s; b.splice(i, 1); return { ...s, bodyStops: b }; }); }
  function moveSnakeStop(i) { updateSelectedLayer((s) => { const b = (s.bodyStops || []).slice(); const j = (i + 1) % b.length; const t = b[i]; b[i] = b[j]; b[j] = t; return { ...s, bodyStops: b }; }); }
  function setSnakeSpeed(n) { let v = parseFloat(n) || 1; v = v >= 1 ? Math.round(v) : Math.round(v * 2) / 2; updateSelectedLayer((s) => ({ ...s, speed: clamp(v, 0.5, 30) })); }
  function clearSnakePath() { updateSelectedLayer((s) => ({ ...s, path: [] })); drawCanvas(); }

  /* ---- reusable editor pieces ---- */
  function speedSlider(frames, setFrames, fmax, fmin) {
    const lo = fmin || 1;
    const f = clamp(frames || lo, lo, fmax);
    const STEPS = 1000;
    const ln = Math.log(fmax / lo) || 1;
    // geometric: period = fmax * (lo/fmax)^sPos, sPos 0=slow(fmax) .. 1=fast(lo)
    const sPos = (Math.log(f) - Math.log(fmax)) / (Math.log(lo) - Math.log(fmax) || 1);
    const pos = Math.round(sPos * STEPS);
    const snap = (v) => (v >= 1 ? Math.round(v) : Math.round(v * 2) / 2); // halves below 1
    const fromPos = (p) => clamp(snap(fmax * Math.pow(lo / fmax, p / STEPS)), lo, fmax);
    return (
      <div className="flex items-center gap-2 text-indigo-700">
        <span className="uppercase tracking-wide">Speed</span>
        <span className="text-indigo-400">slow</span>
        <input type="range" min="0" max={STEPS} value={pos} onChange={(e) => setFrames(fromPos(parseInt(e.target.value, 10) || 0))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
        <span className="text-indigo-400">fast</span>
        <input type="number" min={lo} max={fmax} step={lo < 1 ? 0.5 : 1} value={f} onChange={(e) => setFrames(clamp(parseFloat(e.target.value) || lo, lo, fmax))}
          title="frames per step (lower = faster; below 1 advances multiple cells per frame)" className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
      </div>
    );
  }
  function colorListEditor(colors, set, lo) {
    const CAP = 64;
    const addColor = () => set((s) => (s.colors.length >= CAP ? s : { ...s, colors: [...s.colors, currentColor] }));
    const addNone = () => set((s) => (s.colors.length >= CAP ? s : { ...s, colors: [...s.colors, "none"] }));
    const removeColor = (i) => set((s) => (s.colors.length <= lo ? s : { ...s, colors: s.colors.filter((_, j) => j !== i) }));
    const rainbow = () => set((s) => ({ ...s, colors: RAINBOW.slice() }));
    const importColors = () => {
      if (typeof window === "undefined") return;
      const txt = window.prompt("Paste colors (hex, or 'none' — any separators):", colors.join(", "));
      if (txt == null) return;
      const found = (txt.match(/#?[0-9a-fA-F]{6}\b|none/gi) || []).map((h) => (/^none$/i.test(h) ? "none" : "#" + h.replace("#", "").toLowerCase())).slice(0, CAP);
      if (found.length >= lo) set((s) => ({ ...s, colors: found }));
    };
    return (
      <>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-indigo-700 uppercase tracking-wide">Colors</span>
            <span className="font-mono text-indigo-500">{colors.length} / {CAP}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {colors.map((col, i) => (
              <button key={i} draggable
                onDragStart={() => { dragSwatchRef.current = { kind: "effect", i }; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { const s = dragSwatchRef.current; if (s && s.kind === "effect" && s.i !== i) set((st) => ({ ...st, colors: arrMove(st.colors, s.i, i) })); dragSwatchRef.current = null; }}
                onClick={() => removeColor(i)} title={colors.length <= lo ? `At least ${lo}` : (col === "none" ? "Transparent · drag to reorder · click to remove" : "Drag to reorder · click to remove")}
                className="w-7 h-7 rounded border border-neutral-300 hover:border-red-400" style={{ ...swatchStyle(col), cursor: "grab" }} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addColor} disabled={colors.length >= CAP}
            className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (colors.length >= CAP ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
            <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
            + Color
          </button>
          <button onClick={addNone} disabled={colors.length >= CAP} title="Add a transparent stop"
            className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (colors.length >= CAP ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
            <span className="w-3 h-3 rounded-sm border border-neutral-300" style={NONE_CHIP} />
            + None
          </button>
          <button onClick={rainbow} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-800 hover:opacity-90"
            style={{ backgroundImage: "linear-gradient(to right, #ff0000,#ffaa00,#ffff00,#00cc00,#00bccc,#0066ff,#7a00ff,#ff00aa)" }}>
            <span className="px-1 rounded bg-white">Rainbow</span>
          </button>
          <button onClick={importColors} title="Paste a list of hex colors (or none) to replace the list" className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Paste palette</button>
        </div>
      </>
    );
  }
  function particleControls(desc, set) {
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
          <input type="checkbox" checked={!!desc.particles} onChange={(e) => set((s) => ({ ...s, particles: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
          <span className="uppercase tracking-wide">Particles</span>
          <span className="text-indigo-400">{desc.particles ? "scattered dots" : "smooth fill"}</span>
        </label>
        {desc.particles && (
          <label className="flex items-center gap-2 text-indigo-700">
            <span className="uppercase tracking-wide">Density</span>
            <input type="range" min="1" max="60" value={desc.density || 12} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 60) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
            <span className="font-mono text-indigo-500 w-8 text-right">{desc.density || 12}</span>
          </label>
        )}
      </div>
    );
  }
  function bandsField(desc, set) {
    return (
      <label className="flex items-center gap-1.5 text-indigo-700">
        <span className="uppercase tracking-wide">Bands</span>
        <input type="number" min="1" max="32" value={desc.bands} onChange={(e) => set((s) => ({ ...s, bands: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))}
          className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
      </label>
    );
  }
  function areaRow(desc, set) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-indigo-500">{desc.rect ? `area ${Math.abs(desc.rect.c1 - desc.rect.c0) + 1}×${Math.abs(desc.rect.r1 - desc.rect.r0) + 1}` : "no area — drag on the grid"}</span>
        {desc.rect && (<button onClick={() => { set((s) => ({ ...s, rect: null })); drawCanvas(); }} className="ml-auto px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear area</button>)}
      </div>
    );
  }
  const dirBtnCls = (active) => "w-8 h-8 rounded border flex items-center justify-center text-sm " + (active ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100");
  const twoBtn = (active) => "px-2 py-1 rounded-md border text-xs font-medium " + (active ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100");

  /* shared editor for the gradient effects (sweep, rotate, pulse, radiates, cascade) */
  function gradientPanel(desc) {
    const set = (fn) => updateSelectedLayer(fn);
    const setDir = (dir) => set((s) => ({ ...s, dir }));
    const t = desc.type;
    const note = t === "rotate" ? "spins" : t === "pulse" ? "throbs out like a heartbeat" : t === "radiates" ? "streams from the center" : t === "cascade" ? "flows" : "scrolls";
    return (
      <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
        <div className="font-semibold text-indigo-800 uppercase tracking-wide">{LAYER_LABEL[t]} layer</div>
        <div className="text-indigo-900">Drag a <b>rectangle</b> on the grid to set the area. The effect {note} and loops.</div>
        {colorListEditor(desc.colors, set, 2)}
        {t === "rotate" && (
          <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Spin</div>
            <div className="flex gap-2">{[["CW", "↻ Clockwise"], ["CCW", "↺ Counter"]].map(([dir, lbl]) => (
              <button key={dir} onClick={() => setDir(dir)} className={twoBtn(desc.dir === dir)}>{lbl}</button>))}</div>
          </div>
        )}
        {t === "radiates" && (
          <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Flow</div>
            <div className="flex gap-2">{[["out", "⤢ Outward (sun)"], ["in", "⤡ Inward (black hole)"]].map(([dir, lbl]) => (
              <button key={dir} onClick={() => setDir(dir)} className={twoBtn(desc.dir === dir)}>{lbl}</button>))}</div>
          </div>
        )}
        {(t === "sweep" || t === "cascade") && (
          <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
            <div className="inline-grid grid-cols-3 gap-1">
              {[["NW", "↖"], ["N", "↑"], ["NE", "↗"], ["W", "←"], [null, ""], ["E", "→"], ["SW", "↙"], ["S", "↓"], ["SE", "↘"]].map(([dir, glyph], i) =>
                dir ? (<button key={i} onClick={() => setDir(dir)} title={dir} className={dirBtnCls(desc.dir === dir)}>{glyph}</button>) : (<div key={i} className="w-8 h-8 rounded bg-neutral-100" />))}
            </div>
          </div>
        )}
        {t !== "pulse" && (<div className="flex flex-wrap items-center gap-3">{bandsField(desc, set)}</div>)}
        {speedSlider(desc.cycleFrames, (f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) })), 120)}
        {particleControls(desc, set)}
        {areaRow(desc, set)}
        <div className="text-indigo-500">Shows only where layers above it are transparent. Press <b>Play</b> to preview.</div>
      </div>
    );
  }

  function glittersPanel(desc) {
    const set = (fn) => updateSelectedLayer(fn);
    return (
      <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
        <div className="font-semibold text-indigo-800 uppercase tracking-wide">Glitters layer</div>
        <div className="text-indigo-900">Drag a <b>rectangle</b>; cells twinkle with random colors from the list.</div>
        {colorListEditor(desc.colors, set, 1)}
        <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Density</span>
          <input type="range" min="1" max="80" value={desc.density || 12} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 80) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
          <span className="font-mono text-indigo-500 w-8 text-right">{desc.density || 12}</span>
        </label>
        <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Variations</span>
          <input type="number" min="1" max="32" value={desc.steps} onChange={(e) => set((s) => ({ ...s, steps: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))} title="distinct random states before the loop repeats"
            className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
        </label>
        {speedSlider(desc.cycleFrames, (f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 60) })), 60)}
        {areaRow(desc, set)}
        <div className="text-indigo-500">Loops every Speed × Variations frames.</div>
      </div>
    );
  }
  function electronPanel(desc) {
    const set = (fn) => updateSelectedLayer(fn);
    return (
      <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
        <div className="font-semibold text-indigo-800 uppercase tracking-wide">Electron layer</div>
        <div className="text-indigo-900">Drag a <b>rectangle</b>; dots orbit its center with irregular speed and stay spaced apart.</div>
        {colorListEditor(desc.colors, set, 1)}
        <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Count</span>
          <input type="number" min="1" max="12" value={desc.count} onChange={(e) => set((s) => ({ ...s, count: clamp(parseInt(e.target.value, 10) || 1, 1, 12) }))}
            className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
        </label>
        {speedSlider(desc.cycleFrames, (f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) })), 120)}
        {areaRow(desc, set)}
      </div>
    );
  }
  function fliesPanel(desc) {
    const set = (fn) => updateSelectedLayer(fn);
    return (
      <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
        <div className="font-semibold text-indigo-800 uppercase tracking-wide">Flies layer</div>
        <div className="text-indigo-900">Drag a <b>rectangle</b>; dots wander and switch heading at regular intervals.</div>
        {colorListEditor(desc.colors, set, 1)}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Count</span>
            <input type="number" min="1" max="2000" value={desc.count} onChange={(e) => set((s) => ({ ...s, count: clamp(parseInt(e.target.value, 10) || 1, 1, 2000) }))}
              className="w-16 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
          </label>
          <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Turns</span>
            <input type="number" min="2" max="20" value={desc.turns} onChange={(e) => set((s) => ({ ...s, turns: clamp(parseInt(e.target.value, 10) || 2, 2, 20) }))} title="direction switches per loop"
              className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
          </label>
        </div>
        {speedSlider(desc.cycleFrames, (f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) })), 120)}
        {areaRow(desc, set)}
      </div>
    );
  }

  function tracePanel(desc) {
    const set = (fn) => updateSelectedLayer(fn);
    const setDir = (dir) => set((s) => ({ ...s, dir }));
    const pct = (v, d) => Math.round((v == null ? d : v) * 100);
    return (
      <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
        <div className="font-semibold text-indigo-800 uppercase tracking-wide">Trace layer</div>
        <div className="text-indigo-900">Drag a <b>rectangle</b>; particles stream and leave fading trails. By default each one walks the gradient on its own phase; turn on <b>Fixed gradient in space</b> to anchor color to position — like windows onto a gradient behind the veil.</div>
        {colorListEditor(desc.colors, set, 1)}
        <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Shape</div>
          <div className="inline-flex rounded-md overflow-hidden border border-indigo-300">
            <button onClick={() => set((s) => ({ ...s, shape: "rect", dir: (s.dir === "out" || s.dir === "in") ? "E" : s.dir }))}
              className={"px-3 py-1 text-xs font-medium " + (desc.shape !== "circle" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Rectangle</button>
            <button onClick={() => set((s) => ({ ...s, shape: "circle", dir: (s.dir === "out" || s.dir === "in") ? s.dir : "out" }))}
              className={"px-3 py-1 text-xs font-medium border-l border-indigo-300 " + (desc.shape === "circle" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Circle</button>
          </div>
        </div>
        {desc.shape === "circle" ? (
          <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
            <div className="inline-flex rounded-md overflow-hidden border border-indigo-300">
              <button onClick={() => setDir("out")} className={"px-3 py-1 text-xs font-medium flex items-center gap-1 " + (desc.dir !== "in" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>⤴ Outwards</button>
              <button onClick={() => setDir("in")} className={"px-3 py-1 text-xs font-medium border-l border-indigo-300 flex items-center gap-1 " + (desc.dir === "in" ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>⤵ Inwards</button>
            </div>
          </div>
        ) : (
          <div><div className="text-indigo-700 uppercase tracking-wide mb-1">Direction</div>
            <div className="inline-grid grid-cols-3 gap-1">
              {[["NW", "↖"], ["N", "↑"], ["NE", "↗"], ["W", "←"], [null, ""], ["E", "→"], ["SW", "↙"], ["S", "↓"], ["SE", "↘"]].map(([dir, glyph], i) =>
                dir ? (<button key={i} onClick={() => setDir(dir)} title={dir} className={dirBtnCls(desc.dir === dir)}>{glyph}</button>) : (<div key={i} className="w-8 h-8 rounded bg-neutral-100" />))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Density</span>
          <input type="range" min="1" max="80" value={desc.density || 32} onChange={(e) => set((s) => ({ ...s, density: clamp(parseInt(e.target.value, 10) || 1, 1, 80) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
          <span className="font-mono text-indigo-500 w-8 text-right">{desc.density || 32}</span>
        </label>
        <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Trail</span>
          <input type="range" min="1" max="24" value={desc.trailLen || 5} onChange={(e) => set((s) => ({ ...s, trailLen: clamp(parseInt(e.target.value, 10) || 1, 1, 24) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} />
          <span className="font-mono text-indigo-500 w-8 text-right">{desc.trailLen || 5}</span>
        </label>
        <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Fade</span>
          <input type="range" min="0" max="100" value={pct(desc.trailFade, 0.85)} onChange={(e) => set((s) => ({ ...s, trailFade: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how strongly the tail fades to transparent" />
          <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.trailFade, 0.85)}</span>
        </label>
        <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
          <input type="checkbox" checked={!!desc.horizon} onChange={(e) => set((s) => ({ ...s, horizon: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
          <span className="uppercase tracking-wide">Horizon</span>
          <span className="text-indigo-400">{desc.horizon ? "slows + piles up at the far edge" : "even flow"}</span>
        </label>
        {desc.horizon && (
          <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Pile-up</span>
            <input type="range" min="10" max="60" value={Math.round((desc.horizonPow == null ? 2.4 : desc.horizonPow) * 10)} onChange={(e) => set((s) => ({ ...s, horizonPow: (parseInt(e.target.value, 10) || 10) / 10 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how hard particles slow & stack near the far edge (the direction sets where the horizon is)" />
            <span className="font-mono text-indigo-500 w-8 text-right">{(desc.horizonPow == null ? 2.4 : desc.horizonPow).toFixed(1)}</span>
          </label>
        )}
        <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
          <input type="checkbox" checked={!!desc.spaceGrad} onChange={(e) => set((s) => ({ ...s, spaceGrad: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
          <span className="uppercase tracking-wide">Fixed gradient in space</span>
          <span className="text-indigo-400">{desc.spaceGrad ? "color anchored to position" : "color follows each particle"}</span>
        </label>
        {desc.spaceGrad ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Bands</span>
                <input type="number" min="1" max="32" value={desc.bands || 1} onChange={(e) => set((s) => ({ ...s, bands: clamp(parseInt(e.target.value, 10) || 1, 1, 32) }))} title="gradient cycles across the area (1 = a single seam)"
                  className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
              </label>
              <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Drift / loop</span>
                <input type="number" min="0" max="12" value={desc.drift || 0} onChange={(e) => set((s) => ({ ...s, drift: clamp(parseInt(e.target.value, 10) || 0, 0, 12) }))} title="0 = static. higher slowly scrolls the whole gradient along the flow (kept seamless)"
                  className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Variation</span>
              <input type="range" min="0" max="200" value={pct(desc.variation, 0.15)} onChange={(e) => set((s) => ({ ...s, variation: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how far each particle reads the gradient early/late — 0 = clean bands, small = close-but-irregular" />
              <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.variation, 0.15)}</span>
            </label>
            <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Randomize</span>
              <input type="range" min="0" max="100" value={pct(desc.randomize, 0)} onChange={(e) => set((s) => ({ ...s, randomize: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="% of particles given a shuffled palette color (same colors, different order)" />
              <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.randomize, 0)}</span>
            </label>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Color spread</span>
              <input type="range" min="0" max="100" value={pct(desc.spread, 1)} onChange={(e) => set((s) => ({ ...s, spread: (parseInt(e.target.value, 10) || 0) / 100 }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="0 = every particle in lockstep · 100 = fully staggered phases" />
              <span className="font-mono text-indigo-500 w-8 text-right">{pct(desc.spread, 1)}</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Color cycles / loop</span>
                <input type="number" min="0" max="12" value={desc.colorSpeed == null ? 1 : desc.colorSpeed} onChange={(e) => set((s) => ({ ...s, colorSpeed: clamp(parseInt(e.target.value, 10) || 0, 0, 12) }))} title="how many times each particle walks the whole gradient per loop (integer keeps it seamless)"
                  className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
              </label>
              <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
                <input type="checkbox" checked={!!desc.trailGrad} onChange={(e) => set((s) => ({ ...s, trailGrad: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
                <span className="uppercase tracking-wide">Gradient along trail</span>
              </label>
            </div>
          </>
        )}
        {speedSlider(desc.cycleFrames, (f) => set((s) => ({ ...s, cycleFrames: clamp(f, 1, 120) })), 120)}
        {areaRow(desc, set)}
        <div className="text-indigo-500">Trails fade by transparency — put a black <b>Artwork</b> layer beneath for the crispest read. Press <b>Play</b> to preview.</div>
      </div>
    );
  }
  function lcm(a, b) { const gcd = (x, y) => (y ? gcd(y, x % y) : x); return a && b ? Math.abs(a * b) / gcd(a, b) : Math.max(a, b); }
  function layerPeriod(l) {
    if (l.type === "blink") return l.cells.size && l.sequence.length ? l.sequence.length * Math.max(1, l.stepFrames || 1) : 1;
    if (l.type === "snake") return l.path && l.path.length ? snakePeriod(l.path.length, l.speed || 1) : 1;
    if (l.type === "glitters") return l.rect ? Math.max(1, l.cycleFrames || 1) * Math.max(1, l.steps || 1) : 1;
    if (GRADIENT_TYPES.indexOf(l.type) >= 0 || l.type === "electron" || l.type === "flies" || l.type === "trace") return l.rect ? Math.max(1, l.cycleFrames || 1) : 1;
    return 1;
  }
  function animationFrameCount(list) {
    if (!list || list.length === 0) return 1;
    let n = 1;
    for (const l of list) { if (!l.visible) continue; const p = layerPeriod(l); if (p > 0) n = lcm(n, p); }
    return Math.max(1, n);
  }
  function computeFrames() {
    const buf = bufferRef.current;
    if (!buf) return [];
    const w = buf.width, h = buf.height;
    const dur = Math.max(1, Math.round(1000 / (fpsRef.current || 8)));
    const total = Math.min(600, animationFrameCount(layersRef.current));
    // art layers don't change between frames — read their pixels once instead of per frame
    const artData = {};
    for (const l of layersRef.current) if (l.type === "art" && l.visible) { try { artData[l.id] = getArtBuffer(l.id).getContext("2d").getImageData(0, 0, w, h).data; } catch (_) {} }
    const out = [];
    for (let i = 0; i < total; i++) out.push({ canvas: compositeFrameCanvas(i, layersRef.current, artData), durationMs: dur });
    return out;
  }
  function tick(now) {
    if (!playingRef.current) return;
    const frames = framesRef.current;
    if (!frames || frames.length === 0) { stopPlayback(); return; }
    if (lastTsRef.current == null) lastTsRef.current = now;
    const cur = frames[frameIdxRef.current];
    if (now - lastTsRef.current >= cur.durationMs) {
      lastTsRef.current = now;
      frameIdxRef.current = (frameIdxRef.current + 1) % frames.length;
      setFrameInfo({ i: frameIdxRef.current, n: frames.length });
      drawCanvas();
    }
    rafRef.current = requestAnimationFrame(tick);
  }
  function startPlayback() {
    const frames = computeFrames();
    if (frames.length === 0) return;
    framesRef.current = frames;
    frameIdxRef.current = 0;
    lastTsRef.current = null;
    hoverRef.current = null;
    playingRef.current = true;
    setIsPlaying(true);
    setFrameInfo({ i: 0, n: frames.length });
    drawCanvas();
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopPlayback() {
    playingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    framesRef.current = null;
    setFrameInfo({ i: 0, n: animationFrameCount(layersRef.current) });
    drawCanvas();
  }
  function togglePlay() { if (playingRef.current) stopPlayback(); else startPlayback(); }
  function exportGif() {
    if (isExporting) return;
    const frames = computeFrames();
    if (frames.length === 0) return;
    setIsExporting(true);
    setError(null);
    setTimeout(() => {
      try {
        const w = frames[0].canvas.width, h = frames[0].canvas.height;
        const fr = frames.map((f) => ({ rgba: f.canvas.getContext("2d").getImageData(0, 0, w, h).data, delayMs: f.durationMs }));
        const bytes = encodeGIF(w, h, fr, 0);
        const blob = new Blob([bytes], { type: "image/gif" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `pixel-art-${w}x${h}.gif`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        setError("GIF export failed: " + (e && e.message ? e.message : "unknown error"));
      } finally { setIsExporting(false); }
    }, 30);
  }

  /* ---------------- pointer / grid interaction ---------------- */
  function getCell(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const W = dimsRef.current.w, H = dimsRef.current.h;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { c: clamp(Math.floor(x), 0, W - 1), r: clamp(Math.floor(y), 0, H - 1) };
  }
  function onPointerDown(e) {
    if (!bufferRef.current || playingRef.current) return;
    e.preventDefault();
    const cell = getCell(e);
    const layer = selectedLayer();
    if (!layer) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    if (paintTool === "pick") { pickAt(cell.c, cell.r); setPaintTool("brush"); return; } // eyedropper works on any layer
    if (layer.type === "art") {
      if (paintTool === "shape") {
        pendingSnapRef.current = takeSnapshot();
        dragRef.current = { active: true, kind: "shape", layerId: layer.id, start: cell, last: cell, shape: shapeKind, fill: shapeFill, erase: eraseMode };
      } else if (paintTool === "gradient") {
        if (gradStops.length >= 2) { pendingSnapRef.current = takeSnapshot(); dragRef.current = { active: true, kind: "paint-grad", layerId: layer.id, start: cell, last: cell }; }
        else return;
      } else if (e.shiftKey) {
        pendingSnapRef.current = takeSnapshot();
        dragRef.current = { active: true, kind: "paint-rect", layerId: layer.id, start: cell, last: cell, erase: eraseMode };
      } else {
        pendingSnapRef.current = takeSnapshot();
        dragRef.current = { active: true, kind: "paint-free", layerId: layer.id, start: cell, last: cell, erase: eraseMode };
        paintCell(cell.c, cell.r, eraseMode ? null : currentColor);
        if (!eraseMode) rememberColor(currentColor);
      }
      drawCanvas(); return;
    }
    if (isRectEffect(layer.type)) { dragRef.current = { active: true, kind: "rect", layerId: layer.id, start: cell, last: cell }; drawCanvas(); return; }
    if (layer.type === "snake") { dragRef.current = { active: true, kind: "path", layerId: layer.id, cells: [cell], last: cell }; drawCanvas(); return; }
    if (layer.type === "blink") { dragRef.current = { active: true, kind: "cells", layerId: layer.id, erase: e.shiftKey, start: cell, last: cell, moved: false }; return; }
  }
  function onPointerMove(e) {
    if (playingRef.current) return;
    const d = dragRef.current;
    const cell = getCell(e);
    if (!d.active) {
      const prev = hoverRef.current;
      if (!prev || prev.c !== cell.c || prev.r !== cell.r) { hoverRef.current = cell; drawCanvas(); }
      return;
    }
    if (d.kind === "cells") {
      if (cell.c !== d.last.c || cell.r !== d.last.r) { d.moved = true; blinkStroke(d.last.c, d.last.r, cell.c, cell.r, d.erase); d.last = cell; drawCanvas(); }
      return;
    }
    if (d.kind === "paint-free") { paintLine(d.last.c, d.last.r, cell.c, cell.r, d.erase ? null : currentColor); d.last = cell; drawCanvas(); return; }
    if (d.kind === "path") {
      if (cell.c !== d.last.c || cell.r !== d.last.r) {
        let c0 = d.last.c, r0 = d.last.r;
        const c1 = cell.c, r1 = cell.r;
        const dx = Math.abs(c1 - c0), dy = Math.abs(r1 - r0);
        const sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1;
        let err = dx - dy;
        while (!(c0 === c1 && r0 === r1)) {
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; c0 += sx; }
          if (e2 < dx) { err += dx; r0 += sy; }
          const prev = d.cells[d.cells.length - 1];
          if (!prev || prev.c !== c0 || prev.r !== r0) d.cells.push({ c: c0, r: r0 });
        }
        d.last = cell; drawCanvas();
      }
      return;
    }
    if (d.kind === "shape") {
      let cc = cell;
      if (e.shiftKey) {
        const W = dimsRef.current.w, H = dimsRef.current.h;
        const dx = cell.c - d.start.c, dy = cell.r - d.start.r;
        const sgnx = dx < 0 ? -1 : 1, sgny = dy < 0 ? -1 : 1;
        const maxX = sgnx > 0 ? (W - 1 - d.start.c) : d.start.c;
        const maxY = sgny > 0 ? (H - 1 - d.start.r) : d.start.r;
        const side = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), maxX, maxY);
        cc = { c: d.start.c + sgnx * side, r: d.start.r + sgny * side };
      }
      if (d.last.c !== cc.c || d.last.r !== cc.r) { d.last = cc; drawCanvas(); }
      return;
    }
    if (d.last.c !== cell.c || d.last.r !== cell.r) { d.last = cell; drawCanvas(); }
  }
  function endDrag() {
    const d = dragRef.current;
    if (!d.active) return;
    dragRef.current = { active: false };
    if (d.kind === "rect") { updateLayer(d.layerId, (l) => ({ ...l, rect: { c0: d.start.c, r0: d.start.r, c1: d.last.c, r1: d.last.r } })); drawCanvas(); return; }
    if (d.kind === "path") { updateLayer(d.layerId, (l) => ({ ...l, path: d.cells })); drawCanvas(); return; }
    if (d.kind === "cells") {
      if (!d.moved) { const b = selectedLayer(); if (b && b.type === "blink") { const key = d.start.c + "," + d.start.r; if (b.cells.has(key)) b.cells.delete(key); else b.cells.add(key); } }
      setLayers((arr) => arr.slice()); drawCanvas(); return;
    }
    let mutated = false;
    if (d.kind === "paint-rect") { fillRect(d.start.c, d.start.r, d.last.c, d.last.r, d.erase ? null : currentColor); if (!d.erase) rememberColor(currentColor); mutated = true; }
    else if (d.kind === "paint-grad") { const w = Math.abs(d.last.c - d.start.c) + 1, h = Math.abs(d.last.r - d.start.r) + 1; if (w * h >= 2 && gradStops.length >= 2) { applyGradient(d.start.c, d.start.r, d.last.c, d.last.r, gradStops, gradDir); gradStops.forEach((c) => rememberColor(c)); mutated = true; } }
    else if (d.kind === "paint-free") { mutated = true; }
    else if (d.kind === "shape") {
      if (d.fill === "gradient" && gradStops.length >= 2) {
        const proj = gradProjector(d.start.c, d.start.r, d.last.c, d.last.r, gradDir);
        forEachShapeCell(d.shape, d.start.c, d.start.r, d.last.c, d.last.r, (x, y) => paintCell(x, y, sampleGradientLinear(gradStops, proj(x, y))));
        gradStops.forEach((c) => rememberColor(c));
      } else {
        const col = d.erase ? null : currentColor;
        forEachShapeCell(d.shape, d.start.c, d.start.r, d.last.c, d.last.r, (x, y) => paintCell(x, y, col));
        if (!d.erase) rememberColor(currentColor);
      }
      mutated = true;
    }
    if (mutated) commitSnapshot(pendingSnapRef.current);
    pendingSnapRef.current = null;
    drawCanvas();
  }
  function onPointerLeave() { if (!dragRef.current.active) { hoverRef.current = null; drawCanvas(); } }

  function gradientControls() {
    return (
      <>
        <div className="h-3 rounded" style={{ backgroundImage: `linear-gradient(to right, ${cssStops(gradStops)})`, border: "1px solid #e5e5e5" }} />
        <div>
          <div className="uppercase tracking-wide mb-1" style={{ color: "#92400e" }}>Direction</div>
          <div className="inline-grid grid-cols-3 gap-1">
            {[["NW", "↖"], ["N", "↑"], ["NE", "↗"], ["W", "←"], [null, ""], ["E", "→"], ["SW", "↙"], ["S", "↓"], ["SE", "↘"]].map(([dir, glyph], i) =>
              dir ? (
                <button key={i} onClick={() => setGradDir(dir)} title={dir}
                  className={"w-8 h-8 rounded border flex items-center justify-center text-sm " + (gradDir === dir ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100")}>{glyph}</button>
              ) : (<div key={i} className="w-8 h-8 rounded bg-neutral-100" />))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {gradStops.map((col, i) => (
            <button key={i} draggable
              onDragStart={() => { dragSwatchRef.current = { kind: "grad", i }; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const s = dragSwatchRef.current; if (s && s.kind === "grad" && s.i !== i) setGradStops((a) => arrMove(a, s.i, i)); dragSwatchRef.current = null; }}
              onClick={() => removeGradStop(i)} title={col === "none" ? "Transparent · drag to reorder · click to remove" : "Drag to reorder · click to remove"}
              className="w-7 h-7 rounded border border-neutral-300 hover:border-red-400" style={{ ...swatchStyle(col), cursor: "grab" }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addGradStop} disabled={gradStops.length >= 16}
            className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (gradStops.length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
            <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
            + Color
          </button>
          <button onClick={() => setGradStops((s) => (s.length >= 16 ? s : [...s, "none"]))} disabled={gradStops.length >= 16} title="Add a transparent stop"
            className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (gradStops.length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
            <span className="w-3 h-3 rounded-sm border border-neutral-300" style={NONE_CHIP} />
            + None
          </button>
          <button onClick={() => setGradStops(RAINBOW.slice())} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-800 hover:opacity-90"
            style={{ backgroundImage: "linear-gradient(to right, #ff0000,#ffaa00,#ffff00,#00cc00,#00bccc,#0066ff,#7a00ff,#ff00aa)" }}>
            <span className="px-1 rounded bg-white">Rainbow</span>
          </button>
        </div>
      </>
    );
  }

  const labelCls = "block text-xs uppercase tracking-wide text-neutral-500 mb-1";
  const NONE_CHIP = { backgroundImage: "linear-gradient(45deg,#bbb 25%,transparent 25%,transparent 75%,#bbb 75%),linear-gradient(45deg,#bbb 25%,#fff 25%,#fff 75%,#bbb 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0,4px 4px", backgroundColor: "#fff" };
  const swatchStyle = (col) => (col === "none" ? { ...NONE_CHIP } : { backgroundColor: col });
  const cssStops = (arr) => arr.map((c) => (c === "none" ? "transparent" : c)).join(",");
  const fieldCls = "w-full px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono text-neutral-800 focus:outline-none focus:border-neutral-500";
  const sel = layers.find((l) => l.id === selectedLayerId) || null;

  return (
    <div className="max-w-5xl mx-auto p-5 text-neutral-900 select-none" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Pixel Art Studio</h1>
        <span className="font-mono text-xs text-neutral-400">{dims.w}×{dims.h}</span>
      </header>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-80 space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-md border border-neutral-300 shadow-sm shrink-0 relative overflow-hidden bg-white"
              style={{ ...(eraseMode ? {} : { backgroundColor: currentColor }), cursor: eraseMode ? "default" : "grab" }}
              draggable={!eraseMode}
              onDragStart={(e) => { if (eraseMode) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = "copy"; try { e.dataTransfer.setData("text/plain", currentColor); } catch (_) {} }}
              title={eraseMode ? "None (transparent)" : "Drag onto Custom to save this color"}
            >
              {eraseMode && (<svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full"><line x1="6" y1="42" x2="42" y2="6" stroke="#ef4444" strokeWidth="3" /></svg>)}
            </div>
            <div className="flex-1">
              <label className={labelCls}>{eraseMode ? "None (transparent)" : "Hex"}</label>
              <input value={hexField} onChange={(e) => onHexChange(e.target.value)} className={fieldCls} />
            </div>
            <button onClick={togglePick} title="Eyedropper — sample any cell's color (effects included) into this swatch"
              className={"shrink-0 w-9 h-9 mt-4 rounded-md border flex items-center justify-center bg-white " + (paintTool === "pick" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
            </button>
          </div>

          <div>
            <div ref={svRef}
              onPointerDown={(e) => { svDrag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} svUpdate(e); }}
              onPointerMove={(e) => { if (svDrag.current) svUpdate(e); }}
              onPointerUp={() => { svDrag.current = false; }}
              className="relative w-full rounded-md cursor-crosshair border border-neutral-300"
              style={{ height: "150px", backgroundColor: `hsl(${hsv.h},100%,50%)`, backgroundImage: "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))", touchAction: "none" }}>
              <div className="absolute w-3 h-3 rounded-full border-2 border-white" style={{ left: `calc(${hsv.s * 100}% - 6px)`, top: `calc(${(1 - hsv.v) * 100}% - 6px)`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />
            </div>
            <div ref={hueRef}
              onPointerDown={(e) => { hueDrag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} hueUpdate(e); }}
              onPointerMove={(e) => { if (hueDrag.current) hueUpdate(e); }}
              onPointerUp={() => { hueDrag.current = false; }}
              className="relative w-full h-4 rounded-md cursor-pointer mt-2 border border-neutral-300"
              style={{ backgroundImage: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)", touchAction: "none" }}>
              <div className="absolute top-0 h-4 w-1.5 rounded-sm border border-white" style={{ left: `calc(${(hsv.h / 360) * 100}% - 3px)`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />
            </div>
          </div>

          <div>
            <label className={labelCls}>CMYK</label>
            <div className="grid grid-cols-4 gap-2">
              {[["C", "c"], ["M", "m"], ["Y", "y"], ["K", "k"]].map(([lab, key]) => (
                <div key={key}>
                  <div className="text-center text-xs text-neutral-400 mb-1">{lab}</div>
                  <input type="number" min="0" max="100" value={cmyk[key]} onChange={(e) => setCmyk(key, e.target.value)}
                    className="w-full px-1 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + " mb-0"}>Palette</label>
              <button onClick={() => setPaletteMenuOpen((o) => !o)} title="Saved palettes"
                className={"flex items-center justify-center w-6 h-6 rounded-md border " + (paletteMenuOpen || activeSaved ? "border-indigo-400 text-indigo-600 bg-indigo-50" : "border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .9-1.5 2-1.5H16.5A4.5 4.5 0 0 0 22 11.5C22 6.3 17.5 2 12 2Z" />
                  <circle cx="7.5" cy="11" r="1.1" /><circle cx="12" cy="7.5" r="1.1" /><circle cx="16.5" cy="11" r="1.1" />
                </svg>
              </button>
              {paletteMenuOpen && (
                <div className="absolute right-0 z-20 rounded-md border border-neutral-200 bg-white shadow-lg py-1" style={{ top: "26px", minWidth: "11rem" }}>
                  {savedPalettes.length === 0 ? (
                    <div className="px-3 py-1.5 text-xs text-neutral-400">No saved palettes yet</div>
                  ) : savedPalettes.map((p) => (
                    <button key={p.name} onClick={() => { setActiveSaved(p.name); setPaletteMenuOpen(false); }}
                      className={"w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-neutral-100 " + (activeSaved === p.name ? "text-indigo-700 font-medium" : "text-neutral-700")}>
                      <span className="flex gap-0.5 shrink-0">{p.colors.slice(0, 5).map((c, j) => (<span key={j} className="w-2.5 h-2.5 rounded-sm border border-neutral-200" style={swatchStyle(c)} />))}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                  {activeSaved && (<button onClick={() => { setActiveSaved(""); setPaletteMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 border-t border-neutral-100">Hide saved section</button>)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={selectNone} title="None (transparent / eraser)"
                className={"w-7 h-7 rounded border bg-white relative overflow-hidden transition-transform hover:scale-110 " + (eraseMode ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}>
                <svg viewBox="0 0 28 28" className="absolute inset-0 w-full h-full"><line x1="4" y1="24" x2="24" y2="4" stroke="#ef4444" strokeWidth="2.5" /></svg>
              </button>
              {PALETTE.map((col) => (
                <button key={col} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={{ backgroundColor: col }} title={col} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + " mb-0"}>Custom</label>
              <span className="text-xs text-neutral-400">drag swatch here, or +</span>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!paletteDragOver) setPaletteDragOver(true); }}
              onDragLeave={() => setPaletteDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setPaletteDragOver(false); let c = ""; try { c = e.dataTransfer.getData("text/plain"); } catch (_) {} if (!/^#([0-9a-fA-F]{6})$/.test(c)) c = eraseMode ? "" : currentColor; addCustomColor(c); }}
              className="flex flex-wrap gap-1 rounded-md border border-dashed p-1"
              style={{ minHeight: "2.25rem", borderColor: paletteDragOver ? "#4f46e5" : "#d4d4d4", backgroundColor: paletteDragOver ? "#eef2ff" : "transparent" }}
            >
              {customPalette.length === 0 && !paletteDragOver && (
                <span className="text-xs text-neutral-400 px-1 py-1.5 select-none">No saved colors yet.</span>
              )}
              {customPalette.map((col, i) => (
                <span key={i} className="relative inline-block">
                  <button onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110 block" style={{ backgroundColor: col }} title={col} />
                  <button onClick={(e) => { e.stopPropagation(); removeCustomColor(i); }} title="Remove"
                    className="absolute rounded-full bg-neutral-700 text-white flex items-center justify-center leading-none"
                    style={{ top: "-5px", right: "-5px", width: "14px", height: "14px", fontSize: "9px" }}>×</button>
                </span>
              ))}
              <button onClick={() => { if (!eraseMode) addCustomColor(currentColor); }} disabled={eraseMode} title="Add the current color"
                className={"w-7 h-7 rounded border border-dashed flex items-center justify-center text-neutral-500 " + (eraseMode ? "border-neutral-200 text-neutral-300 cursor-not-allowed" : "border-neutral-400 hover:bg-neutral-100")}>+</button>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input value={paletteName} onChange={(e) => setPaletteName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveCustomPalette(paletteName); }}
                placeholder="name this palette…" className="flex-1 px-2 py-1 rounded-md border border-neutral-300 bg-white text-xs text-neutral-700 focus:outline-none focus:border-neutral-500" />
              <button onClick={() => saveCustomPalette(paletteName)} disabled={!customPalette.length || !paletteName.trim()} title={customPalette.length ? "Save this palette" : "Add colors to Custom first"}
                className={"px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1 " + (customPalette.length && paletteName.trim() ? "border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100" : "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed")}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
                Save
              </button>
            </div>
          </div>

          {(() => {
            const active = savedPalettes.find((p) => p.name === activeSaved);
            if (!active) return null;
            return (
              <div className="rounded-md border border-neutral-200 p-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-neutral-600">{active.name} <span className="text-neutral-400">(saved)</span></span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCustomPalette(active.colors.filter((c) => c !== "none").slice(0, 32))} title="Load into Custom" className="text-xs px-1.5 py-0.5 rounded border border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-100">→ Custom</button>
                    <button onClick={() => deleteSavedPalette(active.name)} title="Delete this palette" className="text-neutral-400 hover:text-red-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {active.colors.map((col, i) => (
                    <button key={i} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={swatchStyle(col)} title={col} />
                  ))}
                </div>
              </div>
            );
          })()}

          <div>
            <label className={labelCls}>Recent</label>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }).map((_, i) => {
                const col = recent[i];
                return col ? (
                  <button key={i} onClick={() => selectPaletteColor(col)} className="w-7 h-7 rounded border border-neutral-300 transition-transform hover:scale-110" style={{ backgroundColor: col }} title={col} />
                ) : (<div key={i} className="w-7 h-7 rounded border border-dashed border-neutral-300 bg-neutral-50" />);
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Layers</label>
            <button onClick={() => addLayer("art")} title="Add another artwork (paint) layer" className="w-full h-8 rounded-md border border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 flex items-center justify-center gap-1.5 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAYER_ACCENT.art }} />
              + Artwork
            </button>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {EFFECT_TYPES.map((t) => (
                <button key={t} onClick={() => addLayer(t)} title={`Add a ${LAYER_LABEL[t]} layer`} className="h-8 rounded-md border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAYER_ACCENT[t] }} />
                  + {LAYER_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="rounded-md border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
              {[...layers].reverse().map((l) => {
                const isSel = l.id === selectedLayerId;
                const sameType = layers.filter((x) => x.type === l.type);
                const typeIndex = sameType.findIndex((x) => x.id === l.id) + 1;
                const artCount = layers.filter((x) => x.type === "art").length;
                const idx = layers.findIndex((x) => x.id === l.id);
                const isFront = idx === layers.length - 1, isBack = idx === 0;
                const hint = layerColorHint(l);
                return (
                  <div key={l.id}
                    draggable
                    onDragStart={(e) => { dragLayerIdRef.current = l.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(l.id)); } catch (_) {} }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragLayerIdRef.current === l.id) { if (dropTarget) setDropTarget(null); return; } const r = e.currentTarget.getBoundingClientRect(); const where = (e.clientY - r.top) < r.height / 2 ? "above" : "below"; if (!dropTarget || dropTarget.id !== l.id || dropTarget.where !== where) setDropTarget({ id: l.id, where }); }}
                    onDrop={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const where = (e.clientY - r.top) < r.height / 2 ? "above" : "below"; dropOnLayer(l.id, where); setDropTarget(null); }}
                    onDragEnd={() => { dragLayerIdRef.current = null; setDropTarget(null); }}
                    onClick={() => setSelectedLayerId(l.id)}
                    className={"flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer " + (isSel ? "bg-indigo-50" : "bg-white hover:bg-neutral-50")}
                    style={{ borderLeft: `4px solid ${LAYER_ACCENT[l.type]}`, boxShadow: dropTarget && dropTarget.id === l.id ? (dropTarget.where === "above" ? "inset 0 3px 0 0 #4f46e5" : "inset 0 -3px 0 0 #4f46e5") : "none" }}>
                    <span className="text-neutral-300 px-1 cursor-grab" title="Drag to reorder">⠿</span>
                    <span className="w-4 h-4 rounded-sm border border-neutral-300 shrink-0 relative overflow-hidden bg-white" style={hint ? { backgroundColor: hint } : undefined}>
                      {l.type === "art" ? (
                        <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full p-0.5" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 4-2 4-4s-2-2-2-2" /><path d="M14 5l5 5L9 20l-5-1-1-4z" /></svg>
                      ) : !hint ? (
                        <svg viewBox="0 0 16 16" className="absolute inset-0 w-full h-full"><line x1="2" y1="14" x2="14" y2="2" stroke="#cbd5e1" strokeWidth="2" /></svg>
                      ) : null}
                    </span>
                    <span className={"text-xs font-medium truncate flex-1 " + (isSel ? "text-indigo-800" : "text-neutral-700")}>
                      {l.type === "art" ? `Artwork${artCount > 1 ? ` ${typeIndex}` : ""}` : `${LAYER_LABEL[l.type]}${sameType.length > 1 ? ` ${typeIndex}` : ""}`}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVisible(l.id); }} title={l.visible ? "Hide layer" : "Show layer"} className="text-neutral-400 hover:text-neutral-700 shrink-0">
                      {l.visible ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2 2.7M6 6.3A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 3.7-.8" /><path d="m2 2 20 20" /></svg>
                      )}
                    </button>
                    <div className="flex flex-col leading-none shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1); }} disabled={isFront} title="Move up" style={{ fontSize: "10px", lineHeight: 1 }} className={isFront ? "text-neutral-200" : "text-neutral-500 hover:text-neutral-800"}>▲</button>
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1); }} disabled={isBack} title="Move down" style={{ fontSize: "10px", lineHeight: 1 }} className={isBack ? "text-neutral-200" : "text-neutral-500 hover:text-neutral-800"}>▼</button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); duplicateLayer(l.id); }} title="Duplicate this layer" className="text-neutral-400 hover:text-indigo-600 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                    </button>
                    {canMergeDown(l) && (
                      <button onClick={(e) => { e.stopPropagation(); mergeDown(l.id); }} title="Merge down into the artwork below" className="text-neutral-400 hover:text-indigo-600 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" /></svg>
                      </button>
                    )}
                    {l.type === "art" && artCount <= 1 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" className="shrink-0"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} title="Delete layer" className="text-neutral-400 hover:text-red-600 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-neutral-400 mt-1">Top = front. Drag the handle or use ▲▼ to reorder; the eye hides a layer.</div>
          </div>

          {/* ---------- selected-layer editor ---------- */}
          {sel && sel.type === "art" && (
            <div className="text-xs rounded-md p-3 space-y-2 border" style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}>
              <div className="font-semibold uppercase tracking-wide" style={{ color: "#92400e" }}>Artwork layer</div>
              <div style={{ color: "#78350f" }}><b>Click/drag</b> to paint, <b>Shift-drag</b> for a rectangle. Pick <b>None</b> to erase to transparent.</div>
              <div className="flex gap-2">
                <button onClick={togglePick} title="Eyedropper — sample a cell's exact color"
                  className={"flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 bg-white " + (paintTool === "pick" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
                  Eyedropper
                </button>
                <button onClick={toggleGradient} title="Gradient — drag a multi-stop gradient"
                  className={"flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center " + (paintTool === "gradient" ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}
                  style={{ backgroundImage: `linear-gradient(to right, ${cssStops(gradStops)})` }}>
                  <span className="px-2 py-0.5 rounded bg-white text-neutral-800">Gradient</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wide shrink-0" style={{ color: "#92400e" }}>Shape</span>
                <select value={shapeKind} onChange={(e) => { setShapeKind(e.target.value); setPaintTool("shape"); }}
                  className="flex-1 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-xs text-neutral-800 focus:outline-none focus:border-neutral-500">
                  {SHAPE_KINDS.map(([v, lbl]) => (<option key={v} value={v}>{lbl}</option>))}
                </select>
                <button onClick={() => setPaintTool((t) => (t === "shape" ? "brush" : "shape"))} title="Toggle shape drawing"
                  className={"px-3 py-1.5 rounded-md border text-xs font-medium " + (paintTool === "shape" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50")}>Draw</button>
              </div>
              {paintTool === "gradient" && (
                <div className="rounded-md bg-white border border-amber-200 p-2 space-y-2">
                  <div style={{ color: "#78350f" }}>{gradStops.length >= 2 ? "Drag a rectangle on the grid to lay the gradient." : "Add at least 2 colors."}</div>
                  {gradientControls()}
                </div>
              )}
              {paintTool === "shape" && (
                <div className="rounded-md bg-white border border-amber-200 p-2 space-y-2">
                  <div style={{ color: "#78350f" }}>Drag on the grid to draw a {SHAPE_KINDS.find(([v]) => v === shapeKind)?.[1] || shapeKind}{eraseMode && shapeFill === "solid" ? " (erases to transparent)" : ""}. Hold <b>Shift</b> for a perfect square/circle.</div>
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wide" style={{ color: "#92400e" }}>Fill</span>
                    <button onClick={() => setShapeFill("solid")} className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (shapeFill === "solid" ? "ring-2 ring-indigo-500 border-indigo-500 text-indigo-700 bg-white" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50")}>
                      <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                      Solid
                    </button>
                    <button onClick={() => setShapeFill("gradient")} className={"px-2 py-1 rounded-md border text-xs font-medium " + (shapeFill === "gradient" ? "ring-2 ring-indigo-500 border-indigo-500" : "border-neutral-300")}
                      style={{ backgroundImage: `linear-gradient(to right, ${cssStops(gradStops)})` }}>
                      <span className="px-2 py-0.5 rounded bg-white text-neutral-800">Gradient</span>
                    </button>
                  </div>
                  {shapeFill === "gradient" && (gradStops.length >= 2 ? gradientControls() : <div style={{ color: "#78350f" }}>Add at least 2 colors below.</div>)}
                </div>
              )}
              {paintTool === "pick" && (<div style={{ color: "#78350f" }}>Click a cell to copy its exact color, then back to the brush.</div>)}
            </div>
          )}

          {sel && GRADIENT_TYPES.indexOf(sel.type) >= 0 && gradientPanel(sel)}
          {sel && sel.type === "glitters" && glittersPanel(sel)}
          {sel && sel.type === "electron" && electronPanel(sel)}
          {sel && sel.type === "flies" && fliesPanel(sel)}
          {sel && sel.type === "trace" && tracePanel(sel)}

          {sel && sel.type === "blink" && (
            <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
              <div className="font-semibold text-indigo-800 uppercase tracking-wide">Blink layer</div>
              <div className="text-indigo-900"><b>Click</b> a cell to toggle it; <b>drag</b> to paint, <b>Shift-drag</b> to erase.</div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-indigo-700 uppercase tracking-wide">Sequence</span>
                  <span className="font-mono text-indigo-500">{sel.sequence.length} / 32</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sel.sequence.length === 0 && (<span className="text-indigo-400">No steps — add at least one.</span>)}
                  {sel.sequence.map((step, i) => (
                    <button key={i} onClick={() => removeBlinkStep(i)} title="Remove this step"
                      className="w-7 h-7 rounded border border-neutral-300 bg-white flex items-center justify-center hover:border-red-400" style={step != null ? { backgroundColor: step } : undefined}>
                      {step == null && (<svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="#94a3b8" strokeWidth="2" /></svg>)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={addBlinkColor} disabled={sel.sequence.length >= 32}
                  className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + (sel.sequence.length >= 32 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                  <span className="w-3 h-3 rounded-sm border border-neutral-300" style={{ backgroundColor: currentColor }} />
                  + Color
                </button>
                <button onClick={addBlinkNone} disabled={sel.sequence.length >= 32}
                  className={"px-2 py-1 rounded-md border text-xs font-medium " + (sel.sequence.length >= 32 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                  + None
                </button>
              </div>
              {speedSlider(sel.stepFrames, (f) => setBlinkStepFrames(f), 60)}
              <div className="font-mono text-indigo-500">{sel.cells.size} cells</div>
              {sel.cells.size > 0 && (
                <button onClick={clearBlinkCells} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear cells</button>
              )}
              <div className="text-indigo-500">Each step holds for its frames; press <b>Play</b> to preview.</div>
            </div>
          )}

          {sel && sel.type === "snake" && (
            <div className="text-xs rounded-md bg-indigo-50 border border-indigo-200 p-3 space-y-3">
              <div className="font-semibold text-indigo-800 uppercase tracking-wide">Snake layer</div>
              <label className="flex items-center gap-1.5 text-indigo-700">
                <span className="uppercase tracking-wide">Size (cells)</span>
                <input type="number" min="1" max="64" value={sel.length} onChange={(e) => setSnakeLength(e.target.value)}
                  className="w-16 px-2 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-neutral-800 focus:outline-none focus:border-neutral-500" />
              </label>
              <div>
                <div className="text-indigo-700 uppercase tracking-wide mb-1">Body (head → tail)</div>
                <div className="flex flex-wrap gap-1">
                  {sel.colors.map((col, i) => (
                    <button key={i} onClick={() => setSnakeSegment(i)} title={`Segment ${i + 1}${i === 0 ? " (head)" : ""} — set to current color/None`}
                      className={"w-7 h-7 rounded border relative overflow-hidden bg-white " + (i === 0 ? "border-indigo-500 ring-1 ring-indigo-400" : "border-neutral-300 hover:border-indigo-400")}
                      style={col != null ? { backgroundColor: col } : undefined}>
                      {col == null && (<svg viewBox="0 0 28 28" className="absolute inset-0 w-full h-full"><line x1="4" y1="24" x2="24" y2="4" stroke="#ef4444" strokeWidth="2.5" /></svg>)}
                    </button>
                  ))}
                </div>
                <div className="text-indigo-500 mt-1">Click a segment to paint it with the current color (or <b>None</b>).</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={fillSnakeBody} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                  Fill solid
                </button>
              </div>
              <div className="rounded-md bg-white border border-indigo-200 p-2 space-y-2">
                <div className="text-indigo-700 uppercase tracking-wide">Body gradient</div>
                <div className="h-3 rounded" style={{ backgroundImage: `linear-gradient(to right, ${cssStops(sel.bodyStops || [currentColor, "#1e1b4b"])})`, border: "1px solid #e5e5e5" }} />
                <div className="flex flex-wrap gap-1">
                  {(sel.bodyStops || []).map((col, i) => (
                    <button key={i} draggable
                      onDragStart={() => { dragSwatchRef.current = { kind: "snake", i }; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { const s = dragSwatchRef.current; if (s && s.kind === "snake" && s.i !== i) updateSelectedLayer((st) => ({ ...st, bodyStops: arrMove(st.bodyStops || [], s.i, i) })); dragSwatchRef.current = null; }}
                      onClick={() => removeSnakeStop(i)} title={(sel.bodyStops || []).length <= 2 ? "At least 2 stops" : (col === "none" ? "Transparent · drag to reorder · click to remove" : "Drag to reorder · click to remove")}
                      className="w-7 h-7 rounded border border-neutral-300 hover:border-red-400" style={{ ...swatchStyle(col), cursor: "grab" }} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={addSnakeStop} disabled={(sel.bodyStops || []).length >= 16}
                    className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + ((sel.bodyStops || []).length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                    <span className="w-3 h-3 rounded-sm border border-neutral-300" style={eraseMode ? undefined : { backgroundColor: currentColor }} />
                    + Color
                  </button>
                  <button onClick={() => updateSelectedLayer((s) => ((s.bodyStops || []).length >= 16 ? s : { ...s, bodyStops: [...(s.bodyStops || []), "none"] }))} disabled={(sel.bodyStops || []).length >= 16} title="Add a transparent stop"
                    className={"px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 " + ((sel.bodyStops || []).length >= 16 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                    <span className="w-3 h-3 rounded-sm border border-neutral-300" style={NONE_CHIP} />
                    + None
                  </button>
                  <button onClick={() => updateSelectedLayer((s) => ({ ...s, bodyStops: RAINBOW.slice() }))} className="px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-800 hover:opacity-90"
                    style={{ backgroundImage: "linear-gradient(to right, #ff0000,#ffaa00,#ffff00,#00cc00,#00bccc,#0066ff,#7a00ff,#ff00aa)" }}>
                    <span className="px-1 rounded bg-white">Rainbow</span>
                  </button>
                  <button onClick={fadeSnakeBody} className="px-2 py-1 rounded-md border border-indigo-300 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">Apply to body</button>
                </div>
              </div>
              {speedSlider(sel.speed, (f) => setSnakeSpeed(f), 30, 0.5)}
              <div className="rounded-md bg-white border border-indigo-200 p-2 space-y-2">
                <label className="flex items-center gap-2 text-indigo-700 cursor-pointer">
                  <input type="checkbox" checked={!!sel.electric} onChange={(e) => updateSelectedLayer((s) => ({ ...s, electric: e.target.checked }))} style={{ accentColor: "#4f46e5" }} />
                  <span className="uppercase tracking-wide">Electric</span>
                  <span className="text-indigo-400">{sel.electric ? "arcs haywire now and then" : "steady"}</span>
                </label>
                {sel.electric && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-700 uppercase tracking-wide">Arc color</span>
                      <button onClick={() => updateSelectedLayer((s) => ({ ...s, electricColor: eraseMode ? "#bfefff" : currentColor }))} title="Set the arc/lightning color to the current swatch"
                        className="w-6 h-6 rounded border border-neutral-300" style={{ backgroundColor: sel.electricColor || "#bfefff" }} />
                    </div>
                    <label className="flex items-center gap-1.5 text-indigo-700"><span className="uppercase tracking-wide">Bursts / loop</span>
                      <input type="number" min="1" max="8" value={sel.arcBursts == null ? 3 : sel.arcBursts} onChange={(e) => updateSelectedLayer((s) => ({ ...s, arcBursts: clamp(parseInt(e.target.value, 10) || 1, 1, 8) }))}
                        className="w-12 px-1 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-center text-neutral-800 focus:outline-none focus:border-neutral-500" />
                    </label>
                  </div>
                )}
                {sel.electric && (
                  <label className="flex items-center gap-2 text-indigo-700"><span className="uppercase tracking-wide">Arc size</span>
                    <input type="range" min="1" max="10" value={sel.arcSize == null ? 3 : sel.arcSize} onChange={(e) => updateSelectedLayer((s) => ({ ...s, arcSize: clamp(parseInt(e.target.value, 10) || 1, 1, 10) }))} className="flex-1" style={{ accentColor: "#4f46e5" }} title="how far the bolt reaches and how wildly the body jitters" />
                    <span className="font-mono text-indigo-500 w-6 text-right">{sel.arcSize == null ? 3 : sel.arcSize}</span>
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-indigo-500">{sel.path.length > 0 ? `path: ${sel.path.length} cells` : "no path — drag on the grid"}</span>
                {sel.path.length > 0 && (<button onClick={clearSnakePath} className="ml-auto px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100">Clear path</button>)}
              </div>
              <div className="text-indigo-600"><b>Drag</b> on the grid to draw the path the snake follows. The head leads; the body trails behind.</div>
            </div>
          )}
        </div>

        {/* ----------------- canvas + dimensions ----------------- */}
        <div className="w-full lg:flex-1 space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className={labelCls}>Width (px)</label>
              <input type="number" min="1" value={inputW} onChange={(e) => setInputW(e.target.value)} className="w-24 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono focus:outline-none focus:border-neutral-500" />
            </div>
            <span className="pb-2 text-neutral-400">×</span>
            <div>
              <label className={labelCls}>Height (px)</label>
              <input type="number" min="1" value={inputH} onChange={(e) => setInputH(e.target.value)} className="w-24 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-mono focus:outline-none focus:border-neutral-500" />
            </div>
            <button onClick={applyDims} className="px-4 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors">Apply</button>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => undoRef.current()} disabled={undoCount === 0} title="Undo (Ctrl/Cmd+Z)"
                className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center gap-1.5 " + (undoCount === 0 ? "border-neutral-200 text-neutral-300 bg-neutral-50 cursor-not-allowed" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                Undo
              </button>
              <button onClick={exportPng} title="Export the flattened stack as a PNG" className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-100 transition-colors flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
                Export PNG
              </button>
              <button onClick={exportGif} disabled={isExporting} title="Export as animated GIF at real pixel size"
                className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center gap-1.5 " + (isExporting ? "border-neutral-200 text-neutral-400 bg-neutral-50 cursor-wait" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" /></svg>
                {isExporting ? "Exporting…" : "Export GIF"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs uppercase tracking-wide text-neutral-500 shrink-0">Design</label>
            <input value={designText} onChange={(e) => setDesignText(e.target.value)} placeholder="paste a design code here to import…" spellCheck={false}
              className="flex-1 px-2 py-1.5 rounded-md border border-neutral-300 bg-white text-xs font-mono text-neutral-700 focus:outline-none focus:border-neutral-500" style={{ minWidth: "12rem" }} />
            <button onClick={copyDesign}
              title="Encode the whole design (size, fps, every layer + its parameters, artwork pixels) and copy it to the clipboard"
              className={"px-3 py-1.5 rounded-md border text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5 " + (copiedDesign ? "border-green-400 text-green-700 bg-green-50" : "border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-100")}>
              {copiedDesign ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              )}
              {copiedDesign ? "Copied!" : "Copy"}
            </button>
            <button onClick={() => { if (applyDesign(designText)) setError(""); else setError("Couldn't read that design code."); }}
              title="Rebuild the design from the code in the box"
              className="px-3 py-1.5 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-100 transition-colors shrink-0">Import</button>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}

          <div className="flex items-center gap-3 flex-wrap rounded-lg border border-neutral-200 bg-white px-3 py-2">
            <button onClick={togglePlay} title={isPlaying ? "Pause preview" : "Play preview"}
              className={"px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors " + (isPlaying ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-neutral-900 text-white hover:bg-neutral-700")}>
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="uppercase tracking-wide">FPS</span>
              <input type="number" min="1" max="60" value={fps} onChange={(e) => setFps(clamp(parseInt(e.target.value, 10) || 1, 1, 60))}
                className="w-16 px-2 py-1 rounded-md border border-neutral-300 bg-white text-sm font-mono text-neutral-800 focus:outline-none focus:border-neutral-500" />
            </label>
            <span className="font-mono text-xs text-neutral-500">Frame {frameInfo.i + 1} / {frameInfo.n}</span>
            {isPlaying ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-indigo-600"><span className="w-2 h-2 rounded-full bg-indigo-500" />Preview — editing paused</span>
            ) : frameInfo.n > 1 ? (
              <span className="ml-auto text-xs text-neutral-500">{frameInfo.n}-frame loop ready</span>
            ) : (
              <span className="ml-auto text-xs text-neutral-400">Single still frame — add an effect layer to animate.</span>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-4 flex items-center justify-center" style={{ minHeight: "260px" }}>
            <div ref={containerRef} className="w-full flex items-center justify-center">
              <canvas ref={canvasRef}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={onPointerLeave}
                className="bg-white shadow-sm" style={{ touchAction: "none", cursor: "crosshair", imageRendering: "pixelated" }} />
            </div>
          </div>

          <div className="text-xs text-neutral-600 leading-relaxed">
            <div className="font-semibold text-neutral-700 uppercase tracking-wide mb-1">How to use</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Everything is a <b>layer</b> in one stack. The top row renders in front; the back row is behind. Each layer is opaque where it has content and transparent elsewhere, so lower layers show through the gaps.</li>
              <li>Reorder by dragging a row's handle or with the <b>▲▼</b> buttons, including moving the <b>Artwork</b> layer in front of or behind effects.</li>
              <li>Add as many <b>Artwork</b> (paint) layers as you like with <b>+ Artwork</b>; each holds its own pixels. Every row has a <b>duplicate</b> button (exact copy, pixels and all); an artwork row's down-arrow <b>merges it into the artwork below</b>. The eye hides a layer, the trash deletes it (the last remaining artwork stays).</li>
              <li>Select a layer to edit it: an <b>Artwork</b> layer paints (brush, Shift-drag rectangle, <b>Shapes</b> — rectangle, ellipse, triangle, diamond, star, heart — filled with the current color or a gradient, the <b>Gradient</b> rectangle tool, <b>None</b> to erase); every effect layer drags a <b>rectangle</b> for its area (Snake draws a path, Blink toggles cells).</li>
              <li>The <b>Eyedropper</b> (next to the Hex field) samples any cell's on-screen color — effects included — into the current swatch.</li>
              <li>Effects: <b>Sweep</b> scrolls a gradient, <b>Rotate</b> spins it, <b>Pulse</b> throbs a radial gradient like a heartbeat, <b>Radiates</b> streams in/out of the center, <b>Cascade</b> is a directional waterfall, <b>Trace</b> streams particles with fading trails (with a <b>Horizon</b> pile-up mode), <b>Glitters</b> twinkle, <b>Electron</b> dots orbit, <b>Flies</b> wander, plus <b>Blink</b> and <b>Snake</b> (which has an <b>Electric</b> mode that arcs haywire now and then).</li>
              <li>Every gradient effect has a <b>Particles</b> toggle (smooth fill ⇄ scattered dots that sample the gradient) with a Density control, and a <b>Speed</b> slider (slow ⇄ fast; raise FPS for faster playback). Reorder any color or gradient stop by <b>dragging its swatch</b>; click a swatch to remove it.</li>
              <li>Build a reusable <b>Custom</b> palette: drag the big color swatch onto it (or press +); click a swatch to use it, the small × removes it. Name it and hit <b>Save</b> to store it; the <b>palette icon</b> by the Palette header opens a dropdown of your saved palettes, which persist across sessions.</li>
              <li>Any effect or gradient can include a <b>+ None</b> stop (transparent): the gradient fades to nothing there, so you can punch holes or fade trails out to clear.</li>
              <li><b>Design</b> (top of the right panel) encodes the whole piece — size, FPS, every layer with its parameters in a fixed order, and the artwork pixels — into one code. <b>Copy current</b> puts it on your clipboard; paste a code in the box and <b>Import</b> to rebuild it exactly.</li>
              <li>The canvas starts transparent (checkerboard). <b>Play</b> previews the loop; <b>Export GIF</b> writes it at real pixel size (random effects loop seamlessly), <b>Export PNG</b> flattens the stack. Reorder rows by dragging the handle or with <b>▲▼</b>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
