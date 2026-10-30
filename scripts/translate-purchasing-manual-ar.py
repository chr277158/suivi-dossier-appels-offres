"""Translate each paragraph of the GCT manual into Arabic via Google Translate."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json
import re
import tempfile
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Manuel Achats GCT 29-12-2022.docx"
OUTPUT = ROOT / "scripts" / "purchasing-manual-ar.json"
CACHE = Path(tempfile.gettempdir()) / "gct-purchasing-manual-fr-ar-cache.json"
ENDPOINT = "https://translate.googleapis.com/translate_a/single"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
MAX_TEXT = 1050
MARKER = re.compile(r"ZXQ(\d{6})QXZ\s*(.*?)\s*ZXE\1XZ", re.DOTALL)


def translate_chunk(items: list[tuple[int, int, int, str]]) -> dict[int, str]:
    query = "\n".join(f"ZXQ{segment_id:06d}QXZ {part} ZXE{segment_id:06d}XZ" for segment_id, _, _, part in items)
    params = urlencode({"client": "gtx", "sl": "fr", "tl": "ar", "dt": "t", "q": query})
    request = Request(f"{ENDPOINT}?{params}", headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
        try:
            with urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
        except URLError:
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))
    translated = "".join(segment[0] for segment in payload[0] if segment and segment[0])
    result = {int(match.group(1)): match.group(2).strip() for match in MARKER.finditer(translated)}
    if len(result) != len(items):
        raise ValueError(f"La réponse a perdu des marqueurs ({len(result)}/{len(items)}).")
    return result


def split_text(text: str) -> list[str]:
    if len(text) <= MAX_TEXT:
        return [text]
    parts = []
    remaining = text
    while remaining:
        end = min(MAX_TEXT, len(remaining))
        if end < len(remaining):
            boundary = remaining.rfind(" ", 0, end)
            if boundary > MAX_TEXT // 2:
                end = boundary
        parts.append(remaining[:end].strip())
        remaining = remaining[end:].strip()
    return parts


def main() -> None:
    with zipfile.ZipFile(SOURCE) as document:
        root = ET.fromstring(document.read("word/document.xml"))
    body = root.find("w:body", NS)
    if body is None:
        raise RuntimeError("Le document ne contient pas de corps lisible.")
    paragraphs = body.findall(".//w:p", NS)
    source_texts = ["".join(node.text or "" for node in paragraph.findall(".//w:t", NS)) for paragraph in paragraphs]
    translations = [""] * len(source_texts)
    cached = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    jobs = []
    parts_by_paragraph: dict[int, list[int]] = {}
    chunks: list[list[tuple[int, int, int, str]]] = []
    current: list[tuple[int, int, int, str]] = []
    current_length = 0

    for index, text in enumerate(source_texts):
        if not text.strip():
            translations[index] = ""
            continue
        cached_value = cached.get(str(index))
        if cached_value:
            translations[index] = cached_value
            continue
        parts = split_text(text)
        parts_by_paragraph[index] = []
        for part_number, part in enumerate(parts):
            segment_id = sum(len(part_ids) for part_ids in parts_by_paragraph.values())
            parts_by_paragraph[index].append(segment_id)
            marker_size = 27
            if current and current_length + len(part) + marker_size > MAX_TEXT:
                chunks.append(current)
                current, current_length = [], 0
            current.append((segment_id, index, part_number, part))
            current_length += len(part) + marker_size
    if current:
        chunks.append(current)

    print(f"Paragraphes: {len(source_texts)}; lots à traduire: {len(chunks)}", flush=True)
    part_results: dict[int, dict[int, str]] = {index: {} for index in parts_by_paragraph}
    total = len(chunks)
    completed = 0
    with ThreadPoolExecutor(max_workers=1) as pool:
        futures = {pool.submit(translate_chunk, chunk): chunk for chunk in chunks}
        for future in as_completed(futures):
            translated_parts = future.result()
            for segment_id, index, part_number, _ in futures[future]:
                part_results[index][part_number] = translated_parts[segment_id]
            completed += 1
            if completed % 20 == 0 or completed == total:
                print(f"Lots terminés: {completed}/{total}", flush=True)
            for index in {index for _, index, _, _ in futures[future]}:
                if len(part_results[index]) == len(parts_by_paragraph[index]):
                    translations[index] = " ".join(part_results[index][part] for part in sorted(part_results[index])).strip()
                    cached[str(index)] = translations[index]
            if completed % 10 == 0 or completed == total:
                CACHE.write_text(json.dumps(cached, ensure_ascii=False), encoding="utf-8")
            time.sleep(0.9)

    missing = [index for index, text in enumerate(source_texts) if text.strip() and not translations[index]]
    if missing:
        raise RuntimeError(f"Traduction manquante pour {len(missing)} paragraphes; cache conservé dans {CACHE}.")
    OUTPUT.write_text(json.dumps(translations, ensure_ascii=False), encoding="utf-8")
    print(f"Traduction écrite dans {OUTPUT}")
    if CACHE.exists():
        CACHE.unlink()


if __name__ == "__main__":
    main()
