import json
import hashlib
from typing import Any, Dict, Optional

import pymysql

from db_config import DB_CONFIG


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))
    except Exception:
        return "{}"


def log_prompt_snapshot(
    *,
    sid: str,
    eid: int,
    prompt_snapshot: str,
    predicted_sentence: Optional[str] = None,
    model: Optional[str] = None,
    self_improve_result: Optional[Dict[str, Any]] = None,
) -> None:
    if not prompt_snapshot:
        return
    prompt_hash = hashlib.sha256(prompt_snapshot.encode("utf-8")).hexdigest()
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO prompt_snapshot_log (
                    sid,
                    eid,
                    model,
                    prompt_snapshot,
                    prompt_hash,
                    predicted_sentence,
                    self_improve_json,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """
            cursor.execute(
                sql,
                (
                    sid,
                    eid,
                    model,
                    prompt_snapshot,
                    prompt_hash,
                    predicted_sentence,
                    _safe_json(self_improve_result),
                ),
            )
        connection.commit()
    except Exception as exc:
        print(f"[WARNING] Failed to persist prompt snapshot log: {exc}")
    finally:
        if connection:
            connection.close()


def log_debug_event(
    *,
    sid: Optional[str],
    eid: Optional[int],
    stage: str,
    message: str,
    elapsed_ms: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    if not stage or not message:
        return
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO debug_log (
                    sid,
                    eid,
                    stage,
                    message,
                    elapsed_ms,
                    extra_json,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """
            cursor.execute(
                sql,
                (
                    sid,
                    eid,
                    stage,
                    message,
                    elapsed_ms,
                    _safe_json(extra),
                ),
            )
        connection.commit()
    except Exception as exc:
        print(f"[WARNING] Failed to persist debug log: {exc}")
    finally:
        if connection:
            connection.close()


def create_task_session(
    *,
    sid: str,
    eid: Optional[int],
    task_type: str,
    page_url: Optional[str],
    user_agent: Optional[str],
) -> Optional[int]:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO essay_task_sessions (
                    sid,
                    eid,
                    task_type,
                    page_url,
                    user_agent,
                    started_at,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            """
            cursor.execute(sql, (sid, eid, task_type, page_url, user_agent))
            session_id = cursor.lastrowid
        connection.commit()
        return int(session_id)
    except Exception as exc:
        print(f"[WARNING] Failed to create task session: {exc}")
        return None
    finally:
        if connection:
            connection.close()


def close_task_session(session_id: int) -> bool:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                UPDATE essay_task_sessions
                SET
                    ended_at = NOW(),
                    duration_sec = TIMESTAMPDIFF(SECOND, started_at, NOW()),
                    updated_at = NOW()
                WHERE id = %s AND ended_at IS NULL
            """
            cursor.execute(sql, (session_id,))
            affected = cursor.rowcount or 0
        connection.commit()
        return affected > 0
    except Exception as exc:
        print(f"[WARNING] Failed to close task session: {exc}")
        return False
    finally:
        if connection:
            connection.close()
