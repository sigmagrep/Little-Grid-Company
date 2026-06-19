import { describe, it, expect } from "vitest";
import {
  hash01, hash2, hash3, sampleCyclicGradient, sampleGradientLinear, mixStop,
  shapeMaskTest, rectBounds, particleCount, gcdInt, snakePeriod, heartbeat,
  renderSweep, renderRotate, renderPulse, renderRadiates, renderCascade,
  renderTrace, renderGlitters, renderElectron, renderFlies, renderSnake,
} from "./effects.js";
import { parseColorRGBA } from "./color.js";

// collect a frame's setPixel writes into a deterministic map ("c,r" -> color)
function frameMap(renderFn, layer, frame) {
  const m = new Map();
  renderFn(layer, frame, (c, r, color) => { m.set(c + "," + r, color); });
  return m;
}
// exact pixel-for-pixel equality (used for determinism)
function mapsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}
// same cells, colors equal within a rounding tolerance — the right notion of a
// seamless loop (frame `period` is conceptually frame 0; sub-LSB float wrap is fine).
function mapsClose(a, b, tol = 2) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k)) return false;
    const p = parseColorRGBA(v) || [0, 0, 0, 0];
    const q = parseColorRGBA(b.get(k)) || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) if (Math.abs(p[i] - q[i]) > tol) return false;
  }
  return true;
}

describe("hashes", () => {
  it("are deterministic and in [0,1)", () => {
    for (const [a, b] of [[1, 2], [99, 7], [0, 0], [12345, 678]]) {
      const h = hash2(a, b);
      expect(h).toBe(hash2(a, b));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    expect(hash01(42)).toBe(hash01(42));
    expect(hash3(1, 2, 3)).toBe(hash3(1, 2, 3));
  });
  it("differ across inputs", () => {
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
  });
});

describe("gradient sampling", () => {
  it("single color is returned as-is", () => expect(sampleCyclicGradient(["#ff0000"], 0.37)).toBe("#ff0000"));
  it("['none'] is transparent", () => expect(sampleCyclicGradient(["none"], 0.5)).toBe("rgba(0,0,0,0)"));
  it("cyclic phase 0 hits the first stop", () => expect(sampleCyclicGradient(["#000000", "#ffffff"], 0)).toBe("#000000"));
  it("cyclic wraps (phase 1 === phase 0)", () =>
    expect(sampleCyclicGradient(["#112233", "#445566"], 1)).toBe(sampleCyclicGradient(["#112233", "#445566"], 0)));
  it("linear clamps to endpoints", () => {
    expect(sampleGradientLinear(["#000000", "#ffffff"], -1)).toBe("#000000");
    expect(sampleGradientLinear(["#000000", "#ffffff"], 2)).toBe("#ffffff");
  });
  it("mixStop fades to transparent for 'none'", () => {
    expect(mixStop("none", "none", 0.5)).toBe("rgba(0,0,0,0)");
    expect(mixStop("none", "#ffffff", 1)).toBe("rgba(255,255,255,1)");
  });
});

describe("geometry helpers", () => {
  it("rectBounds normalizes corners", () =>
    expect(rectBounds({ c0: 5, r0: 8, c1: 1, r1: 2 })).toEqual({ x0: 1, x1: 5, y0: 2, y1: 8 }));
  it("particleCount scales with area & density", () => {
    expect(particleCount({ c0: 0, r0: 0, c1: 9, r1: 9 }, 100)).toBe(100); // 10x10 area, density 100
    expect(particleCount({ c0: 0, r0: 0, c1: 0, r1: 0 }, 12)).toBeGreaterThanOrEqual(1);
  });
  it("gcd / snake period", () => {
    expect(gcdInt(12, 8)).toBe(4);
    expect(snakePeriod(12, 2)).toBe(24); // speed>=1 -> L*round(speed)
  });
});

describe("shapeMaskTest", () => {
  it("rectangle covers everything", () => {
    const t = shapeMaskTest("rectangle");
    expect(t(0, 0)).toBe(true);
    expect(t(0.5, 0.9)).toBe(true);
  });
  it("ellipse: center in, corner out", () => {
    const t = shapeMaskTest("ellipse");
    expect(t(0.5, 0.5)).toBe(true);
    expect(t(0, 0)).toBe(false);
  });
  it("diamond: center in, corner out", () => {
    const t = shapeMaskTest("diamond");
    expect(t(0.5, 0.5)).toBe(true);
    expect(t(0.05, 0.05)).toBe(false);
  });
});

describe("heartbeat envelope", () => {
  it("is ~0 at the ends and rests near the loop end", () => {
    expect(heartbeat(0)).toBeCloseTo(0, 5);
    expect(heartbeat(0.95)).toBe(0);
    expect(heartbeat(0.07)).toBeGreaterThan(0); // rising during attack
  });
});

// The core animation guarantee: every effect loops seamlessly, i.e. the pixels
// drawn at frame 0 are identical to those at frame = period.
describe("effects loop seamlessly (frame 0 === frame period)", () => {
  const rect = { c0: 0, r0: 0, c1: 9, r1: 9 };
  const colors = ["#00bfff", "#ff00ff", "#ffff00"];

  const cases = [
    ["sweep (smooth)", renderSweep, { rect, colors, dir: "SE", cycleFrames: 8, bands: 1, particles: false, seed: 11 }, 8],
    ["sweep (particles)", renderSweep, { rect, colors, dir: "SE", cycleFrames: 8, bands: 1, particles: true, density: 30, seed: 11 }, 8],
    ["rotate", renderRotate, { rect, colors, dir: "CW", cycleFrames: 12, bands: 1, particles: false, seed: 5 }, 12],
    ["pulse", renderPulse, { rect, colors, cycleFrames: 10, bands: 1, particles: false, seed: 3 }, 10],
    ["radiates", renderRadiates, { rect, colors, dir: "out", cycleFrames: 9, bands: 2, particles: false, seed: 7 }, 9],
    ["cascade", renderCascade, { rect, colors, dir: "S", cycleFrames: 14, bands: 1, particles: false, seed: 2 }, 14],
    ["trace", renderTrace, { rect, colors, shape: "rect", dir: "E", cycleFrames: 10, density: 25, trailLen: 4, trailFade: 0.85, seed: 9 }, 10],
    ["glitters", renderGlitters, { rect, colors, cycleFrames: 3, steps: 5, density: 40, seed: 7 }, 15], // period = cycleFrames*steps
    ["electron", renderElectron, { rect, colors, cycleFrames: 10, count: 3, seed: 5 }, 10],
    ["flies", renderFlies, { rect, colors, cycleFrames: 12, count: 8, turns: 4, seed: 9 }, 12],
  ];

  for (const [name, fn, layer, period] of cases) {
    it(name, () => {
      const f0 = frameMap(fn, layer, 0);
      const fp = frameMap(fn, layer, period);
      expect(f0.size).toBeGreaterThan(0);
      expect(mapsClose(f0, fp)).toBe(true);
    });
  }

  it("snake", () => {
    const path = Array.from({ length: 12 }, (_, i) => ({ c: i % 10, r: Math.floor(i / 10) }));
    const layer = { path, length: 4, colors: ["#fff", "#ddd", "#bbb", "#999"], speed: 2, seed: 1 };
    const period = snakePeriod(path.length, layer.speed);
    expect(mapsClose(frameMap(renderSnake, layer, 0), frameMap(renderSnake, layer, period))).toBe(true);
  });
});

describe("effects are deterministic", () => {
  it("same layer + frame -> identical pixels", () => {
    const layer = { rect: { c0: 0, r0: 0, c1: 7, r1: 7 }, colors: ["#fff", "#0ff"], cycleFrames: 8, count: 30, turns: 5, seed: 42 };
    expect(mapsEqual(frameMap(renderFlies, layer, 3), frameMap(renderFlies, layer, 3))).toBe(true);
  });
});
