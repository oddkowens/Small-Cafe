// Book covers: how big an uploaded cover is, and automatic covers from Google
// Books (usually the sharpest) and Open Library when there's no upload or the
// upload is small.
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

// Loose match so a search hit is the right book, not just a similar title.
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "book"].includes(w));
function sameBook(hitTitle, hitAuthors, title, author) {
  const want = norm(title);
  const got = new Set(norm(hitTitle));
  const titleOk = want.length === 0 || want.filter((w) => got.has(w)).length / want.length >= 0.6;
  const surname = norm(author.split(/\s*(?:&|and|,)\s*/)[0]).pop();
  const authorOk = !surname || hitAuthors.some((a) => norm(a).includes(surname));
  return titleOk && authorOk;
}

// Google Books volume ids for the book: the official API when a key is set
// (GOOGLE_BOOKS_API_KEY), otherwise Google's older search feed, which needs none.
async function googleBookIds(title, author) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) {
    const q = `intitle:"${title}"${author ? `+inauthor:"${author.split(/\s*(?:&|and)\s*/)[0]}"` : ""}`;
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books&key=${key}`);
    console.log(`Google Books API search: ${res.status}`);
    if (res.ok) {
      const items = (await res.json()).items || [];
      return items
        .filter((i) => i.volumeInfo?.imageLinks && sameBook(i.volumeInfo.title || "", i.volumeInfo.authors || [], title, author))
        .map((i) => i.id);
    }
  }
  console.log("Google Books keyless search");
  const res = await fetch(`https://books.google.com/books/feeds/volumes?q=${encodeURIComponent(`${title} ${author}`)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (SmallCafeBandB video)" },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, e]) => ({
      id: e.match(/volumes\/([A-Za-z0-9_-]+)<\/id>/)?.[1],
      title: e.match(/<dc:title>([^<]*)<\/dc:title>/)?.[1] || "",
      authors: [...e.matchAll(/<dc:creator>([^<]*)<\/dc:creator>/g)].map((m) => m[1]),
      thumb: e.includes("thumbnail"),
    }))
    .filter((e) => e.id && e.thumb && sameBook(e.title, e.authors, title, author))
    .map((e) => e.id);
}

// Downloads the largest Google Books cover for the book to `dest`; returns its size, or null.
export async function googleBooksCover(fullTitle, dest) {
  const { title, author } = splitTitle(fullTitle);
  const tried = [];
  try {
    let best = null;
    for (const id of (await googleBookIds(title, author)).slice(0, 3)) {
      const res = await fetch(`https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&fife=w1200-h1600`, {
        headers: { "User-Agent": "Mozilla/5.0 (SmallCafeBandB video)" },
      });
      // "No image" placeholders come back as PNGs; real covers are JPEGs.
      if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/jpeg")) continue;
      const tmp = `${dest}.${id}`;
      tried.push(tmp);
      fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      const size = imageSize(tmp);
      if (size && size.h >= 200 && (!best || size.h > best.size.h)) best = { tmp, size };
    }
    if (!best) return null;
    fs.renameSync(best.tmp, dest);
    return best.size;
  } catch {
    return null;
  } finally {
    for (const t of tried) fs.rmSync(t, { force: true });
  }
}
