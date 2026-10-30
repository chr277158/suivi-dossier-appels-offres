"""Generate a searchable HTML rendition of the supplied GCT purchasing manual."""

from html import escape
from pathlib import Path
import re
import posixpath
import json
import zipfile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Manuel Achats GCT 29-12-2022.docx"
OUTPUT = ROOT / "client" / "public" / "manuel-achats-complet.html"
AR_OUTPUT = ROOT / "client" / "public" / "manuel-achats-complet-ar.html"
AR_TRANSLATIONS = ROOT / "scripts" / "purchasing-manual-ar.json"
ASSET_DIR = ROOT / "client" / "public" / "manuel-achats-assets"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
}


def tag(name: str) -> str:
    return f"{{{NS['w']}}}{name}"


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))


def render_run(run: ET.Element) -> str:
    content = "".join(escape(node.text or "") for node in run.findall(".//w:t", NS))
    if run.find("w:rPr/w:b", NS) is not None:
        content = f"<strong>{content}</strong>"
    if run.find("w:rPr/w:i", NS) is not None:
        content = f"<em>{content}</em>"
    return content


def render_paragraph(paragraph: ET.Element, relationships: dict[str, str], translated_text: str | None = None) -> str:
    properties = paragraph.find("w:pPr", NS)
    style = properties.find("w:pStyle", NS) if properties is not None else None
    style_name = style.get(tag("val"), "") if style is not None else ""
    if translated_text is not None:
        text = escape(translated_text)
    else:
        text = "".join(render_run(run) for run in paragraph.findall("w:r", NS))
        for hyperlink in paragraph.findall("w:hyperlink", NS):
            rel_id = hyperlink.get(f"{{{NS['r']}}}id", "")
            linked_text = "".join(render_run(run) for run in hyperlink.findall("w:r", NS))
            if rel_id in relationships:
                text += f'<a href="{escape(relationships[rel_id], quote=True)}">{linked_text}</a>'
            else:
                text += linked_text
    for drawing in paragraph.findall(".//a:blip", NS):
        rel_id = drawing.get(f"{{{NS['r']}}}embed", "")
        if rel_id in relationships:
            source = relationships[rel_id]
            if source.startswith("word/media/"):
                filename = Path(source).name
                text += f'<img class="manual-image" src="/manuel-achats-assets/{escape(filename, quote=True)}" alt="Illustration du manuel">'
    if not text.strip():
        return ""
    heading_match = re.fullmatch(r"Heading([1-6])", style_name, re.IGNORECASE)
    if heading_match:
        level = int(heading_match.group(1))
        return f"<h{level}>{text}</h{level}>"
    num_properties = properties.find("w:numPr", NS) if properties is not None else None
    if num_properties is not None:
        return f'<p class="manual-list-item">{text}</p>'
    return f"<p>{text}</p>"


def render_table(table: ET.Element, relationships: dict[str, str], translations: dict[int, str] | None = None) -> str:
    rows = []
    for row in table.findall("w:tr", NS):
        cells = []
        for cell in row.findall("w:tc", NS):
            contents = "".join(render_paragraph(paragraph, relationships, translations.get(id(paragraph)) if translations else None) for paragraph in cell.findall("w:p", NS))
            cells.append(f"<td>{contents}</td>")
        if cells:
            rows.append("<tr>" + "".join(cells) + "</tr>")
    return '<div class="manual-table-wrap"><table>' + "".join(rows) + "</table></div>" if rows else ""


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SOURCE) as document:
        document_root = ET.fromstring(document.read("word/document.xml"))
        relationships: dict[str, str] = {}
        if "word/_rels/document.xml.rels" in document.namelist():
            rels = ET.fromstring(document.read("word/_rels/document.xml.rels"))
            for rel in rels:
                target = rel.get("Target", "")
                if rel.get("TargetMode") != "External" and not target.startswith("/"):
                    target = posixpath.normpath(posixpath.join("word", target))
                relationships[rel.get("Id", "")] = target
        for name in document.namelist():
            if name.startswith("word/media/") and not name.endswith("/"):
                (ASSET_DIR / Path(name).name).write_bytes(document.read(name))

        body = document_root.find("w:body", NS)
        translations: dict[int, str] | None = None
        if AR_TRANSLATIONS.exists():
            translated_paragraphs = json.loads(AR_TRANSLATIONS.read_text(encoding="utf-8"))
            source_paragraphs = body.findall(".//w:p", NS) if body is not None else []
            if len(translated_paragraphs) != len(source_paragraphs):
                raise ValueError("Le fichier arabe ne correspond pas au nombre de paragraphes du manuel source.")
            translations = {id(paragraph): translated_paragraphs[index] for index, paragraph in enumerate(source_paragraphs)}

    def render_body(translation_map: dict[int, str] | None = None) -> list[str]:
        rendered_content = []
        if body is not None:
            for child in body:
                if child.tag == tag("p"):
                    rendered = render_paragraph(child, relationships, translation_map.get(id(child)) if translation_map else None)
                    if rendered:
                        rendered_content.append(rendered)
                elif child.tag == tag("tbl"):
                    rendered_content.append(render_table(child, relationships, translation_map))
        return rendered_content

    content = render_body()

    html = '''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manuel Achats GCT — 29 décembre 2022</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#263832;background:#f4f7f5}*{box-sizing:border-box}body{margin:0}.searchbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px max(16px,calc((100vw - 1100px)/2));background:#fff;border-bottom:1px solid #dce6e0;box-shadow:0 3px 12px #183e3810}.searchbar input{flex:1;min-width:180px;padding:11px 13px;border:1px solid #cad8cf;border-radius:10px;font:inherit}.searchbar button{padding:10px 13px;border:1px solid #d5e0d9;border-radius:9px;background:#f2f7f3;color:#234b3e;font:inherit;cursor:pointer}.searchbar output{min-width:95px;color:#52665d;font-size:13px}.document{max-width:1100px;margin:24px auto;padding:38px 48px;background:#fff;box-shadow:0 8px 30px #183e3810;line-height:1.65}.document h1,.document h2,.document h3,.document h4,.document h5,.document h6{color:#204b3f;line-height:1.3;margin:1.55em 0 .65em;scroll-margin-top:90px}.document h1{font-size:27px}.document h2{font-size:23px}.document h3{font-size:19px}.document p{margin:.55em 0}.document .manual-list-item{padding-inline-start:24px;position:relative}.document .manual-list-item:before{content:"•";position:absolute;inset-inline-start:8px;color:#c56c4f}.manual-table-wrap{overflow:auto;margin:18px 0;border:1px solid #dce6e0;border-radius:9px}.document table{width:100%;border-collapse:collapse;font-size:14px}.document td{min-width:100px;padding:9px 11px;border:1px solid #dce6e0;vertical-align:top}.document tr:first-child{background:#eff5f0;font-weight:700}.manual-image{max-width:100%;height:auto;display:block;margin:12px auto}.search-hit{background:#ffef9b!important;outline:2px solid #e2a939;border-radius:3px}.search-current{background:#ffd66f!important;outline:3px solid #c56c4f}.empty{color:#8a5b44}@media(max-width:650px){.document{margin:0;padding:24px 18px}.searchbar{padding:10px}.document h1{font-size:23px}}
</style></head><body>
<div class="searchbar"><input id="search" type="search" placeholder="Rechercher dans tout le manuel…" aria-label="Rechercher dans tout le manuel"><button id="previous" type="button" aria-label="Résultat précédent">↑ Précédent</button><button id="next" type="button" aria-label="Résultat suivant">Suivant ↓</button><output id="count" aria-live="polite">Saisissez un mot-clé</output></div>
<main class="document" id="document">CONTENT</main>
<script>
(()=>{const input=document.getElementById('search'),count=document.getElementById('count'),previous=document.getElementById('previous'),next=document.getElementById('next'),bar=document.querySelector('.searchbar'),blocks=[...document.querySelectorAll('#document p,#document h1,#document h2,#document h3,#document h4,#document h5,#document h6,#document tr')],rtl=new URLSearchParams(location.search).get('lang')==='ar';let hits=[],current=-1;const norm=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('fr');if(rtl){bar.dir='rtl';input.placeholder='ابحث في الدليل الكامل…';input.setAttribute('aria-label','ابحث في الدليل الكامل');previous.textContent='السابق ↑';previous.setAttribute('aria-label','النتيجة السابقة');next.textContent='التالي ↓';next.setAttribute('aria-label','النتيجة التالية');count.textContent='أدخل كلمة للبحث';document.documentElement.lang='ar'}function select(i){if(!hits.length)return;current=(i+hits.length)%hits.length;hits.forEach((el,n)=>el.classList.toggle('search-current',n===current));hits[current].scrollIntoView({behavior:'smooth',block:'center'});count.textContent=rtl?(current+1)+' / '+hits.length+' نتيجة':(current+1)+' / '+hits.length+' résultat'+(hits.length>1?'s':'')}function search(){const q=norm(input.value.trim());blocks.forEach(el=>el.classList.remove('search-hit','search-current'));hits=q?blocks.filter(el=>norm(el.innerText).includes(q)):[];current=-1;hits.forEach(el=>el.classList.add('search-hit'));if(!q)count.textContent=rtl?'أدخل كلمة للبحث':'Saisissez un mot-clé';else if(!hits.length)count.innerHTML=rtl?'<span class="empty">لا توجد نتائج</span>':'<span class="empty">Aucun résultat</span>';else select(0)}input.addEventListener('input',search);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();select(current+1)}else if(e.key==='Escape'){input.value='';search()}});previous.addEventListener('click',()=>select(current-1));next.addEventListener('click',()=>select(current+1))})();
</script></body></html>'''.replace("CONTENT", "\n".join(content))
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Generated {OUTPUT} ({len(content)} document blocks)")
    if translations is not None:
        translated_content = render_body(translations)
        arabic_html = html.replace('<html lang="fr">', '<html lang="ar">').replace(
            "Manuel Achats GCT — 29 décembre 2022", "دليل مشتريات GCT — 29 ديسمبر 2022"
        ).replace('<main class="document" id="document">', '<main class="document" id="document" dir="rtl"><aside class="translation-warning">ترجمة آلية إلى العربية للمساعدة على القراءة؛ يُرجى الرجوع إلى النسخة الفرنسية الأصلية عند تفسير الأحكام والإجراءات.</aside>')
        arabic_html = arabic_html.replace("CONTENT", "\n".join(translated_content))
        AR_OUTPUT.write_text(arabic_html, encoding="utf-8")
        print(f"Generated {AR_OUTPUT} ({len(translated_content)} document blocks)")


if __name__ == "__main__":
    main()
