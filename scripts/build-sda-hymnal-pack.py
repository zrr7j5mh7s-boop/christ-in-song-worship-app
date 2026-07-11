#!/usr/bin/env python3
"""Build the SDA Hymnal language pack from the consolidated PPTX or legacy PPT files."""

from __future__ import annotations

import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PPTX = os.path.join(
    ROOT,
    "Christ_in_Song_Multi_Language_Pack",
    "SDA_Hymnal_English_PowerPoint_Pack.pptx",
)
FALLBACK_SOURCE = os.path.join(ROOT, "data", "source", "sda-hymnal-ppt")
OUT_JSON = os.path.join(ROOT, "app", "data", "sda-hymnal-pack.json")
OUT_JS = os.path.join(ROOT, "app", "data", "sda-hymnal-pack.js")
MAX_HYMN = 695
XML_TEXT_TAG = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"

PPTX_HEADER_RE = re.compile(
    r"SDA HYMNAL – ENGLISH\s*(\d{3})\s+(.+?)"
    r"(VERSE\s*(\d+)\s*\d+|CHORUS\s*C?)"
    r"(VERSE|CHORUS)?",
    re.I,
)
FOOTER_RE = re.compile(r"HOMEINDEXPREVNEXT.*$", re.I)
HEADER_RE = re.compile(r"^Seventh-day Adventist Hymnal\s*$", re.I)
LEGACY_FOOTER_RE = re.compile(r"^SDA Hymnal\s*#\s*\d+\s*$", re.I)

NOISE_RE = re.compile(
    r"^(PK$|\.xml|Master|Photoshop|Copyright|Click to edit|level$|Microsoft|"
    r"Content_Types|_rels|drs/|JFIF|Adobe|8BIM|Permission|It Is Written|Written$|"
    r"Background$|Lucille|tableStyles|shapexml|downrev|Second level|Third level|"
    r"Fourth level|Fifth level|Photoshop 3\.0|HCopyright|rq#|lelele|Blel)$",
    re.I,
)
XML_NOISE_RE = re.compile(
    r"(\.xml|_rels|drs/|content_types|shapexml|downrev|\bPK\b|\[ILc|0XFo|\.\%B|U\]o)",
    re.I,
)
HYMN_HINT_RE = re.compile(
    r"\b(Lord|God|Thou|Thee|Thy|Jesus|Christ|Almighty|praise|love|faith|mercy|grace|heaven|holy|sing|soul|heart|bless|forever|amen|hallelujah|refrain|verse)\b",
    re.I,
)
DESIGN_NOISE_RE = re.compile(
    r"(Century Gothic|Default Design|Fonts Used|Slide Titles|Rectangle \d+|AutoShape \d+|"
    r"On-screen Show|Arial|Calibri|Design$|Root Entry|Current User|PowerPoint Document|"
    r"New Roman|Aquamarine Swirl)",
    re.I,
)
METADATA_RE = re.compile(
    r"(Microsoft Office|Windows User|Lucille Kaspersen|Creating Application|PowerPoint$|"
    r"Revision Number|Last Saved|Total Editing Time)",
    re.I,
)
TRAILING_WORDS = {
    "the", "a", "an", "my", "thy", "and", "of", "in", "to", "for", "he", "is", "are",
    "who", "doth", "o", "as", "with", "that", "they", "thou", "thee", "ye", "we", "from",
}


def normalize_line(line: str) -> str:
    return line.replace("\r", "\n").replace("\t", " ").strip()


GLUED_REPLACEMENTS = [
    ("thyhealth", "thy health"),
    ("thingsso", "things so"),
    ("sogently", "so gently"),
    ("prosperthy", "prosper thy"),
    ("dailyattend", "daily attend"),
    ("hear,Now", "hear,\nNow"),
    ("provided,Great", "provided,\nGreat"),
    ("harvest,Sun", "harvest,\nSun"),
    ("tomorrow,Blessings", "tomorrow,\nBlessings"),
    ("place,And", "place,\nAnd"),
    ("Father,There", "Father,\nThere"),
    ("Dove,Stay", "Dove,\nStay"),
    ("love,And", "love,\nAnd"),
    ("face,And", "face,\nAnd"),
    ("reigneth,Shieldeth", "reigneth,\nShieldeth"),
    ("thee;", "thee;\n"),
    ("will be.", "will be.\n"),
]


def format_lyric_body(text: str) -> str:
    text = FOOTER_RE.sub("", text)
    text = re.sub(r"\bChorus\b$", "", text, flags=re.I).strip()
    text = re.sub(r"^(VERSE|CHORUS)\s*$", "", text, flags=re.I).strip()
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    text = re.sub(r"(?<=[a-z])(?=\d)", " ", text)
    for old, new in GLUED_REPLACEMENTS:
        text = text.replace(old, new)
    text = re.sub(r"([.!?;])(?=[A-Z])", r"\1\n", text)
    text = re.sub(r",([a-z])", r",\n\1", text)
    text = re.sub(r";(?=[A-Z])", r";\n", text)
    text = re.sub(r"\s+", " ", text)
    lines = [line.strip() for line in re.split(r"[\n]+", text) if line.strip()]
    return "\n".join(lines)


def looks_like_lyric(line: str) -> bool:
    if LEGACY_FOOTER_RE.match(line) or HEADER_RE.match(line):
        return True
    if re.match(r"^(Refrain|Verse\s+\d+)", line, re.I):
        return True
    if re.search(r"[\[\]{}\\<>@%|^`~*_=#]", line):
        return False
    if METADATA_RE.search(line) or DESIGN_NOISE_RE.search(line):
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
    if LEGACY_FOOTER_RE.match(line) or HEADER_RE.match(line):
        return True
    if NOISE_RE.search(line) or XML_NOISE_RE.search(line):
        return False
    if re.fullmatch(r"[A-Za-z0-9+/=._\-\\]{4,}", line):
        return False
    if "lelele" in line or "Blel" in line or "K)K" in line:
        return False
    if re.search(r"copyright|it is written|permission granted|photoshop|jfif|adobe|background", line, re.I):
        return False
    if METADATA_RE.search(line) or DESIGN_NOISE_RE.search(line):
        return False
    return looks_like_lyric(line)


def extract_pptx_slide_text(xml_bytes: bytes) -> str:
    root = ET.fromstring(xml_bytes)
    parts: list[str] = []
    for node in root.iter(XML_TEXT_TAG):
        if node.text:
            parts.append(node.text)
        if node.tail:
            parts.append(node.tail)
    return "".join(parts)


def parse_pptx_slide(text: str) -> dict | None:
    if "Click a hymn" in text or "DIGITAL HYMN POWERPOINT PACK" in text:
        return None
    match = PPTX_HEADER_RE.search(text)
    if not match:
        return None

    number = match.group(1)
    title = match.group(2).strip()
    section_kind = match.group(3)
    verse_number = match.group(4)
    body_start = match.end()
    raw_body = text[body_start:]
    body = format_lyric_body(raw_body)
    if not body:
        return None

    if section_kind.upper().startswith("CHORUS"):
        kind, label, marker = "chorus", "Chorus", ""
    else:
        marker = verse_number or "1"
        kind, label = "verse", f"Verse {marker}"

    return {
        "number": number,
        "title": title,
        "kind": kind,
        "label": label,
        "marker": marker,
        "body": body,
    }


def build_song_from_pptx_slides(number: str, title: str, slide_rows: list[dict]) -> dict:
    slides: list[dict] = []
    sections: list[dict] = []
    seen_sections: set[str] = set()

    for row in slide_rows:
        body = row["body"].strip()
        if not body:
            continue
        slides.append(
            {
                "kind": row["kind"],
                "label": row["label"],
                "marker": row["marker"],
                "body": body,
                "sourceSlide": f"PPTX {len(slides) + 1}",
                "slideInHymn": len(slides) + 1,
                "totalSlides": 0,
            }
        )
        section_key = f"{row['kind']}:{row['label']}"
        if section_key not in seen_sections:
            seen_sections.add(section_key)
            sections.append(
                {
                    "kind": row["kind"],
                    "label": row["label"],
                    "marker": row["marker"],
                    "body": body,
                }
            )

    for slide in slides:
        slide["totalSlides"] = len(slides)

    clean_title = title.upper()
    return {
        "number": number,
        "title": clean_title,
        "language": "English",
        "languageCode": "sda",
        "slides": slides,
        "sections": sections,
        "hasChorus": any(section["kind"] == "chorus" for section in sections),
        "searchText": " ".join([clean_title.lower(), *[section["body"].lower() for section in sections]]),
    }


def build_pack_from_pptx(pptx_path: str, max_hymn: int = MAX_HYMN) -> dict:
    grouped: dict[str, dict] = {}
    skipped: list[str] = []

    with zipfile.ZipFile(pptx_path) as archive:
        slide_names = sorted(
            [name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml", name, re.I)],
            key=lambda value: int(re.search(r"slide(\d+)", value, re.I).group(1)),
        )
        for slide_name in slide_names:
            text = extract_pptx_slide_text(archive.read(slide_name))
            parsed = parse_pptx_slide(text)
            if not parsed:
                continue
            number = parsed["number"]
            if int(number) > max_hymn:
                continue
            entry = grouped.setdefault(number, {"title": parsed["title"], "slides": []})
            entry["title"] = parsed["title"]
            entry["slides"].append(parsed)

    songs: list[dict] = []
    for number in range(1, max_hymn + 1):
        key = str(number).zfill(3)
        entry = grouped.get(key)
        if not entry or not entry["slides"]:
            skipped.append(key)
            continue
        song = build_song_from_pptx_slides(key, entry["title"], entry["slides"])
        if song["slides"]:
            songs.append(song)
        else:
            skipped.append(key)

    return {
        "code": "sda",
        "name": "SDA Hymnal",
        "status": "ready",
        "source": "SDA_Hymnal_English_PowerPoint_Pack.pptx",
        "songCount": len(songs),
        "songs": songs,
        "_meta": {"skipped": skipped, "maxHymn": max_hymn, "sourceType": "pptx"},
    }


def extract_legacy_lines(path: str) -> list[str]:
    with open(path, "rb") as handle:
        data = handle.read()

    lines: list[str] = []
    for match in re.finditer(rb"(?:[\x20-\x7e]\x00){4,}", data):
        blob = match.group(0).decode("utf-16-le", errors="ignore")
        for raw_line in re.split(r"[\r\n]+", blob):
            line = normalize_line(raw_line)
            if is_hymn_line(line):
                lines.append(line)
    for index, line in enumerate(lines):
        if HEADER_RE.match(line):
            return lines[index + 1 :]
    return [line for line in lines if is_hymn_line(line)]


def split_legacy_slides(lines: list[str]) -> list[list[str]]:
    slides: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if LEGACY_FOOTER_RE.match(line):
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
    parts = title.split()
    while parts:
        word = parts[-1].rstrip(",;:.!?")
        if word.lower() in TRAILING_WORDS:
            parts.pop()
            continue
        break
    cleaned = " ".join(parts).rstrip(",;:.!? ")
    return cleaned or normalize_line(line)


def classify_legacy_slide(chunk: list[str], verse_idx: int) -> tuple[str, str, str, str]:
    chunk = [
        line for line in chunk
        if looks_like_lyric(line)
        and not LEGACY_FOOTER_RE.match(line)
        and not HEADER_RE.match(line)
        and not DESIGN_NOISE_RE.search(line)
    ]
    text = "\n".join(chunk).strip()
    first = chunk[0].strip() if chunk else ""
    if re.match(r"^Refrain:?\s*$", first, re.I):
        body = "\n".join(chunk[1:]).strip()
        return "chorus", "Chorus", "", body
    if re.match(r"^Refrain:", first, re.I):
        body = re.sub(r"^Refrain:\s*", "", first, flags=re.I)
        if len(chunk) > 1:
            body = (body + "\n" + "\n".join(chunk[1:]).strip()).strip() if body else "\n".join(chunk[1:]).strip()
        return "chorus", "Chorus", "", body
    if re.match(r"^Verse\s*\d+", first, re.I):
        label_match = re.match(r"^(Verse\s*\d+)", first, re.I)
        label = label_match.group(1).title().replace("  ", " ") if label_match else f"Verse {verse_idx}"
        marker_match = re.search(r"\d+", label)
        marker = marker_match.group(0) if marker_match else str(verse_idx)
        body = "\n".join(chunk[1:]).strip() or text
        return "verse", label, marker, body
    return "verse", f"Verse {verse_idx}", str(verse_idx), text


def clean_body(body: str) -> str:
    lines = [
        line.strip()
        for line in body.split("\n")
        if line.strip() and not DESIGN_NOISE_RE.search(line)
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


def parse_legacy_hymn(path: str, number: int) -> dict | None:
    slide_chunks = split_legacy_slides(extract_legacy_lines(path))
    if not slide_chunks:
        return None

    title = clean_title(slide_chunks[0][0])
    slides: list[dict] = []
    sections: list[dict] = []
    verse_idx = 0

    for chunk in slide_chunks:
        kind, label, marker, body = classify_legacy_slide(chunk, verse_idx + 1)
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
        "searchText": " ".join([title.lower(), *[section["body"].lower() for section in sections]]),
    }


def build_pack_from_legacy(source_dir: str, max_hymn: int = MAX_HYMN) -> dict:
    songs: list[dict] = []
    skipped: list[int] = []

    for number in range(1, max_hymn + 1):
        path = os.path.join(source_dir, f"SDA{number:03d}.ppt")
        if not os.path.isfile(path):
            skipped.append(number)
            continue
        hymn = parse_legacy_hymn(path, number)
        if hymn:
            songs.append(hymn)
        else:
            skipped.append(number)

    return {
        "code": "sda",
        "name": "SDA Hymnal",
        "status": "ready",
        "source": "Seventh-day Adventist Hymnal (legacy PPT collection)",
        "songCount": len(songs),
        "songs": songs,
        "_meta": {"skipped": skipped, "maxHymn": max_hymn, "sourceType": "legacy-ppt"},
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


def resolve_pptx_path(preferred: str) -> str | None:
    candidates = [preferred, DEFAULT_PPTX]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def resolve_legacy_dir(preferred: str) -> str | None:
    if preferred and os.path.isdir(preferred):
        return preferred
    if os.path.isdir(FALLBACK_SOURCE):
        return FALLBACK_SOURCE
    return None


def compare_sample(pack: dict, pptx_path: str, numbers: list[str]) -> None:
    with zipfile.ZipFile(pptx_path) as archive:
        pptx_rows: dict[str, list[dict]] = {}
        slide_names = sorted(
            [name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml", name, re.I)],
            key=lambda value: int(re.search(r"slide(\d+)", value, re.I).group(1)),
        )
        for slide_name in slide_names:
            parsed = parse_pptx_slide(extract_pptx_slide_text(archive.read(slide_name)))
            if not parsed:
                continue
            pptx_rows.setdefault(parsed["number"], []).append(parsed)

    by_number = {song["number"]: song for song in pack.get("songs", [])}
    print("Comparison (current pack vs PPTX source):")
    for number in numbers:
        song = by_number.get(number)
        source = pptx_rows.get(number)
        if not song or not source:
            print(f"  {number}: missing in {'pack' if song else 'pptx'}")
            continue
        print(
            f"  {number}: title '{song['title']}' -> '{source[0]['title'].upper()}' | "
            f"slides {len(song['slides'])} -> {len(source)}"
        )
        if song["slides"]:
            print(f"    before: {song['slides'][0]['body'][:120].replace(chr(10), ' | ')}")
        print(f"    after:  {source[0]['body'][:120].replace(chr(10), ' | ')}")


def main() -> int:
    pptx_arg = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].lower().endswith(".pptx") else ""
    legacy_arg = sys.argv[1] if len(sys.argv) > 1 and not pptx_arg else ""
    max_hymn = MAX_HYMN
    if len(sys.argv) > 2:
        max_hymn = int(sys.argv[2])
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        max_hymn = int(sys.argv[1])

    pptx_path = resolve_pptx_path(pptx_arg)
    if pptx_path:
        print(f"Building from PPTX: {pptx_path}")
        pack = build_pack_from_pptx(pptx_path, max_hymn)
    else:
        legacy_dir = resolve_legacy_dir(legacy_arg)
        if not legacy_dir:
            print("No PPTX or legacy PPT source found.", file=sys.stderr)
            return 1
        print(f"Building from legacy PPT directory: {legacy_dir}")
        pack = build_pack_from_legacy(legacy_dir, max_hymn)

    write_outputs(pack)
    skipped = pack.get("_meta", {}).get("skipped", [])
    print(
        f"Built SDA Hymnal pack with {pack['songCount']} hymns "
        f"(requested 1-{max_hymn}, skipped {len(skipped)})"
    )
    if pptx_path:
        compare_sample(pack, pptx_path, ["001", "100", "262", "695"])
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_JS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
