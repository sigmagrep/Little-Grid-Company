import { describe, it, expect } from "vitest";
import {
  clamp, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hsvToHex, hexToHsv,
  rgbToCmyk, cmykToRgb, lerpHex, hexToRgba, withAlpha, parseColorRGBA, blendPx,
} from "./color.js";

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("hex <-> rgb", () => {
  it("parses 6-digit hex", () => expect(hexToRgb("#ff8800")).toEqual({ r: 255, g: 136, b: 0 }));
  it("expands 3-digit hex", () => expect(hexToRgb("#f80")).toEqual({ r: 255, g: 136, b: 0 }));
  it("round-trips", () => {
    for (const c of ["#000000", "#ffffff", "#3b82f6", "#abcdef"]) {
      const { r, g, b } = hexToRgb(c);
      expect(rgbToHex(r, g, b)).toBe(c);
    }
  });
  it("rgbToHex clamps and zero-pads", () => {
    expect(rgbToHex(0, 5, 300)).toBe("#0005ff");
    expect(rgbToHex(-10, 16, 16)).toBe("#001010");
  });
});

describe("hsv round-trip", () => {
  const near = (a, b, t = 1) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    expect(Math.abs(A.r - B.r)).toBeLessThanOrEqual(t);
    expect(Math.abs(A.g - B.g)).toBeLessThanOrEqual(t);
    expect(Math.abs(A.b - B.b)).toBeLessThanOrEqual(t);
  };
  it("hex -> hsv -> hex recovers the color (±1)", () => {
    for (const c of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#123456", "#abcdef", "#808080"]) {
      near(hsvToHex(hexToHsv(c)), c);
    }
  });
});

describe("cmyk", () => {
  it("converts pure red", () => expect(rgbToCmyk(255, 0, 0)).toEqual({ c: 0, m: 100, y: 100, k: 0 }));
  it("converts black via k=100", () => expect(rgbToCmyk(0, 0, 0)).toEqual({ c: 0, m: 0, y: 0, k: 100 }));
  it("cmykToRgb inverts red", () => {
    const { r, g, b } = cmykToRgb(0, 100, 100, 0);
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([255, 0, 0]);
  });
});

describe("lerpHex / hexToRgba", () => {
  it("midpoint of black->white is mid-gray", () => expect(lerpHex("#000000", "#ffffff", 0.5)).toBe("#808080"));
  it("endpoints are exact", () => {
    expect(lerpHex("#102030", "#a0b0c0", 0)).toBe("#102030");
    expect(lerpHex("#102030", "#a0b0c0", 1)).toBe("#a0b0c0");
  });
  it("hexToRgba formats", () => expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)"));
});

describe("withAlpha", () => {
  it("hex -> rgba with alpha", () => expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)"));
  it("multiplies an existing rgba alpha", () => expect(withAlpha("rgba(0,0,0,0.5)", 0.5)).toBe("rgba(0,0,0,0.25)"));
  it("nullish -> transparent", () => expect(withAlpha(null, 0.5)).toBe("rgba(0,0,0,0)"));
});

describe("parseColorRGBA", () => {
  it("6-digit hex", () => expect(parseColorRGBA("#ff8800")).toEqual([255, 136, 0, 255]));
  it("3-digit hex", () => expect(parseColorRGBA("#f80")).toEqual([255, 136, 0, 255]));
  it("rgb()", () => expect(parseColorRGBA("rgb(1,2,3)")).toEqual([1, 2, 3, 255]));
  it("rgba() rounds alpha to 0-255", () => expect(parseColorRGBA("rgba(1,2,3,0.5)")).toEqual([1, 2, 3, 128]));
  it("'none' and empty -> null", () => {
    expect(parseColorRGBA("none")).toBeNull();
    expect(parseColorRGBA("")).toBeNull();
  });
});

describe("blendPx", () => {
  it("opaque source overwrites the pixel", () => {
    const d = new Uint8ClampedArray(4);
    blendPx(d, 0, 10, 20, 30, 255);
    expect([...d]).toEqual([10, 20, 30, 255]);
  });
  it("zero alpha is a no-op", () => {
    const d = new Uint8ClampedArray([5, 6, 7, 8]);
    blendPx(d, 0, 1, 2, 3, 0);
    expect([...d]).toEqual([5, 6, 7, 8]);
  });
  it("blends source-over onto opaque", () => {
    const d = new Uint8ClampedArray([0, 0, 0, 255]); // opaque black
    blendPx(d, 0, 255, 255, 255, 128); // ~50% white
    expect(d[3]).toBe(255);
    expect(Math.abs(d[0] - 128)).toBeLessThanOrEqual(2);
  });
});
