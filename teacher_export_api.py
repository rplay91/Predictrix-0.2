import html
import os
import re
import tempfile
from dataclasses import dataclass
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import pymysql
from PIL import Image as PILImage
from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.shared import Inches
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from db_config import DB_CONFIG


class EssayHTMLToTextParser(HTMLParser):
    BLOCK_TAGS = {"p", "div", "section", "article", "li", "ul", "ol", "h1", "h2", "h3", "h4"}

    def __init__(self):
        super().__init__()
        self.parts: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("\n- ")

    def handle_endtag(self, tag):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if data:
            self.parts.append(data)

    def get_text(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


@dataclass
class ExportImage:
    iid: str
    keywords: str
    description: str
    file_path: Optional[str]


def html_to_text(raw_html: str) -> str:
    parser = EssayHTMLToTextParser()
    parser.feed(raw_html or "")
    parser.close()
    return parser.get_text() or "Tidak ada isi"


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def get_used_predictions(predictions: List[Dict]) -> List[str]:
    used: List[str] = []
    for pred in predictions:
        option = str(pred.get("option") or "").lower()
        if option not in {"correct", "modify"}:
            continue
        text = pred.get("modify_pcontent") if option == "modify" else pred.get("pcontent")
        normalized = normalize_whitespace(str(text or ""))
        if normalized:
            used.append(normalized)
    seen = set()
    deduped = []
    for item in used:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def split_text_for_highlight(text: str, highlights: List[str]) -> List[tuple[str, bool]]:
    if not text:
        return [("Tidak ada isi", False)]
    if not highlights:
        return [(text, False)]

    pattern = "|".join(re.escape(item) for item in sorted(highlights, key=len, reverse=True))
    if not pattern:
        return [(text, False)]

    matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
    if not matches:
        return [(text, False)]

    parts: List[tuple[str, bool]] = []
    cursor = 0
    for match in matches:
        start, end = match.span()
        if start < cursor:
            continue
        if start > cursor:
            parts.append((text[cursor:start], False))
        parts.append((text[start:end], True))
        cursor = end
    if cursor < len(text):
        parts.append((text[cursor:], False))
    return parts


def make_safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^\w\-]+", "_", value or "essay")
    return cleaned.strip("_") or "essay"


def resolve_image_path(iid: str) -> Optional[str]:
    base = Path("static") / "assets" / "img" / str(iid)
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = base.with_suffix(ext)
        if candidate.exists():
            return str(candidate)
    return None


def prepare_image_for_export(image_path: Optional[str], output_dir: str) -> Optional[str]:
    if not image_path or not os.path.exists(image_path):
        return None

    suffix = Path(image_path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg"}:
        return image_path

    converted_path = os.path.join(
        output_dir, f"{Path(image_path).stem}_converted.png"
    )
    with PILImage.open(image_path) as img:
        img.convert("RGB").save(converted_path, format="PNG")
    return converted_path


def fetch_export_payload(eid: str) -> Dict:
    connection = pymysql.connect(**DB_CONFIG)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    es.eid,
                    es.sid,
                    es.source,
                    es.state AS status,
                    s.name,
                    s.account,
                    ei.topic AS title,
                    ei.content AS content,
                    ei.duration_sec AS duration_sec,
                    COALESCE(ei.updated_at, es.updated_at) AS last_updated
                FROM essay_state es
                LEFT JOIN essay_info ei ON es.eid = ei.eid
                LEFT JOIN students s ON es.sid = s.sid
                WHERE es.eid = %s
                LIMIT 1
                """,
                (eid,),
            )
            essay_row = cursor.fetchone()
            if not essay_row:
                return {"success": False, "message": "Esai tidak ditemukan."}

            cursor.execute(
                """
                SELECT iid, keywords, modify_keywords, description, modify_description, updated_at
                FROM image
                WHERE eid = %s
                ORDER BY iid ASC
                """,
                (eid,),
            )
            image_rows = cursor.fetchall() or []

            cursor.execute("SHOW TABLES LIKE 'prediction'")
            has_prediction_table = bool(cursor.fetchone())
            prediction_rows: List[Dict] = []
            if has_prediction_table:
                cursor.execute("SHOW COLUMNS FROM prediction")
                cols = {row["Field"] for row in cursor.fetchall()}

                def col_or_null(name: str) -> str:
                    return f"`{name}`" if name in cols else f"NULL AS `{name}`"

                select_cols = [
                    col_or_null("pid"),
                    col_or_null("eid"),
                    col_or_null("pname"),
                    col_or_null("pcontent"),
                    col_or_null("option"),
                    col_or_null("modify_pcontent"),
                    col_or_null("record_content"),
                    col_or_null("created_at"),
                    col_or_null("check_count"),
                    col_or_null("updated_at"),
                    col_or_null("prompt"),
                ]
                order_col = (
                    "created_at"
                    if "created_at" in cols
                    else ("updated_at" if "updated_at" in cols else "pid")
                )
                cursor.execute(
                    f"""
                    SELECT {", ".join(select_cols)}
                    FROM prediction
                    WHERE eid = %s
                    ORDER BY `{order_col}` ASC
                    """,
                    (eid,),
                )
                prediction_rows = cursor.fetchall() or []

            return {
                "success": True,
                "essay": dict(essay_row),
                "images": [dict(row) for row in image_rows],
                "predictions": [dict(row) for row in prediction_rows],
            }
    finally:
        connection.close()


def build_export_images(images: List[Dict], temp_dir: str) -> List[ExportImage]:
    export_images: List[ExportImage] = []
    for img in images:
        keywords = img.get("modify_keywords") or img.get("keywords") or ""
        description = img.get("modify_description") or img.get("description") or "-"
        raw_path = resolve_image_path(str(img.get("iid") or ""))
        prepared_path = prepare_image_for_export(raw_path, temp_dir)
        export_images.append(
            ExportImage(
                iid=str(img.get("iid") or "-"),
                keywords=str(keywords),
                description=str(description),
                file_path=prepared_path,
            )
        )
    return export_images


def add_docx_highlighted_paragraph(document: Document, text: str, highlights: List[str]):
    paragraph = document.add_paragraph()
    for segment, is_highlighted in split_text_for_highlight(text, highlights):
        run = paragraph.add_run(segment)
        if is_highlighted:
            run.font.highlight_color = WD_COLOR_INDEX.YELLOW


def create_docx_export(payload: Dict, output_path: str):
    essay = payload["essay"]
    images = payload["images"]
    predictions = payload["predictions"]
    document = Document()

    document.add_heading(f"Ekstrak Data Esai {essay.get('eid')}", level=0)
    document.add_paragraph(f"Judul Esai: {essay.get('title') or '-'}")
    document.add_paragraph(f"Sumber: {essay.get('source') or '-'}")
    document.add_paragraph(f"Akun Siswa: {essay.get('account') or '-'}")
    document.add_paragraph(f"Nama Siswa: {essay.get('name') or '-'}")
    document.add_paragraph(f"Status: {essay.get('status') or '-'}")
    document.add_paragraph(f"Modified: {essay.get('last_updated') or '-'}")

    export_images = build_export_images(images, os.path.dirname(output_path))
    document.add_heading("Gambar", level=1)
    if not export_images:
        document.add_paragraph("Tidak ada gambar.")
    else:
        for index, image in enumerate(export_images, start=1):
            document.add_heading(f"Gambar {index}", level=2)
            if image.file_path and os.path.exists(image.file_path):
                document.add_picture(image.file_path, width=Inches(4.8))
            document.add_paragraph(f"IID: {image.iid}")
            document.add_paragraph(f"Kata Kunci: {image.keywords or '-'}")
            document.add_paragraph(f"Deskripsi: {image.description or '-'}")

    essay_text = html_to_text(str(essay.get("content") or ""))
    used_predictions = get_used_predictions(predictions)

    document.add_heading("Judul Esai", level=1)
    document.add_paragraph(str(essay.get("title") or "-"))

    document.add_heading("Isi Esai", level=1)
    add_docx_highlighted_paragraph(document, essay_text, used_predictions)

    document.add_heading("Prediksi yang Digunakan", level=1)
    if not used_predictions:
        document.add_paragraph("Tidak ada prediksi yang digunakan.")
    else:
        for item in used_predictions:
            document.add_paragraph(item, style="List Bullet")

    document.add_heading("Semua Prediksi", level=1)
    if not predictions:
        document.add_paragraph("Tidak ada prediksi.")
    else:
        table = document.add_table(rows=1, cols=5)
        table.style = "Table Grid"
        headers = table.rows[0].cells
        headers[0].text = "Nama"
        headers[1].text = "Opsi"
        headers[2].text = "Konten Prediksi"
        headers[3].text = "Record Content"
        headers[4].text = "Prompt"

        for pred in predictions:
            row = table.add_row().cells
            option = str(pred.get("option") or "-")
            content = (
                pred.get("modify_pcontent")
                if option.lower() == "modify"
                else pred.get("pcontent")
            ) or "-"
            row[0].text = str(pred.get("pname") or "-")
            row[1].text = option
            row[2].text = str(content)
            row[3].text = str(pred.get("record_content") or "-")
            row[4].text = str(pred.get("prompt") or "-")

    document.save(output_path)


def build_pdf_highlight_markup(text: str, highlights: List[str]) -> str:
    lines = []
    current_line = []
    for segment, is_highlighted in split_text_for_highlight(text, highlights):
        escaped = html.escape(segment).replace("\n", "<br/>")
        if is_highlighted:
            current_line.append(f'<font backColor="#fff59d">{escaped}</font>')
        else:
            current_line.append(escaped)
    lines.append("".join(current_line))
    return "".join(lines) or "Tidak ada isi"


def create_pdf_export(payload: Dict, output_path: str):
    essay = payload["essay"]
    images = payload["images"]
    predictions = payload["predictions"]
    export_images = build_export_images(images, os.path.dirname(output_path))
    used_predictions = get_used_predictions(predictions)
    essay_text = html_to_text(str(essay.get("content") or ""))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "BodyWrapped",
        parent=styles["BodyText"],
        leading=16,
        spaceAfter=8,
    )
    title_style = ParagraphStyle(
        "TitleCustom",
        parent=styles["Title"],
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=14,
    )
    heading_style = ParagraphStyle(
        "HeadingCustom",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#111827"),
        spaceBefore=12,
        spaceAfter=8,
    )

    story = [
        Paragraph(f"Ekstrak Data Esai {essay.get('eid')}", title_style),
        Paragraph(f"<b>Judul Esai:</b> {html.escape(str(essay.get('title') or '-'))}", body_style),
        Paragraph(f"<b>Sumber:</b> {html.escape(str(essay.get('source') or '-'))}", body_style),
        Paragraph(f"<b>Akun Siswa:</b> {html.escape(str(essay.get('account') or '-'))}", body_style),
        Paragraph(f"<b>Nama Siswa:</b> {html.escape(str(essay.get('name') or '-'))}", body_style),
        Paragraph(f"<b>Status:</b> {html.escape(str(essay.get('status') or '-'))}", body_style),
        Paragraph(f"<b>Modified:</b> {html.escape(str(essay.get('last_updated') or '-'))}", body_style),
    ]

    story.append(Paragraph("Gambar", heading_style))
    if not export_images:
        story.append(Paragraph("Tidak ada gambar.", body_style))
    else:
        for index, image in enumerate(export_images, start=1):
            story.append(Paragraph(f"Gambar {index}", heading_style))
            if image.file_path and os.path.exists(image.file_path):
                with PILImage.open(image.file_path) as img:
                    width, height = img.size
                max_width = 4.8 * inch
                scale = min(max_width / width, 3.0 * inch / height, 1.0)
                story.append(RLImage(image.file_path, width=width * scale, height=height * scale))
                story.append(Spacer(1, 0.1 * inch))

            image_table = Table(
                [
                    ["IID", image.iid],
                    ["Kata Kunci", image.keywords or "-"],
                    ["Deskripsi", image.description or "-"],
                ],
                colWidths=[1.3 * inch, 4.9 * inch],
            )
            image_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("PADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(image_table)
            story.append(Spacer(1, 0.16 * inch))

    story.append(Paragraph("Isi Esai", heading_style))
    story.append(Paragraph(build_pdf_highlight_markup(essay_text, used_predictions), body_style))

    story.append(Paragraph("Prediksi yang Digunakan", heading_style))
    if not used_predictions:
        story.append(Paragraph("Tidak ada prediksi yang digunakan.", body_style))
    else:
        for item in used_predictions:
            story.append(Paragraph(f"&bull; {html.escape(item)}", body_style))

    story.append(Paragraph("Semua Prediksi", heading_style))
    if not predictions:
        story.append(Paragraph("Tidak ada prediksi.", body_style))
    else:
        rows = [["Nama", "Opsi", "Konten Prediksi", "Record Content"]]
        for pred in predictions:
            option = str(pred.get("option") or "-")
            content = (
                pred.get("modify_pcontent")
                if option.lower() == "modify"
                else pred.get("pcontent")
            ) or "-"
            rows.append(
                [
                    str(pred.get("pname") or "-"),
                    option,
                    str(content),
                    str(pred.get("record_content") or "-"),
                ]
            )
        prediction_table = Table(
            rows,
            colWidths=[1.2 * inch, 0.8 * inch, 2.6 * inch, 2.0 * inch],
            repeatRows=1,
        )
        prediction_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 5),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(prediction_table)

    doc.build(story)


def export_essay_file(eid: str, export_format: str) -> Dict:
    export_format = str(export_format or "").lower().strip()
    if export_format not in {"docx", "pdf"}:
        return {"success": False, "message": "Format ekspor tidak didukung."}

    payload = fetch_export_payload(eid)
    if not payload.get("success"):
        return payload

    essay = payload["essay"]
    title = make_safe_filename(str(essay.get("title") or f"essay_{eid}"))
    temp_dir = tempfile.mkdtemp(prefix=f"essay_export_{eid}_")
    output_path = os.path.join(temp_dir, f"{title}.{export_format}")

    if export_format == "docx":
        create_docx_export(payload, output_path)
    else:
        create_pdf_export(payload, output_path)

    return {
        "success": True,
        "file_path": output_path,
        "filename": os.path.basename(output_path),
        "temp_dir": temp_dir,
    }
