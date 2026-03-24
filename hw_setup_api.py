import pymysql
import os
import json
import base64
from datetime import datetime
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Dict
from api_config import GPT_API_KEY
from db_config import DB_CONFIG

client = OpenAI(api_key=GPT_API_KEY)


class ImageAnalysis(BaseModel):
    """Model hasil analisis gambar."""

    keywords: List[str]
    description: str


def analyze_image(image_base64: str) -> dict:
    """Menganalisis gambar dengan gpt-4o-mini dan menghasilkan kata kunci serta deskripsi untuk penulisan EFL."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Sebagai asisten penulisan EFL, mohon analisis gambar ini dan berikan:

1. Kata kunci (5-8 item):
- Kata benda penting (objek, orang, tempat)
- Kata kerja aksi (gerakan, aktivitas)
- Kata sifat deskriptif (warna, ukuran, emosi)

2. Deskripsi (2-3 kalimat):
- Gunakan kata kunci yang telah diidentifikasi
- Gunakan struktur kalimat yang jelas dan sederhana
- Jelaskan elemen utama dan hubungan antar elemen

Format jawaban:
Kata kunci:
[daftar kata kunci]

Deskripsi:
[deskripsi Anda]

Batasan jawaban: tidak boleh menggunakan karakter khusus. Hanya sertakan kata kunci dan deskripsi tanpa konten tambahan."""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
        )

        content = response.choices[0].message.content

        try:
            def extract_sections(text: str) -> tuple[str, str]:
                labels = [
                    ("Keywords:", "Description:"),
                    ("Kata kunci:", "Deskripsi:"),
                    ("Kata Kunci:", "Deskripsi:"),
                ]

                for kw_label, desc_label in labels:
                    if kw_label in text and desc_label in text:
                        kw_part = text.split(kw_label, 1)[1]
                        keywords_section = kw_part.split(desc_label, 1)[0]
                        description_section = kw_part.split(desc_label, 1)[1]
                        return keywords_section, description_section

                # Fallback: try regex (case-insensitive)
                import re

                pattern = re.compile(
                    r"(keywords|kata\\s*kunci)\\s*:\\s*(.*?)\\s*(description|deskripsi)\\s*:\\s*(.*)",
                    re.IGNORECASE | re.DOTALL,
                )
                match = pattern.search(text)
                if match:
                    return match.group(2), match.group(4)

                raise ValueError("Label tidak ditemukan")

            keywords_section, description_section = extract_sections(content)

            raw_keywords = [
                k.strip().strip("- ")
                for k in keywords_section.strip().split("\n")
                if k.strip() and k.strip() != "-"
            ]

            # Jika model mengembalikan satu baris dengan koma, pecah menjadi beberapa kata kunci.
            keywords: List[str] = []
            for item in raw_keywords:
                parts = [p.strip() for p in item.split(",") if p.strip()]
                if parts:
                    keywords.extend(parts)
                else:
                    keywords.append(item)

            description = description_section.strip()

            analysis = ImageAnalysis(
                keywords=keywords,
                description=description,
            )

            return {
                "success": True,
                "data": analysis.dict(),
            }

        except Exception:
            return {
                "success": False,
                "error": "Gagal mem-parsing format respons AI",
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


def initialize_homework1_essay(sid: str, title: str) -> Dict[str, any]:
    """
    Inisialisasi esai tugas 1.

    Args:
        sid (str): ID siswa
        title (str): judul esai

    Returns:
        Dict[str, any]: hasil proses inisialisasi
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES (%s, '', NOW())
            """
            cursor.execute(sql1, (title,))

            eid = cursor.lastrowid

            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Homework1', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))

            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Esai tugas 1 berhasil diinisialisasi",
            }

    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "error": f"Gagal menginisialisasi esai tugas 1: {str(e)}",
        }

    finally:
        if connection:
            connection.close()


def initialize_homework2_essay(sid: str, title: str) -> Dict[str, any]:
    """
    Inisialisasi esai tugas 2.

    Args:
        sid (str): ID siswa
        title (str): judul esai

    Returns:
        Dict[str, any]: hasil proses inisialisasi
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES (%s, '', NOW())
            """
            cursor.execute(sql1, (title,))

            eid = cursor.lastrowid

            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Homework2', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))

            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Esai tugas 2 berhasil diinisialisasi",
            }

    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "error": f"Gagal menginisialisasi esai tugas 2: {str(e)}",
        }

    finally:
        if connection:
            connection.close()


def save_hw_images(eid: str, images: List[dict]) -> dict:
    """
    Menyimpan informasi gambar untuk tugas.

    Args:
        eid (str): ID esai
        images (List[dict]): daftar info gambar, tiap dict berisi:
            - file_data: data gambar base64
            - keywords: kata kunci dari API
            - description: deskripsi dari API
            - modify_keywords: kata kunci yang diubah pengguna
            - modify_description: deskripsi yang diubah pengguna

    Returns:
        dict: hasil proses penyimpanan
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)

        def clean_text(text: str) -> str:
            """Membersihkan teks: menghapus spasi berlebih, baris baru, dan karakter khusus."""
            return text.strip().replace("\n", "").replace("\r", "").strip('"[]')

        def clean_keywords(keywords: List[str]) -> str:
            """Membersihkan daftar kata kunci dan menggabungkannya menjadi string."""
            cleaned = [clean_text(kw) for kw in keywords if clean_text(kw)]
            return ",".join(cleaned)

        results = []
        img_dir = os.path.join("static", "assets", "img")
        os.makedirs(img_dir, exist_ok=True)

        for img in images:
            with connection.cursor() as cursor:
                cleaned_data = {
                    "keywords": clean_keywords(img["keywords"]),
                    "modify_keywords": clean_keywords(img["modify_keywords"]),
                    "description": clean_text(img["description"]),
                    "modify_description": clean_text(img["modify_description"]),
                }

                sql = """
                    INSERT INTO image (
                        eid,
                        keywords,
                        modify_keywords,
                        description,
                        modify_description,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, NOW())
                """
                cursor.execute(
                    sql,
                    (
                        eid,
                        cleaned_data["keywords"],
                        cleaned_data["modify_keywords"],
                        cleaned_data["description"],
                        cleaned_data["modify_description"],
                    ),
                )

                iid = cursor.lastrowid

                try:
                    img_data = img["file_data"]
                    if "," in img_data:
                        img_data = img_data.split(",")[1]

                    img_binary = base64.b64decode(img_data)

                    img_header = img_binary[:10]
                    if img_header.startswith(b"\xFF\xD8"):
                        ext = ".jpg"
                    elif img_header.startswith(b"\x89PNG\r\n"):
                        ext = ".png"
                    elif img_header.startswith(b"RIFF") and b"WEBP" in img_header:
                        ext = ".webp"
                    else:
                        ext = ".jpg"

                    img_path = os.path.join(img_dir, f"{iid}{ext}")
                    with open(img_path, "wb") as f:
                        f.write(img_binary)

                except Exception as e:
                    print(f"Error saving image file: {str(e)}")
                    raise

                results.append({"iid": iid, "status": "success"})

        connection.commit()
        return {"success": True, "data": results}

    except Exception as e:
        if connection:
            connection.rollback()
        return {"success": False, "error": f"Gagal menyimpan gambar: {str(e)}"}

    finally:
        if connection:
            connection.close()
