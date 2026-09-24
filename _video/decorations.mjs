// Picks the decoration pictures and the decoration style for a special.
//
// Pictures come from Microsoft's Fluent Emoji 3D set (MIT licence, free for
// commercial use): emoji-index.json lists each emoji's glyph, name, keywords
// and image path in github.com/microsoft/fluentui-emoji.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = JSON.parse(fs.readFileSync(path.join(HERE, "emoji-index.json"), "utf8"));
const RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/";

// Which kinds of emoji make sense as food-special decorations, and how much
// to favour each when the text mentions several things.
const GROUP_WEIGHT = { "Food & Drink": 3, "Animals & Nature": 1.6, Objects: 1.2, Activities: 1.1, "Travel & Places": 0.8 };

// Words every special uses, or that match too loosely to mean anything.
const IGNORE = new Set(
  (
    "book books novel novels nibbles read reading story stories page food meal dish eat eating special week weekly " +
    "small cafe red green yellow orange white black blue brown pink purple face hand sweet fresh house home day " +
    "time great little life love new world first last side top plate delicious yummy tasty dinner lunch " +
    "brunch breakfast serve served serving kitchen chef menu recipe cook cooking cooked made make homemade local " +
    "family just like one two three bit bite taste " +
    // plain English
    "and with the for from that this your you our are was were has have had but not all any can its into out " +
    "about over under than then they them their there what when where which who will would been being very " +
    "more most some such only also each his her him she get got off way how too"
  ).split(" "),
);

// Tableware and other emoji that fit every meal, so say nothing about this one.
const GENERIC = new Set(["🍽️", "🍴", "🥄", "🥢", "🔪", "🥣", "🫙", "🧂", "🍾", "🥡", "🍶", "🫗"].map((g) => g.replace(/\uFE0F/g, "")));

// Decoration style picked from the story when set to "auto".
const THEME_WORDS = [
  ["question-marks", "mystery mysteries murder detective sleuth crime poison poisoned clue clues whodunit suspect killer"],
  ["hearts", "love romance romantic valentine heart hearts affair wedding sweetheart"],
  ["waves", "sea ocean beach seaside island fish lobster shrimp crab boat sailor coast shore marsh river"],
  ["stars", "magic magical wizard witch spell spells enchanted fantasy realm space night star stars dream"],
  ["sun", "summer sun sunny sunshine picnic tropical heat garden"],
  ["confetti", "party celebration celebrate birthday fun groovy festival carnival"],
];

const stripHtml = (s = "") =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ");

const singular = (w) =>
  w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 4 && /(ches|shes|oes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;

const words = (text) =>
  stripHtml(text)
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(singular);

// Glyphs typed in the editor → index entries. Variation selectors (FE0F) are
// ignored so "❤" and "❤️" both match.
const bare = (g) => g.replace(/️/g, "");
const byGlyph = new Map(INDEX.map((e) => [bare(e.glyph), e]));
export function fromTyped(text) {
  const found = [];
  const unknown = [];
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text || "")) {
    if (!segment.trim()) continue;
    const hit = byGlyph.get(bare(segment));
    if (hit) found.push(hit);
    else unknown.push(segment);
  }
  return { found, unknown };
}

// Best-matching emoji for the special's text: title words count double.
export function autoPick(special, count = 3) {
  const title = words(special.title);
  const body = words(`${special.video_summary || ""} ${special.description || ""}`);
  const freq = new Map();
  for (const w of [...title, ...title, ...body]) if (!IGNORE.has(w) && w.length > 2) freq.set(w, (freq.get(w) || 0) + 1);

  const scored = [];
  for (const e of INDEX) {
    const weight = GROUP_WEIGHT[e.group];
    if (!weight || GENERIC.has(e.glyph.replace(/\uFE0F/g, ""))) continue;
    const terms = new Set([...words(e.name), ...e.keywords.flatMap(words)].filter((t) => !IGNORE.has(t) && t.length > 2));
    let score = 0;
    for (const t of terms) {
      score += (freq.get(t) || 0) * (words(e.name).includes(t) ? 2 : 1);
      // Compound words: "applesauce" contains "apple".
      if (t.length >= 5) for (const [w, n] of freq) if (w !== t && w.includes(t)) score += n * 1.5;
    }
    if (score > 0) scored.push({ e, score: score * weight });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const { e } of scored) {
    if (picked.length >= count) break;
    // Skip near-duplicates ("black cat" after "cat face", two kinds of apple).
    const nameWords = new Set(words(e.name).filter((w) => !["face", "with", "and"].includes(w)));
    if (picked.some((p) => words(p.name).some((w) => nameWords.has(w)))) continue;
    picked.push(e);
  }
  return picked;
}

export function autoTheme(special) {
  const text = new Set(words(`${special.title} ${special.video_summary || ""} ${special.description || ""}`));
  // Needs two different matching words, so one passing "love" or "sun"
  // doesn't decide the look.
  let best = ["sparkles", 1];
  for (const [theme, list] of THEME_WORDS) {
    const hits = new Set(list.split(" ").map(singular).filter((w) => text.has(w))).size;
    if (hits > best[1]) best = [theme, hits];
  }
  return best[0];
}

export async function download(entry, dest) {
  const res = await fetch(RAW + entry.path.split("/").map(encodeURIComponent).join("/"));
  if (!res.ok) throw new Error(`couldn't download the ${entry.name} emoji (${res.status})`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
