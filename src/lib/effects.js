import { hexToRgb, lerpHex, clamp, withAlpha } from "./color.js";

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

export { SWEEP_DIRS, RAINBOW, mixStop, sampleCyclicGradient, renderSweep, renderRotate, gcdInt, snakeHead, snakePeriod, renderSnake, hash01, hash2, hash3, sampleGradientLinear, heartbeat, pointInPoly, SHAPE_KINDS, shapeMaskTest, rectBounds, particleCount, renderPulse, renderRadiates, renderCascade, traceColor, renderTrace, renderGlitters, renderElectron, renderFlies };
