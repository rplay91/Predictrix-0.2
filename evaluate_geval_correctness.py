import argparse
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from pydantic import BaseModel, Field

from api_config import GPT_API_KEY


DEFAULT_SOURCE = "evaluation_results.xlsx"
DEFAULT_OUTPUT = "evaluation_results_geval.xlsx"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_THRESHOLD = 0.7


class CorrectnessResult(BaseModel):
    score: int = Field(ge=0, le=10)
    reason: str


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate spreadsheet predictions with a GEval correctness rubric."
    )
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--retries", type=int, default=2)
    return parser.parse_args()


def evaluate_correctness(client, model, topic, expected, actual):
    prompt = f"""You are performing a GEval correctness evaluation.

Evaluation criteria:
1. Semantic alignment: Does ACTUAL_OUTPUT preserve the central meaning of EXPECTED_OUTPUT?
2. Key-detail coverage: Are important actions, people, places, times, and feelings retained?
3. Factual consistency: Does ACTUAL_OUTPUT avoid contradictions and unsupported claims?
4. Logical correctness: Is ACTUAL_OUTPUT coherent as a possible next passage for the same topic?

Evaluation steps:
1. Identify the central claim and key details in EXPECTED_OUTPUT.
2. Compare every claim in ACTUAL_OUTPUT with those details.
3. Note omissions, contradictions, or unsupported additions.
4. Assign one integer score from 0 to 10 using this scale:
   - 10: Meaning and key details are fully preserved; no contradiction or unsupported claim.
   - 8-9: Strongly correct with only minor omissions or harmless elaboration.
   - 6-7: Partially correct, but important details are missing or unsupported details are added.
   - 3-5: Limited alignment; much of the meaning differs.
   - 0-2: Unrelated, contradictory, or effectively empty.
5. Explain the score in one or two concise sentences.

Essay topic: {topic or "Not provided"}
EXPECTED_OUTPUT:
{expected}

ACTUAL_OUTPUT:
{actual}
"""
    response = client.beta.chat.completions.parse(
        model=model,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
        response_format=CorrectnessResult,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise ValueError("The evaluator returned no structured result.")
    return parsed


def find_column(ws, name):
    for cell in ws[1]:
        if cell.value == name:
            return cell.column
    raise ValueError(f"Required column not found: {name}")


def add_result_columns(ws):
    headers = [
        "GEval Correctness Score",
        "GEval Raw Score (0-10)",
        "GEval Pass",
        "GEval Reason",
        "GEval Model",
        "GEval Time (seconds)",
        "GEval Error",
    ]
    existing = {cell.value: cell.column for cell in ws[1]}
    header_fill = PatternFill("solid", fgColor="70AD47")
    header_font = Font(bold=True, color="FFFFFF")
    columns = {}
    for header in headers:
        column = existing.get(header)
        if column is None:
            column = ws.max_column + 1
            cell = ws.cell(row=1, column=column, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        columns[header] = column
    ws.column_dimensions[ws.cell(1, columns["GEval Reason"]).column_letter].width = 65
    ws.column_dimensions[ws.cell(1, columns["GEval Error"]).column_letter].width = 40
    return columns


def write_summary(workbook, source, model, threshold, scores, passed):
    if "GEval Summary" in workbook.sheetnames:
        del workbook["GEval Summary"]
    ws = workbook.create_sheet("GEval Summary")
    ws.append(["Metric", "Value"])
    ws.append(["Source file", str(source)])
    ws.append(["Evaluator model", model])
    ws.append(["Pass threshold", threshold])
    ws.append(["Evaluated rows", len(scores)])
    ws.append(["Average correctness", round(statistics.mean(scores), 4) if scores else None])
    ws.append(["Minimum correctness", round(min(scores), 4) if scores else None])
    ws.append(["Maximum correctness", round(max(scores), 4) if scores else None])
    ws.append(["Passed rows", passed])
    ws.append(["Pass rate", round(passed / len(scores), 4) if scores else None])
    ws.append(["Evaluated at (UTC)", datetime.now(timezone.utc).isoformat()])
    for cell in ws[1]:
        cell.fill = PatternFill("solid", fgColor="4472C4")
        cell.font = Font(bold=True, color="FFFFFF")
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 45


def main():
    args = parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    if not source.exists():
        raise FileNotFoundError(f"Source workbook not found: {source}")
    if not 0 <= args.threshold <= 1:
        raise ValueError("--threshold must be between 0 and 1.")

    workbook = load_workbook(output if output.exists() else source)
    ws = workbook["Evaluation"] if "Evaluation" in workbook.sheetnames else workbook.active
    topic_col = find_column(ws, "Topic")
    expected_col = find_column(ws, "Ground Truth Sentence")
    actual_col = find_column(ws, "Predicted Sentences")
    result_cols = add_result_columns(ws)
    score_col = result_cols["GEval Correctness Score"]

    client = OpenAI(api_key=GPT_API_KEY)
    total = ws.max_row - 1
    for row in range(2, ws.max_row + 1):
        existing_score = ws.cell(row, score_col).value
        if isinstance(existing_score, (int, float)):
            print(f"[{row - 1}/{total}] already evaluated; skipping")
            continue

        topic = str(ws.cell(row, topic_col).value or "")
        expected = str(ws.cell(row, expected_col).value or "").strip()
        actual = str(ws.cell(row, actual_col).value or "").strip()
        started = time.time()
        error = ""
        result = None

        if not expected or not actual:
            error = "Missing expected or actual output."
        else:
            for attempt in range(args.retries + 1):
                try:
                    result = evaluate_correctness(client, args.model, topic, expected, actual)
                    break
                except Exception as exc:
                    error = str(exc)
                    if attempt < args.retries:
                        time.sleep(2 ** attempt)

        elapsed = round(time.time() - started, 2)
        if result is not None:
            normalized = result.score / 10
            ws.cell(row, result_cols["GEval Correctness Score"], normalized)
            ws.cell(row, result_cols["GEval Raw Score (0-10)"], result.score)
            ws.cell(row, result_cols["GEval Pass"], normalized >= args.threshold)
            ws.cell(row, result_cols["GEval Reason"], result.reason)
            error = ""
            print(f"[{row - 1}/{total}] score={normalized:.2f} time={elapsed:.2f}s")
        else:
            print(f"[{row - 1}/{total}] ERROR: {error}")
        ws.cell(row, result_cols["GEval Model"], args.model)
        ws.cell(row, result_cols["GEval Time (seconds)"], elapsed)
        ws.cell(row, result_cols["GEval Error"], error)
        workbook.save(output)

    scores = []
    passed = 0
    for row in range(2, ws.max_row + 1):
        score = ws.cell(row, score_col).value
        if isinstance(score, (int, float)):
            scores.append(float(score))
            passed += int(float(score) >= args.threshold)
    write_summary(workbook, source, args.model, args.threshold, scores, passed)
    workbook.save(output)

    average = statistics.mean(scores) if scores else 0
    print(f"Saved: {output}")
    print(f"Evaluated: {len(scores)}/{total}")
    print(f"Average correctness: {average:.4f}")
    print(f"Pass rate: {passed}/{len(scores)} ({passed / len(scores):.1%})" if scores else "Pass rate: n/a")


if __name__ == "__main__":
    main()
