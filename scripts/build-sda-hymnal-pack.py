#!/usr/bin/env python3
"""Build the SDA Hymnal language pack from legacy SDA###.ppt files."""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SOURCE = os.path.expanduser(
    "~/Desktop/Desktop - Vachinoda Mac/Hymn + Flyer/Expanded Hymnal"
)
FALLBACK_SOURCE = os.path.join(ROOT, "data", "source", "sda-hymnal-ppt")
OUT_JSON = os.path.join(ROOT, "app", "data", "sda-hymnal-pack.json")
OUT_JS = os.path.join(ROOT, "app", "data", "sda-hymnal-pack.js")
MAX_HYMN = 695

NOISE_RE = re.compile(
    r"^(PK$|\.xml|Master|Photoshop|Copyright|Click to edit|level$|Microsoft|"
    r"Content_Types|_rels|drs/|JFIF|Adobe|8BIM|Permission|It Is Written|Written$|"
    r"Background$|Lucille|tableStyles|shapexml|downrev|Second level|Third level|"
    r"Fourth level|Fifth level|Photoshop 3\.0|HCopyright|rq#|lelele|Blel)$",
    re.I,
)
FOOTER_RE = re.compile(r"^SDA Hymnal\s*#\s*\d+\s*$", re.I)
HEADER_RE = re.compile(r"^Seventh-day Adventist Hymnal\s*$", re.I)
XML_NOISE_RE = re.compile(
    r"(\.xml|_rels|drs/|content_types|shapexml|downrev|\bPK\b|\[ILc|0XFo|\.\%B|U\]o)",
    re.I,
)
HYMN_HINT_RE = re.compile(
    r"\b(Lord|God|Thou|Thee|Thy|Jesus|Christ|Almighty|praise|love|faith|mercy|grace|heaven|holy|sing|soul|heart|bless|forever|amen|hallelujah|refrain|verse)\b",
    re.I,
)
DESIGN_NOISE_RE = re.compile(
    r"(Century Gothic|Default Design|Fonts Used|Slide Titles|Rectangle \d+|AutoShape \d+|On-screen Show|Arial|Calibri|Design$)",
    re.I,
)
METADATA_RE = re.compile(
    r"(Microsoft Office|Windows User|Lucille Kaspersen|Creating Application|PowerPoint$|"
    r"Revision Number|Last Saved|Total Editing Time)",
    re.I,
)
TRAILING_WORDS = {
    "the", "a", "an", "my", "thy", "and", "of", "in", "to", "for", "he", "is", "are",
    "who", "doth", "o", "as", "with", "that", "they", "thou", "thee", "ye", "we",
}


def looks_like_lyric(line: str) -> bool:
    if FOOTER_RE.match(line) or HEADER_RE.match(line):
        return True
    if re.match(r"^(Refrain|Verse\s+\d+)", line, re.I):
        return True
    if re.search(r"[\[\]{}\\<>@%|^`~*_=#]", line):
        return False
    if METADATA_RE.search(line) or DESIGN_NOISE_RE.search(line) or re.search(r"On-screen Show|Slide Show|Times New Roman", line, re.I):
        return False
    punct = sum(1 for ch in line if ch in "!@#$%^&*()[]{}|\\<>?:;=")
    if punct / max(len(line), 1) > 0.12:
        return False
    if " " not in line and not re.match(r"^(Refrain|Verse\s+\d+)", line, re.I):
        return False
    letters = sum(ch.isalpha() for ch in line)
    if letters < 8:
        return False
    non_space = sum(1 for ch in line if not ch.isspace())
    return letters / max(non_space, 1) >= 0.55


def is_hymn_line(line: str) -> bool:
    if not line or len(line) < 3:
        return False
    if FOOTER_RE.match(line) or HEADER_RE.match(line):
        return True
    if NOISE_RE.search(line):
        return False
    if XML_NOISE_RE.search(line):
        return False
    if re.fullmatch(r"[A-Za-z0-9+/=._\-\\]{4,}", line):
        return False
    if "lelele" in line or "Blel" in line or "K)K" in line:
        return False
    if re.search(r"copyright|it is written|permission granted|photoshop|jfif|adobe|background", line, re.I):
        return False
    if METADATA_RE.search(line):
        return False
    if re.search(r"(?:[A-Za-z]{1,2}!){2,}", line):
        return False
    return looks_like_lyric(line)


def normalize_line(line: str) -> str:
    return line.replace("\r", "\n").replace("\t", " ").strip()


def extract_lines(path: str) -> list[str]:
    with open(path, "rb") as handle:
        data = handle.read()

    lines: list[str] = []
    for match in re.finditer(rb"(?:[\x20-\x7e]\x00){4,}", data):
        blob = match.group(0).decode("utf-16-le", errors="ignore")
        for raw_line in re.split(r"[\r\n]+", blob):
            line = normalize_line(raw_line)
            if is_hymn_line(line):
                lines.append(line)
    return trim_to_hymn_content(lines)


def trim_to_hymn_content(lines: list[str]) -> list[str]:
    for index, line in enumerate(lines):
        if HEADER_RE.match(line):
            return lines[index + 1 :]
    filtered = [line for line in lines if is_hymn_line(line)]
    return filtered


def split_slides(lines: list[str]) -> list[list[str]]:
    slides: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if FOOTER_RE.match(line):
            if current:
                slides.append(current)
                current = []
            continue
        if HEADER_RE.match(line):
            continue
        current.append(line)
    if current:
        slides.append(current)
    return [slide for slide in slides if slide]


def clean_title(line: str) -> str:
    title = normalize_line(line)
    if "!" in title:
        title = title.split("!", 1)[0] + "!"
    parts = title.split()
    while parts:
        word = parts[-1].rstrip(",;:.!?")
        if word.lower() in TRAILING_WORDS:
            parts.pop()
            continue
        break
    cleaned = " ".join(parts).rstrip(",;:.!? ")
    return cleaned or normalize_line(line)


def classify_slide(chunk: list[str], verse_idx: int) -> tuple[str, str, str, str]:
    chunk = [
        line for line in chunk
        if looks_like_lyric(line)
        and not FOOTER_RE.match(line)
        and not HEADER_RE.match(line)
        and not DESIGN_NOISE_RE.search(line)
        and not re.search(r"AutoShape", line, re.I)
    ]
    text = "\n".join(chunk).strip()
    first = chunk[0].strip() if chunk else ""
    if re.match(r"^Refrain:?\s*$", first, re.I):
        body = "\n".join(chunk[1:]).strip()
        return "chorus", "Chorus", "", body
    if re.match(r"^Refrain:", first, re.I):
        body = re.sub(r"^Refrain:\s*", "", first, flags=re.I)
        if len(chunk) > 1:
            body = body + "\n" + "\n".join(chunk[1:]).strip() if body else "\n".join(chunk[1:]).strip()
        return "chorus", "Chorus", "", body.strip()
    if re.match(r"^Verse\s*\d+", first, re.I):
        match = re.match(r"^(Verse\s*\d+)", first, re.I)
        label = match.group(1).title().replace("  ", " ") if match else f"Verse {verse_idx}"
        marker_match = re.search(r"\d+", label)
        marker = marker_match.group(0) if marker_match else str(verse_idx)
        body = "\n".join(chunk[1:]).strip() or text
        return "verse", label, marker, body
    return "verse", f"Verse {verse_idx}", str(verse_idx), text


def clean_body(body: str) -> str:
    lines = [
        line.strip()
        for line in body.split("\n")
        if line.strip() and not DESIGN_NOISE_RE.search(line) and not re.search(r"AutoShape", line, re.I)
    ]
    return "\n".join(lines).strip()


def is_valid_slide_body(body: str) -> bool:
    if not body or DESIGN_NOISE_RE.search(body):
        return False
    if HYMN_HINT_RE.search(body):
        return True
    words = re.findall(r"[A-Za-z']+", body)
    if len(words) < 4:
        return False
    return sum(len(word) for word in words) / len(words) >= 3.2


def parse_hymn(path: str, number: int) -> dict | None:
    slide_chunks = split_slides(extract_lines(path))
    if not slide_chunks:
        return None

    title = clean_title(slide_chunks[0][0])
    slides: list[dict] = []
    sections: list[dict] = []
    verse_idx = 0

    for chunk in slide_chunks:
        kind, label, marker, body = classify_slide(chunk, verse_idx + 1)
        if kind == "verse":
            verse_idx += 1
        body = clean_body(body.strip())
        if not body or not is_valid_slide_body(body):
            continue
        slides.append(
            {
                "kind": kind,
                "label": label,
                "marker": marker,
                "body": body,
                "slideInHymn": len(slides) + 1,
                "totalSlides": 0,
            }
        )
        sections.append(
            {
                "kind": kind,
                "label": label,
                "marker": marker,
                "body": body,
            }
        )

    if not slides:
        return None

    for slide in slides:
        slide["totalSlides"] = len(slides)

    return {
        "number": str(number).zfill(3),
        "title": title.upper(),
        "language": "English",
        "languageCode": "sda",
        "slides": slides,
        "sections": sections,
        "hasChorus": any(section["kind"] == "chorus" for section in sections),
        "searchText": " ".join(
            [title.lower(), *[section["body"].lower() for section in sections]]
        ),
    }


def build_pack(source_dir: str, max_hymn: int = MAX_HYMN) -> dict:
    songs: list[dict] = []
    skipped: list[int] = []

    for number in range(1, max_hymn + 1):
        filename = f"SDA{number:03d}.ppt"
        path = os.path.join(source_dir, filename)
        if not os.path.isfile(path):
            skipped.append(number)
            continue
        hymn = parse_hymn(path, number)
        if hymn:
            songs.append(hymn)
        else:
            skipped.append(number)

    return {
        "code": "sda",
        "name": "SDA Hymnal",
        "status": "ready",
        "source": "Seventh-day Adventist Hymnal (Expanded Hymnal PPT collection)",
        "songCount": len(songs),
        "songs": songs,
        "_meta": {"skipped": skipped, "maxHymn": max_hymn},
    }


def write_outputs(pack: dict) -> None:
    public_pack = {key: value for key, value in pack.items() if not key.startswith("_")}
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as handle:
        json.dump(public_pack, handle, ensure_ascii=False, separators=(",", ":"))

    js_payload = json.dumps(public_pack, ensure_ascii=False, separators=(",", ":"))
    js = (
        "window.CIS_SDA_HYMNAL_PACK = "
        + js_payload
        + ";\n"
        + "window.CIS_EXTRA_LANGUAGE_PACKS = window.CIS_EXTRA_LANGUAGE_PACKS || [];\n"
        + "if (!window.CIS_EXTRA_LANGUAGE_PACKS.some((pack) => pack.code === \"sda\")) {\n"
        + "  window.CIS_EXTRA_LANGUAGE_PACKS.push(window.CIS_SDA_HYMNAL_PACK);\n"
        + "}\n"
    )
    with open(OUT_JS, "w", encoding="utf-8") as handle:
        handle.write(js)


def resolve_source_dir(preferred: str) -> str:
    candidates = [preferred, FALLBACK_SOURCE, DEFAULT_SOURCE]
    best = preferred
    best_count = -1
    seen = set()
    for candidate in candidates:
        if not candidate or candidate in seen or not os.path.isdir(candidate):
            continue
        seen.add(candidate)
        count = len([
            name for name in os.listdir(candidate)
            if re.match(r"^SDA\d{3}\.ppt$", name, re.I)
        ])
        if count > best_count:
            best = candidate
            best_count = count
    return best


def main() -> int:
    preferred = sys.argv[1] if len(sys.argv) > 1 else FALLBACK_SOURCE
    source_dir = resolve_source_dir(preferred)
    max_hymn = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_HYMN

    if not os.path.isdir(source_dir):
        print(f"Source directory not found: {source_dir}", file=sys.stderr)
        return 1

    print(f"Using source directory: {source_dir}")
    pack = build_pack(source_dir, max_hymn)
    write_outputs(pack)
    skipped = pack.get("_meta", {}).get("skipped", [])
    print(
        f"Built SDA Hymnal pack with {pack['songCount']} hymns "
        f"(requested 1-{max_hymn}, skipped {len(skipped)})"
    )
    if skipped[:10]:
        print(f"First skipped numbers: {skipped[:10]}")
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_JS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
