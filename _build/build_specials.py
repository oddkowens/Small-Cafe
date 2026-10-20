#!/usr/bin/env python3
"""Regenerate the Novels & Nibbles special everywhere it appears.

    python3 _build/build_specials.py

Each special is one JSON file in specials/ (edited through Pages CMS, see
.pages.yml). The special with the latest first day is the current one — live
as soon as it's saved, which is how the café works (specials arrive Tuesday
and go up that night for a Wednesday start). Everything older is listed
under "Previous Special".

Updates, between marker comments:
  novels-nibbles.html  current special section + all previous special sections
  menu.html            the special's text on the menu page
  index.html           the homepage hero background → current special's photo

New photos (uploaded through Pages CMS into images/specials/) get a 1500px
WebP + 750px phone copy under images/specials/web/ — when Pillow is installed
(the GitHub Action installs it). The build never edits the specials' JSON.

Python standard library only (plus optional Pillow).
"""
import datetime, hashlib, html, json, os, re, struct, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECIALS = os.path.join(ROOT, "specials")
TEMPLATE = os.path.join(ROOT, "_build", "special-section.html")
PHOTO_WIDTH, SMALL_WIDTH = 1500, 750


# ── Loading ─────────────────────────────────────────────────────────────
#
# The build never writes back into a special's JSON file. Pages CMS refuses to
# save an entry that changed since it was opened ("File has changed since you
# last loaded it"), so anything the build filled in would trip up the next edit.
# Dates and optimised photos are worked out fresh on every build instead.

def created_date(special):
    """The day the entry was created: Pages CMS names files
    {year}-{month}-{day}-{title}.json."""
    m = re.match(r"(\d{4}-\d{2}-\d{2})", special["_slug"])
    return datetime.date.fromisoformat(m.group(1)) if m else datetime.date.today()


def resolve_dates(special):
    """Sets _start/_end (ISO dates) for the pages; the file is left alone.

    - First day empty → the Wednesday of the week the entry was created
      (specials arrive Tuesday for a Wednesday start).
    - First day on a Monday/Tuesday (café closed — usually an old pre-filled
      "today") with no real last day → that week's Wednesday.
    - Last day empty, or not after the first day (pre-filled) → the Sunday on
      or after the first day.
    """
    start = special.get("start") or ""
    end = special.get("end") or ""
    if not start:
        base = created_date(special)
        start = (base + datetime.timedelta(days=2 - base.weekday())).isoformat()
    s = datetime.date.fromisoformat(start)
    if s.weekday() in (0, 1) and not (end and end > start) and not special.get("hide_dates"):
        s = s + datetime.timedelta(days=2 - s.weekday())
        start, end = s.isoformat(), ""
    if not special.get("hide_dates") and not (end and end > start):
        end = (s + datetime.timedelta(days=(6 - s.weekday()) % 7)).isoformat()
    special["_start"], special["_end"] = start, end


def load_specials():
    items = []
    for name in sorted(os.listdir(SPECIALS)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(SPECIALS, name)
        with open(path) as f:
            data = json.load(f)
        data["_path"] = path
        data["_slug"] = name[:-5]
        if not data.get("photo"):
            print(f"skipping {name}: no photo yet", file=sys.stderr)
            continue
        resolve_dates(data)
        items.append(data)
    # Newest first; the filename breaks ties so the order never flickers.
    return sorted(items, key=lambda s: (s["_start"], s["_slug"]), reverse=True)


# ── Photos ──────────────────────────────────────────────────────────────

def rel(path):
    """Pages CMS writes '/images/specials/x.jpg'; the pages use relative paths."""
    return (path or "").lstrip("/")


def small_copy(photo):
    d, name = os.path.split(photo)
    return f"{d}/750/{name}"


def web_photo(special):
    """The photo the pages use: the upload itself if it's already an optimised
    WebP with a phone copy (older specials), otherwise a 1500px WebP + 750px
    phone copy made next to it under web/ (the upload is left untouched)."""
    photo = rel(special.get("photo"))
    if photo.endswith(".webp") and os.path.exists(os.path.join(ROOT, small_copy(photo))):
        return photo
    d, name = os.path.split(photo)
    target = f"{d}/web/{os.path.splitext(name)[0]}.webp"
    if not os.path.exists(os.path.join(ROOT, target)):
        try:
            from PIL import Image, ImageOps
        except ImportError:
            return photo  # used as uploaded until the GitHub build makes the copies
        with Image.open(os.path.join(ROOT, photo)) as im:
            im = ImageOps.exif_transpose(im)  # phone photos carry their rotation in EXIF
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGB")
            for path, width, quality in ((target, PHOTO_WIDTH, 82), (small_copy(target), SMALL_WIDTH, 80)):
                os.makedirs(os.path.dirname(os.path.join(ROOT, path)), exist_ok=True)
                copy = im.copy()
                copy.thumbnail((width, width * 4))
                copy.save(os.path.join(ROOT, path), "WEBP", quality=quality)
    return target


def image_size(path):
    """Width and height of a JPEG, PNG or WebP file, without Pillow."""
    with open(path, "rb") as f:
        head = f.read(64)
        if head[:8] == b"\x89PNG\r\n\x1a\n":
            return struct.unpack(">II", head[16:24])
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            kind = head[12:16]
            if kind == b"VP8X":
                w = int.from_bytes(head[24:27], "little") + 1
                h = int.from_bytes(head[27:30], "little") + 1
                return w, h
            if kind == b"VP8L":
                b = int.from_bytes(head[21:25], "little")
                return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
            if kind == b"VP8 ":
                w, h = struct.unpack("<HH", head[26:30])
                return w & 0x3FFF, h & 0x3FFF
        if head[:2] == b"\xff\xd8":
            f.seek(2)
            while True:
                marker, size = struct.unpack(">2sH", f.read(4))
                if marker[1] in (0xC0, 0xC1, 0xC2):
                    h, w = struct.unpack(">xHH", f.read(5))
                    return w, h
                f.seek(size - 2, 1)
    raise ValueError(f"can't read image size: {path}")


def photo_attrs(photo):
    w, h = image_size(os.path.join(ROOT, photo))
    # URL-encode: uploads keep their names, spaces included, and srcset is
    # space-separated.
    url = urllib.parse.quote(photo)
    srcset = url
    if os.path.exists(os.path.join(ROOT, small_copy(photo))):
        srcset = f"{urllib.parse.quote(small_copy(photo))} 750w, {url} 1500w"
    return {"src": url, "srcset": srcset, "w": w, "h": h}


# ── Text ────────────────────────────────────────────────────────────────

def fmt_date(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.month}/{d.day}/{d.year}"


def text_html(special, align):
    h = f'style="text-align: {align}; white-space: pre-wrap" data-rte-preserve-empty="true"'
    out = [f"<h3 {h}><u>{html.escape(special['title'], quote=False)}</u></h3>"]
    # The editor writes <p> paragraphs; the site's design sets them as <h4>.
    desc = special.get("description") or ""
    desc = re.sub(r"<p(?:\s[^>]*)?>", f"<h4 {h}>", desc)
    desc = desc.replace("</p>", "</h4>")
    out.append(desc.strip())
    if special.get("price"):
        out.append(f"<h4 {h}>{html.escape(special['price'].strip(), quote=False)}</h4>")
    if special.get("_end") and not special.get("hide_dates"):
        out.append(f"<h4 {h}>{fmt_date(special['_start'])} - {fmt_date(special['_end'])}</h4>")
    return "".join(out)


# ── Sections ────────────────────────────────────────────────────────────

def ids_for(slug):
    """Stable Squarespace-style ids (the section's CSS is keyed on them)."""
    digest = hashlib.sha1(slug.encode()).hexdigest()
    return {
        "section_id": digest[:24],
        "fe_id": digest[1:25],
        "grid_id": digest[2:26],
        "text_id": digest[3:23],
        "image_id": digest[4:24],
    }


def special_section(special, template):
    p = photo_attrs(special["_photo"])
    values = dict(ids_for(special["_slug"]),
                  text_html=text_html(special, "left"),
                  photo_src=p["src"], photo_srcset=p["srcset"],
                  photo_w=str(p["w"]), photo_h=str(p["h"]))
    return re.sub(r"\{\{(\w+)\}\}", lambda m: values[m.group(1)], template)


def replace_between(page, name, content):
    path = os.path.join(ROOT, page)
    with open(path) as f:
        s = f.read()
    start, end = f"<!-- specials:{name} -->", f"<!-- /specials:{name} -->"
    i, j = s.find(start), s.find(end)
    if i < 0 or j < 0:
        sys.exit(f"{page}: missing {start} / {end} markers")
    new = s[: i + len(start)] + content + s[j:]
    if new != s:
        with open(path, "w") as f:
            f.write(new)
        return True
    return False


# "Homepage photo focus" in the editor → which part of the photo stays in view
# when the full-width hero crops it.
FOCUS = {"top": (0.5, 0.2), "center": (0.5, 0.5), "bottom": (0.5, 0.85)}


def hero_img(tag, p, focus):
    """Point the homepage hero <img> at the current special's photo."""
    fx, fy = FOCUS.get(focus or "center", FOCUS["center"])
    for attr, value in (("data-src", p["src"]), ("data-image", p["src"]), ("src", p["src"]),
                        ("srcset", p["srcset"]), ("data-image-dimensions", f'{p["w"]}x{p["h"]}'),
                        ("width", str(p["w"])), ("height", str(p["h"])),
                        ("data-image-focal-point", f"{fx},{fy}")):
        tag = re.sub(rf'(\s{attr}=")[^"]*(")', lambda m: m.group(1) + value + m.group(2), tag)
    return re.sub(r"object-position:[^;\"]*", f"object-position: {fx * 100:g}% {fy * 100:g}%", tag)


def main():
    specials = load_specials()
    if not specials:
        sys.exit("no specials in specials/")
    for s in specials:
        s["_photo"] = web_photo(s)
    current, previous = specials[0], specials[1:]

    with open(TEMPLATE) as f:
        template = f.read()
    changed = [
        replace_between("novels-nibbles.html", "current", special_section(current, template)),
        replace_between("novels-nibbles.html", "previous",
                        "".join(special_section(s, template) for s in previous)),
        replace_between("menu.html", "menu", text_html(current, "center")),
    ]
    with open(os.path.join(ROOT, "index.html")) as f:
        s = f.read()
    m = re.search(r"<!-- specials:hero -->(.*?)<!-- /specials:hero -->", s, re.S)
    if not m:
        sys.exit("index.html: missing <!-- specials:hero --> markers")
    changed.append(replace_between("index.html", "hero", hero_img(m.group(1), photo_attrs(current["_photo"]), current.get("hero_focus"))))

    print(f"current: {current['title']} ({current['_start']} – {current['_end']}); {len(previous)} previous"
          + ("" if any(changed) else "; pages already up to date"))


if __name__ == "__main__":
    main()
