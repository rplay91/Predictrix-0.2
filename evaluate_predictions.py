import pymysql
import requests
import json
import re
import time
import sys
from pathlib import Path
from db_config import DB_CONFIG
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

API_URL = "http://localhost:8000/predict_sentence"
HEADERS = {"Content-Type": "application/json"}
STUDENTS_TO_EVAL = list(range(3, 43))
CHECKPOINT_PATH = Path(__file__).parent / "evaluation_checkpoint.json"
OUTPUT_PATH = Path(__file__).parent / "evaluation_results_copy.xlsx"

def extract_last_sentence(text):
    text = text.strip()
    if not text:
        return "", text
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return "", text
    return sentences[-1], " ".join(sentences[:-1])

def get_last_essays(conn):
    c = conn.cursor()
    sids = ",".join(str(s) for s in STUDENTS_TO_EVAL)
    query = f"""
        SELECT s.sid, s.account, es.eid, ei.content, ei.topic
        FROM students s
        JOIN essay_state es ON s.sid = es.sid
        JOIN essay_info ei ON es.eid = ei.eid
        WHERE es.source = 'Journal' AND es.state = 'Completed'
          AND s.sid IN ({sids})
          AND es.eid = (
              SELECT MAX(es2.eid) FROM essay_state es2
              WHERE es2.sid = s.sid AND es2.source = 'Journal' AND es2.state = 'Completed'
          )
        ORDER BY s.sid
    """
    c.execute(query)
    return c.fetchall()

def call_api(sid, eid, essay_body, title):
    payload = {
        "sid": str(sid), "eid": eid,
        "current_essay_content": essay_body,
        "history_essay_content": "", "images_info": [], "title": title
    }
    for attempt in range(2):
        try:
            resp = requests.post(API_URL, json=payload, headers=HEADERS, timeout=180)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data.get("predict_sentence", ""), data.get("predict_sentences", [])
        except Exception as e:
            if attempt == 0:
                time.sleep(3)
    return None, None

def save_state(results):
    data = {"results": results, "timestamp": time.time()}
    CHECKPOINT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def build_xlsx(results):
    wb = Workbook()
    ws = wb.active
    ws.title = "Evaluation"
    hfont = Font(bold=True, color="FFFFFF")
    hfill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    hs = ["No", "SID", "Account", "EID", "Topic", "Ground Truth Sentence", "Predicted Sentences", "BGE-M3 Score"]
    for ci, h in enumerate(hs, 1):
        c = ws.cell(row=1, column=ci, value=h)
        c.font = hfont; c.fill = hfill; c.alignment = Alignment(horizontal="center", wrap_text=True)
    for ri, row in enumerate(results, 2):
        for ci, key in enumerate(["no","sid","account","eid","topic","ground_truth_sentence","predicted_sentences","bge_m3_score"], 1):
            ws.cell(row=ri, column=ci, value=row.get(key, ""))
    ws.column_dimensions["A"].width = 6; ws.column_dimensions["B"].width = 8
    ws.column_dimensions["C"].width = 16; ws.column_dimensions["D"].width = 8
    ws.column_dimensions["E"].width = 45; ws.column_dimensions["F"].width = 65
    ws.column_dimensions["G"].width = 65; ws.column_dimensions["H"].width = 22
    wb.save(OUTPUT_PATH)

def main():
    results = []
    print(f"[SERVER] Checking {API_URL}...")
    try:
        r = requests.get("http://localhost:8000/docs", timeout=5)
        print(f"[SERVER] OK ({r.status_code})")
    except Exception as e:
        print(f"[SERVER] DOWN: {e}")
        return

    conn = pymysql.connect(**DB_CONFIG)
    essays = get_last_essays(conn)
    conn.close()
    print(f"[DB] Found {len(essays)} essays total")

    n = 0
    for essay in essays:
        if isinstance(essay, dict):
            sid, account, eid, content, topic = essay["sid"], essay["account"], essay["eid"], essay["content"], essay["topic"]
        else:
            sid, account, eid, content, topic = essay

        n += 1
        ground_truth, body_no_last = extract_last_sentence(content)
        if not ground_truth:
            print(f"[{n}/{len(essays)}] sid={sid} SKIP (no sentences)")
            continue

        essay_input = body_no_last + "\n[PREDICT SENTENCE]"
        print(f"[{n}/{len(essays)}] sid={sid} eid={eid}... GT: \"{ground_truth[:80]}\"")
        sys.stdout.flush()

        t0 = time.time()
        pred_text, pred_list = call_api(sid, eid, essay_input, topic)
        elapsed = time.time() - t0

        if pred_text is None:
            print(f"  FAIL after {elapsed:.0f}s")
            pred_text = ""; pred_list = []
        else:
            print(f"  OK ({elapsed:.0f}s) -> \"{pred_text[:80]}\"")

        results.append({
            "no": n, "sid": sid, "account": account, "eid": eid,
            "topic": topic, "ground_truth_sentence": ground_truth,
            "predicted_sentences": " ".join(pred_list) if pred_list else pred_text,
            "bge_m3_score": ""
        })
        sys.stdout.flush()

        if n % 5 == 0:
            save_state(results)
            build_xlsx(results)
            print(f"  [CHECKPOINT] {len(results)} results saved")

        time.sleep(1)

    save_state(results)
    build_xlsx(results)
    print(f"\nDONE: {len(results)} results -> {OUTPUT_PATH}")
    failed = [r for r in results if not r["predicted_sentences"].strip()]
    if failed:
        print(f"FAILED sids: {[r['sid'] for r in failed]}")

if __name__ == "__main__":
    main()
