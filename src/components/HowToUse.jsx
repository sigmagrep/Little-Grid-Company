import React from "react";

export default function HowToUse() {
  return (
    <>
          <details className="text-xs text-neutral-600 leading-relaxed">
            <summary className="font-semibold text-neutral-700 uppercase tracking-wide mb-1 cursor-pointer select-none">How to use</summary>
            <ul className="list-disc pl-5 space-y-1 mt-1">
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
          </details>
    </>
  );
}
