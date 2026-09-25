# Small Cafe B&B — smallcafebandb.com

Static copy of the Squarespace site, hosted on Cloudflare Workers (static assets).
Every page, stylesheet, font and image is local — nothing loads from Squarespace.

## How it was made

Pages were generated from the live Squarespace site with
`~/Documents/Claude/squarespace-tools/sqs2static.py` (config in
`squarespace-tools/small-cafe/`). The markup is what Squarespace rendered;
Squarespace's own CSS is saved under `css/`. The few things that relied on
Squarespace's JavaScript are replaced by `static-shim.js` / `static-shim.css`
(gallery slideshow, masonry grid, list slideshow, section dividers, fit-mode
image blocks). The mobile menu script is inlined at the bottom of each page.

## Weekly Novels & Nibbles special

Edited in **Pages CMS** (https://app.pagescms.org, sign in with GitHub):
open this repo → *Novels & Nibbles specials* → **Add an entry**, fill in the
book & author, first/last day, price, photo and description, and **Save**.

Saving commits a JSON file to `specials/` and the photo to `images/specials/`.
The **Build specials** GitHub Action (`.github/workflows/build-specials.yml`)
then runs `_build/build_specials.py`, which:

- makes the newest started special the "Current Special" on `novels-nibbles.html`
  and lists every older one under "Previous Special";
- puts the current special's text on `menu.html`;
- makes its photo the homepage (`index.html`) hero background;
- shrinks the uploaded photo to WebP (1500px + a 750px phone copy).

A first day on Monday/Tuesday (Pages CMS pre-fills today; the café is closed
then) moves to that week's Wednesday unless a later last day was set. An empty
(or pre-filled) "Last day" becomes the Sunday on or after the first day (written
back into the entry); "Hide the date line" leaves the dates off (used for the
four oldest specials, which never had them).

It commits the updated pages and Cloudflare deploys them — about two minutes
after saving. The special with the latest first day is always the current one.

### Weekly video

The special's entry also has a **Video** section: book cover, book-page text,
audio (mp3/m4a/wav) with optional start/end times (e.g. 0:10–0:30 — the clip
is as long as that section), decoration emoji, decoration style and an optional
sticker. Decoration pictures are Microsoft's Fluent Emoji 3D (MIT licence):
left empty, `_video/decorations.mjs` picks ones matching the title and
description (from `_video/emoji-index.json`) and writes them back into the entry. Saving the newest special
(or any special with a cover/audio) makes its video automatically
(`.github/workflows/auto-video.yml`); **Make video** (top of the entry) re-makes
one. With no cover uploaded (or a small one) the render finds one on Google
Books, then Open Library (`_video/cover.mjs`); a `GOOGLE_BOOKS_API_KEY` repo
secret switches Google to its official API. The **Render special video** Action
(`.github/workflows/render-video.yml`) renders a 1080×1080 MP4 with
`_video/render.mjs` (Remotion), attaches it to a GitHub release and writes the
download link into the entry's **Video** field (~3 minutes; reload the entry).

The template is `_video/src/` — `SpecialClip.tsx` (scenes and timing: cover,
dish, page curl at the halfway point, open book), `PageFlip.tsx`, and
`themes.tsx` (the decoration sets). Brand artwork is in `_video/public/brand/`.
Uploads for the video go to `_video/uploads/`, which the website doesn't publish.

To work on the template locally: `cd _video && npm install && npm run studio`
(live preview), or render one special with
`node render.mjs ../specials/<file>.json` (→ `_video/out/`). Remotion is free
for companies of up to 3 people (ODD qualifies).

### Practising

Use the **practice** branch: in Pages CMS switch the branch (top left) from
`main` to `practice` and add or edit specials freely. The same build runs on
that branch and Cloudflare publishes it to a separate preview address — the
live site only ever shows `main`. When a practice special is right, press
**Publish to live site** on it (`.github/workflows/publish-special.yml`): just
that entry and its files are copied to `main`, the pages rebuilt and the live
video made — the branches are never merged. To start over, press **Reset practice** on the
specials list (`.github/workflows/reset-practice.yml`): practice goes back to
exactly what's live and the videos rendered from practice are deleted.

The generated parts sit between `<!-- specials:… -->` marker comments; don't
hand-edit inside them (the next build overwrites it). The section layout is
`_build/special-section.html`. To rebuild locally: `python3 _build/build_specials.py`.

Other page edits: edit the HTML directly. `sqs2static.py` must not be re-run
on `index.html`, `menu.html` or `novels-nibbles.html` any more — it would drop
the markers.

## Hosting

- `wrangler.jsonc` — Worker `small-cafe`, serves this folder as static assets.
- `.assetsignore` — repo files that should not be published (build tooling, specials data).
- `_redirects` — old Squarespace URLs (cart, unlisted pages) → live pages.
- Push to `main` deploys (Cloudflare Workers GitHub integration).
