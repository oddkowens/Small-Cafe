import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Animated decorations layered over the cover and dish scenes. Each week picks
// one in the editor ("Video theme"); `none` shows just the pictures.
export const THEMES = ["sparkles", "confetti", "question-marks", "hearts", "sun", "waves", "stars", "none"] as const;
export type Theme = (typeof THEMES)[number];

// Deterministic pseudo-random so every render of a special looks the same.
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const popIn = (frame: number, fps: number, delay: number) =>
  spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });

const Sparkle: React.FC<{ x: number; y: number; size: number; delay: number }> = ({ x, y, size, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const twinkle = 0.75 + 0.25 * Math.sin((frame + delay * 7) / 6);
  const scale = popIn(frame, fps, delay) * twinkle;
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, transform: `scale(${scale}) rotate(${frame * 0.6}deg)` }}
    >
      <path d="M0,-50 C6,-8 8,-6 50,0 C8,6 6,8 0,50 C-6,8 -8,6 -50,0 C-8,-6 -6,-8 0,-50Z" fill="#fff" />
    </svg>
  );
};

const Sparkles: React.FC = () => (
  <AbsoluteFill>
    {[
      [120, 140, 150, 4],
      [960, 230, 70, 12],
      [150, 880, 80, 20],
      [940, 900, 120, 8],
      [540, 70, 50, 26],
    ].map(([x, y, s, d], i) => (
      <Sparkle key={i} x={x} y={y} size={s} delay={d} />
    ))}
  </AbsoluteFill>
);

const Confetti: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = ["#f7a1c4", "#1f9aa6", "#8fd694", "#f28c28", "#f6c945", "#e85a71"];
  return (
    <AbsoluteFill>
      {Array.from({ length: 22 }, (_, i) => {
        const left = i % 2 === 0;
        const x = left ? 30 + rand(i) * 90 : 960 + rand(i) * 90;
        const y = 60 + (i / 22) * 960 + rand(i + 50) * 40;
        const bob = Math.sin((frame + i * 9) / 10) * 12;
        const size = 26 + rand(i + 99) * 18;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y + bob,
              width: size,
              height: size,
              borderRadius: "50%",
              background: colors[i % colors.length],
              transform: `scale(${popIn(frame, fps, i)})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const QuestionMarks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {Array.from({ length: 14 }, (_, i) => {
        const x = rand(i + 3) * 1000;
        const y = rand(i + 30) * 1000;
        const edge = x < 180 || x > 880 || y < 150 || y > 900; // keep them around the edges
        if (!edge) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y - frame * 0.4,
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: 90 + rand(i + 7) * 70,
              color: "#c77dcb",
              opacity: 0.85,
              transform: `rotate(${(rand(i) - 0.5) * 50 + Math.sin(frame / 15 + i) * 8}deg) scale(${popIn(frame, fps, i * 2)})`,
            }}
          >
            ?
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Hearts: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 12 }, (_, i) => {
        const left = i % 2 === 0;
        const x = left ? 40 + rand(i) * 110 : 930 + rand(i) * 110;
        const rise = ((frame * (1.5 + rand(i) * 1.5) + rand(i + 9) * 1100) % 1250) - 100;
        const size = 40 + rand(i + 4) * 40;
        return (
          <svg key={i} viewBox="0 0 32 29" width={size} style={{ position: "absolute", left: x, top: 1080 - rise, opacity: 0.9 }}>
            <path d="M16 29 1.4 14.6A8.3 8.3 0 0 1 16 4.4a8.3 8.3 0 0 1 14.6 10.2Z" fill={i % 3 ? "#e85a71" : "#f7a1c4"} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

const Sun: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = popIn(frame, fps, 4);
  return (
    <svg viewBox="-100 -100 200 200" width={260} style={{ position: "absolute", left: -40, top: -40, transform: `scale(${s}) rotate(${frame * 0.8}deg)` }}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-6} y={-96} width={12} height={34} rx={6} fill="#f6c945" transform={`rotate(${i * 30})`} />
      ))}
      <circle r={52} fill="#f6c945" />
    </svg>
  );
};

const Waves: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = (frame * 3) % 240;
  const wave = (y: number, color: string, speed: number) => (
    <svg width={1080 + 240} height={140} style={{ position: "absolute", left: -((shift * speed) % 240), bottom: y }}>
      <path
        d={`M0 60 ${Array.from({ length: 12 }, (_, i) => `Q ${i * 120 + 60} ${i % 2 ? 100 : 20} ${(i + 1) * 120} 60`).join(" ")} V140 H0Z`}
        fill={color}
      />
    </svg>
  );
  return (
    <AbsoluteFill>
      {wave(-30, "rgba(31,154,166,0.75)", 1)}
      {wave(-60, "rgba(18,96,140,0.9)", 1.6)}
    </AbsoluteFill>
  );
};

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 60 }, (_, i) => {
        const x = rand(i + 1) * 1080;
        const y = rand(i + 200) * 1080;
        const o = 0.35 + 0.65 * Math.abs(Math.sin((frame + i * 13) / 14));
        const size = 3 + rand(i + 400) * 5;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: "50%", background: "#fff", opacity: o }} />;
      })}
    </AbsoluteFill>
  );
};

export const ThemeLayer: React.FC<{ theme: string }> = ({ theme }) => {
  switch (theme) {
    case "sparkles":
      return <Sparkles />;
    case "confetti":
      return <Confetti />;
    case "question-marks":
      return <QuestionMarks />;
    case "hearts":
      return <Hearts />;
    case "sun":
      return <Sun />;
    case "waves":
      return <Waves />;
    case "stars":
      return <Stars />;
    default:
      return null;
  }
};

// Fades a layer in over its first frames (used when a scene starts).
export const useFadeIn = (frames = 10) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};
