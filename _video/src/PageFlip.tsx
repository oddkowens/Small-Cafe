import React from "react";
import { AbsoluteFill } from "remotion";

// A page peeling from the top-right corner towards the bottom-left, the way
// the Resolve "page curl" transition looks. `progress` 0 → 1.
//
// Geometry: the fold is a line perpendicular to the diagonal direction D,
// sitting at distance `s` from the top-right corner. Everything the fold has
// passed is peeled away (revealing what's underneath); the peeled part is
// drawn folded back over the page as the flap.

type Pt = [number, number];
const D: Pt = [-Math.SQRT1_2, Math.SQRT1_2];
const CURL = 190; // px of page visible rolled over the fold

const along = (p: Pt, corner: Pt) => (p[0] - corner[0]) * D[0] + (p[1] - corner[1]) * D[1];

// Sutherland–Hodgman: keep the part of `poly` where keep(t) holds, t = along().
function clip(poly: Pt[], corner: Pt, s: number, keepBeyond: boolean): Pt[] {
  const inside = (p: Pt) => (keepBeyond ? along(p, corner) >= s : along(p, corner) <= s);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ta = along(a, corner) - s;
    const tb = along(b, corner) - s;
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const k = ta / (ta - tb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

const reflect = (p: Pt, corner: Pt, s: number): Pt => {
  const d = 2 * (s - along(p, corner));
  return [p[0] + d * D[0], p[1] + d * D[1]];
};

const toCss = (poly: Pt[]) => `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})`;
const toSvg = (poly: Pt[]) => poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export const PageFlip: React.FC<{
  progress: number;
  width: number;
  height: number;
  front: React.ReactNode;
  back: React.ReactNode;
}> = ({ progress, width, height, front, back }) => {
  const corner: Pt = [width, 0];
  const square: Pt[] = [[0, 0], [width, 0], [width, height], [0, height]];
  const full = (width + height) * Math.SQRT1_2; // fold distance where the page is gone
  const s = progress * full * 1.02;

  const kept = clip(square, corner, s, true);
  // Only the strip of page just behind the fold is drawn folded back — a curl
  // of width CURL rather than a flat sheet the size of everything peeled.
  const curl = Math.min(CURL, s);
  const strip = clip(clip(square, corner, s, false), corner, s - curl, true);
  const flap = clip(strip.map((p) => reflect(p, corner, s)), corner, s, true);

  // Fold line and the curl's outer edge, for the shading gradient direction.
  const fold: Pt = [corner[0] + D[0] * s, corner[1] + D[1] * s];
  const flapEnd: Pt = [corner[0] + D[0] * (s + curl), corner[1] + D[1] * (s + curl)];

  return (
    <AbsoluteFill>
      <AbsoluteFill>{back}</AbsoluteFill>
      {kept.length > 2 && (
        <AbsoluteFill style={{ clipPath: toCss(kept) }}>
          {front}
        </AbsoluteFill>
      )}
      {flap.length > 2 && s > 0 && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="flap" gradientUnits="userSpaceOnUse" x1={fold[0]} y1={fold[1]} x2={flapEnd[0]} y2={flapEnd[1]}>
              <stop offset="0" stopColor="#9c7f4c" />
              <stop offset="0.25" stopColor="#e9d8b0" />
              <stop offset="0.65" stopColor="#fbf2dc" />
              <stop offset="1" stopColor="#c9b284" />
            </linearGradient>
            <filter id="flapShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="-10" dy="14" stdDeviation="14" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>
          <polygon points={toSvg(flap)} fill="url(#flap)" filter="url(#flapShadow)" />
        </svg>
      )}
    </AbsoluteFill>
  );
};
