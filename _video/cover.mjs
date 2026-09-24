// Book covers: how big an uploaded cover is, and a fallback from Open Library
// (openlibrary.org — free, no key) when there's no upload or the upload is
// smaller than Open Library's copy.
import fs from "node:fs";

// Width × height of a PNG, JPEG or WebP file.
export function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    if (kind === "VP8L") {
      const v = b.readUInt32LE(21);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc2) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

// "Deep Fried by Mark Doyon", "Heartburn – By Nora Ephron",
// "Novels & Nibbles: Like Water For Chocolate by Laura Esquivel" → { title, author }
export function splitTitle(full) {
  const clean = full.replace(/^novels\s*&\s*nibbles:\s*/i, "");
  const m = clean.match(/^(.*?)\s*(?:[-–—]\s*)?\bby\b\s+(.*)$/i);
  return m ? { title: m[1].trim(), author: m[2].trim() } : { title: clean.trim(), author: "" };
}

// Downloads Open Library's large cover for the book to `dest`; returns its size, or null.
export async function openLibraryCover(fullTitle, dest) {
  const { title, author } = splitTitle(fullTitle);
  const q = new URLSearchParams({ title, limit: "5", fields: "title,author_name,cover_i" });
  if (author) q.set("author", author.split(/\s*(?:&|and)\s*/)[0]);
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: { "User-Agent": "SmallCafeBandB-video (smallcafebandb.com)" } });
    if (!res.ok) return null;
    const hit = (await res.json()).docs.find((d) => d.cover_i);
    if (!hit) return null;
    const img = await fetch(`https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`);
    if (!img.ok) return null;
    fs.writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
    return imageSize(dest);
  } catch {
    return null; // no network, rate-limited… the clip just goes without it
  }
}
