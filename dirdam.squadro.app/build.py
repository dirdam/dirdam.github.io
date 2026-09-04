"""Build the static dirdam.squadro.app site from its source fragments."""

import json
import shutil
from pathlib import Path


PAGES = [
    {"name": "index", "title": "Adrï — Data Scientist, Game Designer, Mathematician",
     "description": "Personal site of Adrián Jiménez Pascual — data scientist, mathematician, and game designer.",
     "hero_variant": "hero--full", "has_subtitle": True, "extra_css": [],
     "extra_js": ["/assets/js/network-bg.js"],
     # The cursive "Adrï" signature (KnotFont's "A" glyph) instead of plain
     # text — identical in every language, so it skips data-i18n entirely.
     "hero_heading_html": '<span class="knot-glyph hero-signature" aria-hidden="true">A</span>'
                           '<span class="visually-hidden">Adrián Jiménez Pascual</span>'},
    {"name": "about", "title": "About — Adrï",
     "description": "About Adrián Jiménez Pascual.",
     "hero_variant": "hero--compact", "has_subtitle": False, "extra_css": [], "extra_js": []},
    {"name": "background", "title": "Academic Background — Adrï",
     "description": "Academic background, papers and talks.",
     "hero_variant": "hero--compact", "has_subtitle": True, "extra_css": [], "extra_js": []},
    {"name": "work", "title": "Working Experience — Adrï",
     "description": "Working experience: jobs, internships and full-time roles.",
     "hero_variant": "hero--compact", "has_subtitle": True, "extra_css": [], "extra_js": []},
    {"name": "my-apps", "title": "Exploring — Adrï",
     "description": "Hobby projects and interactive apps.",
     "hero_variant": "hero--compact", "has_subtitle": True,
     "extra_css": ["/assets/css/apps-theme.css"],
     "extra_js": ["/assets/js/filter-chips.js", "/assets/js/view-counts.js"]},
    {"name": "games", "title": "Games Recommendations — Adrï",
     "description": "A curated selection of game recommendations.",
     "hero_variant": "hero--compact", "has_subtitle": True, "extra_css": [], "extra_js": []},
    {"name": "trips", "title": "Trips — Adrï",
     "description": "Places visited around the world.",
     "hero_variant": "hero--compact", "has_subtitle": True, "extra_css": [], "extra_js": []},
    {"name": "trips-map", "title": "Map of Touch-downs — Adrï",
     "description": "Interactive world map of the places visited.",
     "hero_variant": "hero--compact", "has_subtitle": False, "extra_css": [], "extra_js": []},
    {"name": "contact", "title": "Contact — Adrï",
     "description": "Get in touch.",
     "hero_variant": "hero--compact", "has_subtitle": False, "extra_css": [], "extra_js": []},
    {"name": "thanks", "title": "Thanks — Adrï",
     "description": "Thank you for your message.",
     "hero_variant": "hero--compact", "has_subtitle": False, "extra_css": [], "extra_js": []},
]


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTIALS = SRC / "partials"
I18N = SRC / "i18n"
DIST = ROOT / "dist"
LANGUAGES = ("en", "es", "ja")


def read_text(path):
    return path.read_text(encoding="utf-8")


def load_page_strings(name, common):
    page_path = I18N / f"{name}.json"
    page = json.loads(read_text(page_path)) if page_path.exists() else {}
    merged = {
        language: {**common.get(language, {}), **page.get(language, {})}
        for language in LANGUAGES
    }
    return json.dumps(merged, ensure_ascii=False).replace("</", "<\\/")


def build_page(page, partials, common):
    extra_css = "\n".join(
        f'<link rel="stylesheet" href="{href}">' for href in page["extra_css"]
    )
    head = (partials["head"]
            .replace("{{TITLE}}", page["title"])
            .replace("{{DESCRIPTION}}", page["description"])
            .replace("{{EXTRA_CSS}}", extra_css))
    subtitle = '<p class="subtitle" data-i18n="pageSubtitle"></p>' if page["has_subtitle"] else ""
    is_hub = page["hero_variant"] == "hero--full"
    hero_heading = page.get("hero_heading_html", '<span data-i18n="pageTitle"></span>')
    # The animated particle-network canvas is landing-page-only — it's a
    # real per-frame cost, not worth paying on every page's short banner.
    hero_network = '<canvas class="hero-network" aria-hidden="true"></canvas>' if is_hub else ""
    header = (partials["header"]
              .replace("{{HERO_VARIANT_CLASS}}", page["hero_variant"])
              .replace("{{HERO_HEADING}}", hero_heading)
              .replace("{{HERO_SUBTITLE_BLOCK}}", subtitle)
              .replace("{{HERO_NETWORK}}", hero_network))
    footer = partials["footer"]

    body_path = SRC / "pages" / f'{page["name"]}.html'
    body = (read_text(body_path) if body_path.exists()
            else f'<div class="container"><!-- TODO: content for {page["name"]} --></div>')
    extra_js = "\n".join(f'<script src="{src}"></script>' for src in page["extra_js"])
    strings_script = "\n".join((
        "<script>",
        f"const STRINGS = {load_page_strings(page['name'], common)};",
        "I18N.init(STRINGS);",
        "</script>",
    ))

    return "\n".join((
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        head,
        "</head>",
        "<body>",
        partials["icons"],
        header,
        partials["nav"],
        '<main class="container">',
        body,
        "</main>",
        footer,
        partials["widget"],
        '<script src="/assets/js/i18n.js"></script>',
        '<script src="/assets/js/sticker.min.js"></script>',
        '<script src="/assets/js/main.js"></script>',
        '<script src="/assets/js/reveal.js"></script>',
        extra_js,
        strings_script,
        "</body>",
        "</html>",
    ))


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    partials = {
        name: read_text(PARTIALS / f"{name}.html")
        for name in ("head", "icons", "header", "nav", "footer", "widget")
    }
    common = json.loads(read_text(I18N / "common.json"))
    for page in PAGES:
        (DIST / f'{page["name"]}.html').write_text(
            build_page(page, partials, common), encoding="utf-8"
        )
    shutil.copytree(SRC / "assets", DIST / "assets")
    print(f"Built {len(PAGES)} pages -> dist/")


if __name__ == "__main__":
    main()
