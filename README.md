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

It commits the updated pages and Cloudflare deploys them — about two minutes
after saving. The special with the latest first day is always the current one.

### Weekly video

The special's entry also has a **Video** section: book cover, book-page text,
audio (mp3/m4a/wav), decorations and an optional sticker. Save, then press
**Make video** (top of the entry). The **Render special video** Action
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
live site only ever shows `main`. To reset practice to match the live site:
`git checkout practice && git reset --hard main && git push -f origin practice`.

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
