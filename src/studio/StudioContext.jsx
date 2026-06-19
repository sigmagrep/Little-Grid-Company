import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { hsvToHex, makeImageData, blendPx, parseColorRGBA, hexToRgba, clamp, rgbToHex, hexToHsv, hexToRgb, rgbToCmyk, cmykToRgb, rgbToHsv } from "../lib/color.js";
import { renderSweep, renderRotate, renderPulse, renderRadiates, renderCascade, renderTrace, renderGlitters, renderElectron, renderFlies, renderSnake, SWEEP_DIRS, sampleGradientLinear, shapeMaskTest, RAINBOW, heartbeat, snakePeriod, SHAPE_KINDS } from "../lib/effects.js";
import { encodeGIF } from "../lib/gif.js";
import { PALETTE } from "../lib/constants.js";

const StudioContext = createContext(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within <StudioProvider>");
  return ctx;
}

export function StudioProvider({ children }) {
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
    try { if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem("palettes:list", JSON.stringify(list)); } catch (_) {}
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
        if (typeof window !== "undefined" && window.localStorage) {
          const raw = window.localStorage.getItem("palettes:list");
          if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) setSavedPalettes(arr); }
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

  const value = {
    ART_ID, LAYER_LABEL, LAYER_ACCENT, GRADIENT_TYPES, EFFECT_TYPES, DESIGN_KEYS, labelCls, NONE_CHIP, swatchStyle, cssStops, fieldCls, dpr,
    PALETTE, RAINBOW, SHAPE_KINDS, SWEEP_DIRS, clamp,
    dims, setDims, inputW, setInputW, inputH, setInputH, hsv, setHsv, paintTool, setPaintTool, shapeKind, setShapeKind, shapeFill, setShapeFill, gradStops, setGradStops, gradDir, setGradDir, hexField, setHexField, error, setError, eraseMode, setEraseMode, recent, setRecent, customPalette, setCustomPalette, savedPalettes, setSavedPalettes, activeSaved, setActiveSaved, paletteMenuOpen, setPaletteMenuOpen, designText, setDesignText, paletteName, setPaletteName, copiedDesign, setCopiedDesign, paletteDragOver, setPaletteDragOver, undoCount, setUndoCount, layers, setLayers, selectedLayerId, setSelectedLayerId, dropTarget, setDropTarget, isPlaying, setIsPlaying, fps, setFps, frameInfo, setFrameInfo, isExporting, setIsExporting,
    currentColor, rgbNow, cmyk, sel,
    canvasRef, bufferRef, buffersRef, containerRef, dragRef, hoverRef, historyRef, pendingSnapRef, playingRef, rafRef, framesRef, frameIdxRef, lastTsRef, fpsRef, checkerRef, layersRef, selectedLayerIdRef, paintToolRef, idRef, dragLayerIdRef, dragSwatchRef, dimsRef, colorRef, gradStopsRef, gradDirRef, scratchRef, undoRef, svRef, svDrag, hueRef, hueDrag,
    genId, selectedLayer, artLayer, updateLayer, updateSelectedLayer, selectArtLayer, getArtBuffer, artLayerCount, defaultLayer, addLayer, deleteLayer, canMergeDown, mergeDown, cloneLayer, duplicateLayer, arrMove, toggleLayerVisible, moveLayer, dropOnLayer, isRectEffect, layerColorHint, getChecker, getScratch, blendLayerInto, compositeFrameCanvas, previewLayers, drawCanvas, resizeAndDraw, paintCell, paintLine, fillRect, applyGradient, gradProjector, forEachShapeCell, takeSnapshot, commitSnapshot, undo, rememberColor, addCustomColor, removeCustomColor, persistPalettes, saveCustomPalette, deleteSavedPalette, serializeDesign, copyDesign, applyDesign, pickAt, exportPng, selectPaletteColor, selectNone, toggleGradient, togglePick, addGradStop, removeGradStop, svUpdate, hueUpdate, setCmyk, onHexChange, applyDims, addBlinkColor, addBlinkNone, removeBlinkStep, setBlinkStepFrames, clearBlinkCells, blinkStroke, setSnakeLength, setSnakeSegment, fillSnakeBody, fadeSnakeBody, addSnakeStop, removeSnakeStop, moveSnakeStop, setSnakeSpeed, clearSnakePath, lcm, layerPeriod, animationFrameCount, computeFrames, tick, startPlayback, stopPlayback, togglePlay, exportGif, getCell, onPointerDown, onPointerMove, endDrag, onPointerLeave,
    gradientControls,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
