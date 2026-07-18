import pymysql
import json
import os
from datetime import datetime
from db_config import DB_CONFIG

DATA_DIR = "/run/media/cit/New Volume/2.Master-Degree/Predictrix-0.3-DATA-MATERIALS/data"
DEFAULT_PASSWORD = "123456"
SOURCE = "Journal"

conn = pymysql.connect(**DB_CONFIG)
cursor = conn.cursor()

def get_student_id(account):
    cursor.execute("SELECT sid FROM students WHERE account = %s", (account,))
    row = cursor.fetchone()
    return row["sid"] if row else None

def has_journal_essays(sid):
    cursor.execute(
        "SELECT COUNT(*) AS cnt FROM essay_state WHERE sid = %s AND source = %s",
        (sid, SOURCE),
    )
    return cursor.fetchone()["cnt"] > 0

def insert_student(account):
    cursor.execute(
        "INSERT INTO students (account, name, password) VALUES (%s, %s, %s)",
        (account, account, DEFAULT_PASSWORD),
    )
    return cursor.lastrowid

def insert_essay(sid, entry):
    topic = entry.get("title") or "Daily Journal"
    content = entry.get("content", "")
    start_time_str = entry.get("created_at")
    if start_time_str:
        start_time = datetime.fromisoformat(start_time_str)
    else:
        start_time = datetime.now()

    updated_at_str = entry.get("updated_at")
    updated_at = datetime.fromisoformat(updated_at_str) if updated_at_str else start_time

    cursor.execute(
        "INSERT INTO essay_info (topic, content, start_time, updated_at) VALUES (%s, %s, %s, %s)",
        (topic, content, start_time, updated_at),
    )
    eid = cursor.lastrowid

    cursor.execute(
        "INSERT INTO essay_state (sid, eid, source, state) VALUES (%s, %s, %s, %s)",
        (sid, eid, SOURCE, "Completed"),
    )

folders = sorted(
    f for f in os.listdir(DATA_DIR)
    if os.path.isdir(os.path.join(DATA_DIR, f))
)

total_students = 0
total_essays = 0
skipped_students = 0

for folder in folders:
    account = folder
    json_path = os.path.join(DATA_DIR, folder, f"{folder}.json")

    if not os.path.isfile(json_path):
        print(f"[SKIP] No JSON file for {folder}")
        continue

    sid = get_student_id(account)

    if sid is not None and has_journal_essays(sid):
        print(f"[SKIP] {account} already has Journal essays")
        skipped_students += 1
        continue

    if sid is None:
        sid = insert_student(account)
        print(f"[CREATE] Student {account} (sid={sid})")
    else:
        print(f"[EXISTS] Student {account} (sid={sid}), no Journal essays yet")

    with open(json_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    count = 0
    for entry in entries:
        content = entry.get("content", "").strip()
        phase = entry.get("phase", "")
        if not content or phase != "completed":
            continue
        insert_essay(sid, entry)
        count += 1

    total_students += 1
    total_essays += count
    print(f"  -> Imported {count} essays")

    conn.commit()

print()
print(f"Done. {total_students} students processed, {total_essays} essays imported, {skipped_students} skipped.")

cursor.close()
conn.close()
