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

## Updating the weekly special

While the Squarespace site is still live, edit there and re-run:

    cd ~/Documents/Claude/squarespace-tools/small-cafe
    python3 ../sqs2static.py site.json / /menu /novels-nibbles /eating-america /famous-eats

Once Squarespace is cancelled, edit the HTML directly: the current special is
the "Current Special" section of `novels-nibbles.html` (and its copy on
`menu.html` / `index.html`).

## Hosting

- `wrangler.jsonc` — Worker `small-cafe`, serves this folder as static assets.
- `.assetsignore` — repo files that should not be published.
- `_redirects` — old Squarespace URLs (cart, unlisted pages) → live pages.
- Push to `main` deploys (Cloudflare Workers GitHub integration).
