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
- makes a 1500px WebP + 750px phone copy of the uploaded photo under
  `images/specials/web/` (the upload itself is left as is).

Both date fields start empty. An empty first day means the Wednesday of the
week the entry was created (from its filename); a first day on Monday/Tuesday
(café closed) with no later last day also becomes that Wednesday. An empty last
day means the following Sunday. "Hide the date line" leaves the dates off (the
four oldest specials, which never had them). A hidden "Added" date (pre-filled
by Pages CMS on creation) only orders the list in the editor.

**The automation never edits a special's JSON except to add the video link /
picks / notes after a render** — Pages CMS refuses to save an entry that
changed since it was opened, so dates and photo copies are worked out on every
build instead of being written back.

It commits the updated pages and Cloudflare deploys them — about two minutes
after saving. The special with the latest first day is always the current one.

### Weekly video

The special's entry also has a **Video** section: book cover, book-page text,
audio (mp3/m4a/wav) with optional start/end times (e.g. 0:10–0:30 — the clip
is as long as that section), decoration emoji, decoration style and an optional
sticker. Decoration pictures are Microsoft's Fluent Emoji 3D (MIT licence):
left empty, `_video/decorations.mjs` picks ones matching the title and
description (from `_video/emoji-index.json`) and writes them back into the entry. Saving the newest special
(or any special with a cover/audio/audio link) makes its video automatically
(`.github/workflows/auto-video.yml`); **Make video** (top of the entry) re-makes
one. The cover is exactly what's uploaded (no cover → the clip starts on the
dish). Audio can be uploaded (Pages CMS uploads fail above ~3 MB, its host's
request limit) or given as an **audio link** — a Google Drive / Dropbox share
link or any direct link, downloaded at render time with no size limit; a link
that doesn't work gives a silent video and a note in the entry. The **Render special video** Action
(`.github/workflows/render-video.yml`) renders a 1080×1080 MP4 with
`_video/render.mjs` (Remotion), attaches it to a GitHub release (same link on re-renders) and writes the
download link into the entry's **Video** field (~1 minute; reload the entry).

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
