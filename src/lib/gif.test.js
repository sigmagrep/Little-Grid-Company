import { describe, it, expect } from "vitest";
import { encodeGIF } from "./gif.js";

const header = (bytes) => String.fromCharCode(...bytes.slice(0, 6));

describe("encodeGIF", () => {
  it("emits a well-formed GIF89a", () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]);
    const bytes = encodeGIF(2, 2, [{ rgba, delayMs: 100 }], 0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(header(bytes)).toBe("GIF89a");
    expect(bytes[bytes.length - 1]).toBe(0x3b); // trailer
    expect(bytes[6]).toBe(2); // logical screen width low byte
    expect(bytes[8]).toBe(2); // height low byte
  });

  it("handles transparency (alpha < 128) without throwing", () => {
    const rgba = new Uint8ClampedArray([
      10, 20, 30, 255, 0, 0, 0, 0, // second pixel fully transparent
      40, 50, 60, 255, 70, 80, 90, 255,
    ]);
    const bytes = encodeGIF(2, 2, [{ rgba, delayMs: 80 }], 0);
    expect(header(bytes)).toBe("GIF89a");
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });

  it("encodes a multi-frame animation", () => {
    const f = (v) => ({ rgba: new Uint8ClampedArray([v, v, v, 255, v, v, v, 255, v, v, v, 255, v, v, v, 255]), delayMs: 100 });
    const bytes = encodeGIF(2, 2, [f(0), f(128), f(255)], 0);
    expect(header(bytes)).toBe("GIF89a");
    // NETSCAPE2.0 looping extension must be present for a looping animation
    const ascii = String.fromCharCode(...bytes);
    expect(ascii.includes("NETSCAPE2.0")).toBe(true);
  });
});
