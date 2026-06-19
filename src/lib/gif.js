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

export { encodeGIF };
