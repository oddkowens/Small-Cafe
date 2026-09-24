import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadArimo } from "@remotion/google-fonts/Arimo";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { measureText } from "@remotion/layout-utils";
import { PageFlip } from "./PageFlip";
import { ThemeLayer } from "./themes";

const arimo = loadArimo("normal", { weights: ["400"], subsets: ["latin"] });
const bodyFont = arimo.fontFamily;
const { fontFamily: buttonFont } = loadMontserrat("normal", { weights: ["700"], subsets: ["latin"] });

export type ClipProps = {
  summary: string; // text on the book's left page
  photo: string; // dish photo (path under public/)
  cover: string | null; // book cover
  audio: string | null;
  audioStartFrame?: number; // where in the audio the clip begins
  sticker: string | null; // optional themed sticker (PNG with transparency)
  emoji: string[]; // decoration pictures (Fluent Emoji 3D), most relevant first
  theme: string;
  durationInFrames: number;
};

const NAVY = "#1f2a44";
const GOLD = "#b8862b";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Scene timings as fractions of the clip, matched to Ellen's edits: cover for
// the first quarter, the dish until halfway, then the page flip to the book.
const timeline = (total: number, fps: number, hasCover: boolean) => {
  const flipStart = Math.round(total * 0.5);
  const flipFrames = Math.round(fps * 0.9);
  return {
    coverStart: Math.round(fps * 0.2),
    dishStart: hasCover ? Math.round(total * 0.25) : Math.round(fps * 0.2),
    flipStart,
    flipEnd: flipStart + flipFrames,
  };
};

// The summary's box on the book's left page.
const SUMMARY = { left: 112, top: 250, width: 375, height: 500, lineHeight: 1.32 };

// Largest font size (36px down to 14px) at which the summary, word-wrapped in
// the real font, fits the left page.
const fitSummary = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = (size: number) => {
    let count = 1;
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && measureText({ text: next, fontFamily: bodyFont, fontSize: size, fontWeight: "400" }).width > SUMMARY.width) {
        count++;
        line = word;
      } else {
        line = next;
      }
    }
    return count;
  };
  for (let size = 36; size > 14; size -= 0.5) {
    if (lines(size) * size * SUMMARY.lineHeight <= SUMMARY.height) return size;
  }
  return 14;
};

// Measuring needs the web font loaded, so hold the render until it is.
const useSummaryFontSize = (text: string) => {
  const [size, setSize] = useState<number | null>(null);
  const [handle] = useState(() => delayRender("Fitting the summary text"));
  useEffect(() => {
    arimo.waitUntilDone().then(() => {
      setSize(fitSummary(text));
      continueRender(handle);
    });
  }, [text, handle]);
  return size ?? 24;
};

const Background: React.FC<{ dim?: number }> = ({ dim = 0 }) => (
  <AbsoluteFill>
    <Img src={staticFile("brand/background.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {dim > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />}
  </AbsoluteFill>
);

const Sticker: React.FC<{ src: string; frame: number; start: number; x: number; y: number; size?: number }> = ({
  src,
  frame,
  start,
  x,
  y,
  size = 200,
}) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - start - 8, fps, config: { damping: 10 } });
  const bob = Math.sin((frame - start) / 8) * 8;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: x,
        top: y + bob,
        width: size,
        height: size,
        objectFit: "contain",
        transform: `scale(${pop}) rotate(${Math.sin(frame / 12) * 6}deg)`,
        filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))",
      }}
    />
  );
};

// Small copies of the decoration pictures drifting around the edges.
const SPOTS: [number, number][] = [
  [70, 430],
  [955, 110],
  [950, 560],
  [60, 930],
  [520, 960],
];
const Floaters: React.FC<{ emoji: string[]; frame: number }> = ({ emoji, frame }) => {
  const { fps } = useVideoConfig();
  if (!emoji.length) return null;
  return (
    <AbsoluteFill>
      {SPOTS.map(([x, y], i) => {
        const pop = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 12 } });
        return (
          <Img
            key={i}
            src={staticFile(emoji[i % emoji.length])}
            style={{
              position: "absolute",
              left: x - 45,
              top: y - 45 + Math.sin((frame + i * 20) / 14) * 10,
              width: 90,
              height: 90,
              opacity: 0.95,
              transform: `scale(${pop}) rotate(${Math.sin((frame + i * 30) / 20) * 12}deg)`,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Everything before the page flip: intro, cover, dish photo, theme decorations.
const FrontScenes: React.FC<ClipProps & { frame: number; t: ReturnType<typeof timeline> }> = ({ frame, t, cover, photo, sticker, emoji, theme }) => {
  const { fps } = useVideoConfig();
  // The uploaded sticker, else the best-matching emoji, sits by the cover;
  // the next emoji sits by the dish.
  const coverSticker = sticker ?? emoji[0] ?? null;
  const dishSticker = emoji[1] ?? emoji[0] ?? sticker;
  const bgIn = interpolate(frame, [0, 8], [0, 1], clamp);

  const coverIn = spring({ frame: frame - t.coverStart, fps, config: { damping: 14, stiffness: 90 } });
  const coverOut = interpolate(frame, [t.dishStart - 6, t.dishStart + 4], [1, 0], clamp);

  const dishIn = spring({ frame: frame - t.dishStart, fps, config: { damping: 16, stiffness: 110 } });
  const dishZoom = interpolate(frame, [t.dishStart, t.flipStart], [1, 1.06], clamp);

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <AbsoluteFill style={{ opacity: bgIn }}>
        <Background />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: bgIn }}>
        <ThemeLayer theme={theme} />
      </AbsoluteFill>
      <Floaters emoji={emoji} frame={frame} />

      {cover && frame < t.dishStart + 6 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: coverOut }}>
          <Img
            src={staticFile(cover)}
            // Fixed box + contain: small covers are scaled up to fill it too.
            // drop-shadow (not box-shadow) hugs the cover, not the box.
            style={{
              width: 700,
              height: 880,
              objectFit: "contain",
              filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.55))",
              transform: `translateY(${(1 - coverIn) * 120}px) rotate(${(1 - coverIn) * -28}deg) scale(${0.6 + coverIn * 0.4})`,
            }}
          />
          {coverSticker && <Sticker src={coverSticker} frame={frame} start={t.coverStart} x={760} y={760} />}
        </AbsoluteFill>
      )}

      {frame >= t.dishStart && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              width: 820,
              height: 900,
              overflow: "hidden",
              boxShadow: "0 24px 50px rgba(0,0,0,0.55)",
              transform: `translateX(${(1 - dishIn) * 1100}px)`,
            }}
          >
            <Img src={staticFile(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${dishZoom})` }} />
          </div>
          {dishSticker && <Sticker src={dishSticker} frame={frame} start={t.dishStart} x={40} y={40} />}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// The open book: logo, summary, dish photo, "Available Now", location.
const BookScene: React.FC<ClipProps & { frame: number; start: number }> = ({ frame, start, summary, photo }) => {
  const { fps } = useVideoConfig();
  const f = frame - start;
  const logoIn = spring({ frame: f - 6, fps, config: { damping: 13 } });
  const textIn = interpolate(f, [8, 22], [0, 1], clamp);
  const buttonIn = spring({ frame: f - 16, fps, config: { damping: 11 } });
  const pulse = 1 + 0.035 * Math.sin(Math.max(0, f - 30) / 7);
  const fontSize = useSummaryFontSize(summary);

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Background dim={0.15} />

      <Img
        src={staticFile("brand/logo-white.png")}
        style={{ position: "absolute", left: 540 - 230, top: 40, width: 460, transform: `translateY(${(1 - logoIn) * -60}px)`, opacity: logoIn }}
      />

      {/* 1600×908 artwork scaled to 1040 wide */}
      <Img src={staticFile("brand/open-book.png")} style={{ position: "absolute", left: 20, top: 205, width: 1040 }} />

      <div
        style={{
          position: "absolute",
          left: SUMMARY.left,
          top: SUMMARY.top,
          width: SUMMARY.width,
          height: SUMMARY.height,
          display: "flex",
          alignItems: "center",
          fontFamily: bodyFont,
          fontSize,
          lineHeight: SUMMARY.lineHeight,
          color: "#2b1d0e",
          opacity: textIn,
        }}
      >
        <div>{summary}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 585,
          top: 262,
          width: 360,
          height: 430,
          overflow: "hidden",
          borderRadius: 6,
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
          opacity: textIn,
        }}
      >
        <Img src={staticFile(photo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 820,
          display: "flex",
          justifyContent: "center",
          transform: `scale(${buttonIn * pulse})`,
        }}
      >
        <div
          style={{
            background: "#b3121c",
            color: "#fff",
            fontFamily: buttonFont,
            fontWeight: 700,
            fontSize: 42,
            padding: "14px 44px",
            borderRadius: 12,
            boxShadow: "0 8px 18px rgba(0,0,0,0.45)",
          }}
        >
          Available Now
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 930,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          color: "#fff",
          fontFamily: buttonFont,
          fontWeight: 700,
          fontSize: 24,
          lineHeight: 1.25,
          textShadow: "0 2px 6px rgba(0,0,0,0.7)",
          opacity: textIn,
        }}
      >
        <svg viewBox="0 0 24 24" width={40} height={40}>
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" fill="#fff" />
        </svg>
        <div style={{ textAlign: "center" }}>
          Pittsboro, North Carolina
          <br />
          smallcafebandb.com
        </div>
      </div>

      <AbsoluteFill style={{ border: `10px solid ${GOLD}`, boxSizing: "border-box" }} />
    </AbsoluteFill>
  );
};

export const SpecialClip: React.FC<ClipProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = timeline(durationInFrames, fps, Boolean(props.cover));

  const front = <FrontScenes {...props} frame={frame} t={t} />;
  const book = <BookScene {...props} frame={frame} start={t.flipStart} />;

  const flip = interpolate(frame, [t.flipStart, t.flipEnd], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  // Audio fades in briefly (it may start mid-song) and out over the last second.
  const volume = (f: number) =>
    Math.min(interpolate(f, [0, fps * 0.4], [0, 1], clamp), interpolate(f, [durationInFrames - fps, durationInFrames - 1], [1, 0], clamp));

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {frame < t.flipStart ? front : frame < t.flipEnd ? <PageFlip progress={flip} width={width} height={height} front={front} back={book} /> : book}
      {props.audio && <Audio src={staticFile(props.audio)} trimBefore={props.audioStartFrame ?? 0} volume={volume} />}
    </AbsoluteFill>
  );
};
