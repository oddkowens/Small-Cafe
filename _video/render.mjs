#!/usr/bin/env node
// Render the weekly clip for one special.
//
//   node render.mjs ../specials/2026-09-23-brady-bunch-book-….json [out.mp4]
//   node render.mjs ../specials/….json --still 400 frame.png   # one frame, for checking layout
//
// Copies that week's photo / cover / audio / sticker into public/week/ (Remotion
// serves files from public/), works out the length from the audio, and renders
// a 1080×1080 MP4 with the audio baked in.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const WEEK = path.join(HERE, "public", "week");
const FPS = 30;
const DEFAULT_SECONDS = 20; // no audio uploaded
const MIN_SECONDS = 12;
const MAX_SECONDS = 60;

const args = process.argv.slice(2);
const specialPath = args[0];
if (!specialPath) {
  console.error("usage: node render.mjs <specials/…json> [out.mp4] [--still <frame> <out.png>]");
  process.exit(1);
}
const special = JSON.parse(fs.readFileSync(path.resolve(specialPath), "utf8"));
const slug = path.basename(specialPath, ".json");

// Paths in the JSON look like "/images/specials/x.webp" (Pages CMS) — repo-relative.
const repoFile = (p) => (p ? path.join(REPO, p.replace(/^\//, "")) : null);

function stage(field, name) {
  const src = repoFile(special[field]);
  if (!src) return null;
  if (!fs.existsSync(src)) throw new Error(`${field}: file not found: ${special[field]}`);
  const dest = `${name}${path.extname(src).toLowerCase()}`;
  fs.copyFileSync(src, path.join(WEEK, dest));
  return `week/${dest}`;
}

// The book page shows a short summary. Use the one written for the video, or
// fall back to the first paragraph of the website description, trimmed to a
// sentence boundary so it fits the page.
function summaryText() {
  if (special.video_summary?.trim()) return special.video_summary.trim();
  const first = (special.description || "").split(/<\/p>/i)[0];
  const text = first
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 420) return text;
  const cut = text.slice(0, 420);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 150 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "…");
}

function audioSeconds(file) {
  const out = execFileSync(
    "npx",
    ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { cwd: HERE, encoding: "utf8" },
  );
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds)) throw new Error(`couldn't read the audio length of ${file}`);
  return seconds;
}

fs.rmSync(WEEK, { recursive: true, force: true });
fs.mkdirSync(WEEK, { recursive: true });

if (!special.photo) throw new Error("the special needs a photo");
const props = {
  summary: summaryText(),
  photo: stage("photo", "photo"),
  cover: stage("cover", "cover"),
  audio: stage("audio", "audio"),
  sticker: stage("sticker", "sticker"),
  theme: special.theme || "sparkles",
};
const seconds = props.audio ? audioSeconds(path.join(HERE, "public", props.audio)) : DEFAULT_SECONDS;
props.durationInFrames = Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)) * FPS);

const outDir = path.join(HERE, "out");
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, "props.json");
fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
console.log(`${special.title}: ${(props.durationInFrames / FPS).toFixed(1)}s, theme ${props.theme}`);

const stillAt = args.indexOf("--still");
const cli = (cmd) => execFileSync("npx", ["remotion", ...cmd], { cwd: HERE, stdio: "inherit" });
if (stillAt >= 0) {
  const frame = args[stillAt + 1];
  const out = path.resolve(args[stillAt + 2] || path.join(outDir, `${slug}-${frame}.png`));
  cli(["still", "src/index.ts", "SpecialClip", out, `--frame=${frame}`, `--props=${propsFile}`]);
} else {
  const out = path.resolve(args[1] || path.join(outDir, `${slug}.mp4`));
  cli(["render", "src/index.ts", "SpecialClip", out, `--props=${propsFile}`, "--codec=h264", "--crf=20"]);
  console.log(`rendered ${out}`);
}
