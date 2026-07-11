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
TRAILING_WORDS = {
    "the", "a", "an", "my", "thy", "and", "of", "in", "to", "for", "he", "is", "are",
    "who", "doth", "o", "as", "with", "that", "they", "thou", "thee", "ye", "we",
}


def normalize_line(line: str) -> str:
    return line.replace("\r", "\n").replace("\t", " ").strip()


def extract_lines(path: str) -> list[str]:
    with open(path, "rb") as handle:
        data = handle.read()

    candidates: list[str] = []
    for chunk in re.findall(rb"[\x20-\x7e\n\r\t]{4,}", data):
        candidates.append(chunk.decode("latin-1", errors="ignore"))
    for match in re.finditer(rb"(?:[\x20-\x7e]\x00){4,}", data):
        try:
            candidates.append(match.group(0).decode("utf-16-le", errors="ignore"))
        except UnicodeDecodeError:
            continue

    lines: list[str] = []
    for blob in candidates:
        for raw_line in re.split(r"[\r\n]+", blob):
            line = normalize_line(raw_line)
            if not line or len(line) < 2:
                continue
            if NOISE_RE.search(line):
                continue
            if re.fullmatch(r"[A-Za-z0-9+/=]{8,}", line):
                continue
            if "lelele" in line or "Blel" in line or "K)K" in line:
                continue
            if re.search(r"Permission granted for use in presentations", line, re.I):
                continue
            lines.append(line)
    return trim_to_hymn_content(lines)


def trim_to_hymn_content(lines: list[str]) -> list[str]:
    for index, line in enumerate(lines):
        if HEADER_RE.match(line):
            return lines[index + 1 :]
    filtered = [
        line
        for line in lines
        if not re.search(r"copyright|it is written|permission granted|photoshop|jfif|adobe|background", line, re.I)
    ]
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
    return slides


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
    text = "\n".join(chunk).strip()
    first = chunk[0].strip() if chunk else ""
    if re.match(r"^Refrain:?\s*$", first, re.I):
        body = "\n".join(chunk[1:]).strip()
        return "chorus", "Chorus", "", body
    if re.match(r"^Verse\s*\d+", first, re.I):
        match = re.match(r"^(Verse\s*\d+)", first, re.I)
        label = match.group(1).title().replace("  ", " ") if match else f"Verse {verse_idx}"
        marker_match = re.search(r"\d+", label)
        marker = marker_match.group(0) if marker_match else str(verse_idx)
        body = "\n".join(chunk[1:]).strip() or text
        return "verse", label, marker, body
    return "verse", f"Verse {verse_idx}", str(verse_idx), text


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
        body = body.strip()
        if not body:
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
        filename = f"SDA{number}.ppt"
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


def main() -> int:
    source_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not os.path.isdir(source_dir) and os.path.isdir(FALLBACK_SOURCE):
        source_dir = FALLBACK_SOURCE
    max_hymn = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_HYMN

    if not os.path.isdir(source_dir):
        print(f"Source directory not found: {source_dir}", file=sys.stderr)
        return 1

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
