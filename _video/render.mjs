#!/usr/bin/env node
// Render the weekly clip for one special.
//
//   node render.mjs ../specials/2026-09-23-brady-bunch-book-….json [out.mp4]
//   node render.mjs ../specials/….json --still 400 frame.png   # one frame, for checking layout
//
// Copies that week's photo / cover / audio / sticker into public/week/ (Remotion
// serves files from public/), picks and downloads the decoration emoji (see
// decorations.mjs), works out the length from the audio, and renders a
// 1080×1080 MP4 with the audio baked in.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoPick, autoTheme, download, fromTyped } from "./decorations.mjs";
import { googleBooksCover, imageSize, openLibraryCover } from "./cover.mjs";

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

// HTML → plain text ("&amp;" → "&", "&rsquo;" → "’", tags dropped).
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", mdash: "—", ndash: "–" };
const plain = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

// The book page shows a short summary. Use the one written for the video, or
// fall back to the first paragraph of the website description, trimmed to a
// sentence boundary so it fits the page.
function summaryText() {
  if (special.video_summary?.trim()) return plain(special.video_summary);
  const text = plain((special.description || "").split(/<\/p>/i)[0]);
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

// Decoration pictures: the emoji typed in the editor, or picked from the text.
// Things Ellen should know, shown in the entry's "Video notes" after a render.
const notes = [];
const warn = (msg) => {
  notes.push(msg);
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning: ${msg}`);
};

const typed = fromTyped(special.decorations);
if (typed.unknown.length) warn(`No picture for ${typed.unknown.join(" ")} in the decorations, so it was skipped.`);
const picks = typed.found.length ? typed.found.slice(0, 4) : autoPick(special);
const emoji = [];
for (const [i, e] of picks.entries()) {
  await download(e, path.join(WEEK, `emoji-${i}.png`));
  emoji.push(`week/emoji-${i}.png`);
}
const theme = !special.theme || special.theme === "auto" ? autoTheme(special) : special.theme;

// Book cover: an upload 600+ pixels tall is used as is. Otherwise the largest
// of the upload, Google Books' copy and Open Library's copy. Small covers still
// work — they're scaled up — but look soft.
let cover = stage("cover", "cover");
let coverSize = cover ? imageSize(path.join(HERE, "public", cover)) : null;
if (!coverSize || coverSize.h < 600) {
  for (const [source, find, file] of [
    ["Google Books", googleBooksCover, "cover-google.jpg"],
    ["Open Library", openLibraryCover, "cover-openlibrary.jpg"],
  ]) {
    if (coverSize && coverSize.h >= 600) break;
    const found = await find(special.title, path.join(WEEK, file));
    if (found && (!coverSize || found.h > coverSize.h)) {
      console.log(`using ${source}'s cover (${found.w}×${found.h})${cover ? ` instead of ${coverSize.w}×${coverSize.h}` : ""}`);
      cover = `week/${file}`;
      coverSize = found;
    }
  }
}
if (!cover) warn("Couldn't find the book cover automatically — upload one in \"Video: book cover\".");
if (coverSize && coverSize.h < 500) warn(`The book cover is only ${coverSize.w}×${coverSize.h} pixels, so it will look blurry. Upload a bigger one (600+ pixels tall).`);

const props = {
  summary: summaryText(),
  photo: stage("photo", "photo"),
  cover,
  audio: stage("audio", "audio"),
  sticker: stage("sticker", "sticker"),
  emoji,
  theme,
};
// "0:10", "1:05.5" or "10" → seconds.
const toSeconds = (v) => {
  if (v == null || String(v).trim() === "") return null;
  const parts = String(v).trim().split(":").map(Number);
  const secs = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  if (!Number.isFinite(secs) || secs < 0) throw new Error(`can't read the audio time "${v}" — use 0:10 or 10`);
  return secs;
};

let seconds = DEFAULT_SECONDS;
props.audioStartFrame = 0;
if (props.audio) {
  const total = audioSeconds(path.join(HERE, "public", props.audio));
  const start = toSeconds(special.audio_start) ?? 0;
  const end = Math.min(toSeconds(special.audio_end) ?? total, total);
  if (end <= start) throw new Error(`audio end (${special.audio_end}) must be after audio start (${special.audio_start})`);
  seconds = end - start;
  props.audioStartFrame = Math.round(start * FPS);
}
props.durationInFrames = Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)) * FPS);

const outDir = path.join(HERE, "out");
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, "props.json");
fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
// What was used, so the workflow can show it in the editor for next time.
fs.writeFileSync(
  path.join(outDir, "picked.json"),
  JSON.stringify({ decorations: picks.map((e) => e.glyph).join(""), theme, notes: notes.join(" ") || "All good." }),
);
console.log(`${special.title}: ${(props.durationInFrames / FPS).toFixed(1)}s, theme ${theme}, decorations ${picks.map((e) => e.glyph).join(" ") || "none"}`);

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
