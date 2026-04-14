import pymysql
from db_config import DB_CONFIG
from typing import Dict, List, Union
from datetime import datetime

def get_all_essay_list(page: int = 1, page_size: int = 20) -> Dict[str, Union[bool, str, int, List[Dict]]]:
    try:
        # 建立資料庫連線
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()

        page = max(1, int(page))
        page_size = max(1, int(page_size))
        offset = (page - 1) * page_size

        count_query = """
        SELECT COUNT(DISTINCT es.sid) AS total
        FROM essay_state es
        WHERE es.source NOT LIKE 'Previous%%'
        """
        cursor.execute(count_query)
        total_row = cursor.fetchone()
        total = total_row["total"] if total_row and "total" in total_row else 0

        student_query = """
        SELECT DISTINCT es.sid, s.name, s.account
        FROM essay_state es
        LEFT JOIN students s ON es.sid = s.sid
        WHERE es.source NOT LIKE 'Previous%%'
        ORDER BY es.sid ASC
        LIMIT %s OFFSET %s
        """
        cursor.execute(student_query, (page_size, offset))
        student_rows = cursor.fetchall()
        student_ids = [row["sid"] for row in student_rows if row.get("sid")]
        if not student_ids:
            return {
                "success": True,
                "data": [],
                "total": total
            }

        placeholders = ",".join(["%s"] * len(student_ids))
        query = f"""
        SELECT 
            es.eid,
            es.sid,
            s.name,
            s.account,
            es.source,
            ei.topic AS title,
            ei.content AS content,
            es.state AS status,
            COALESCE(ei.updated_at, es.updated_at) AS last_updated
        FROM 
            essay_state es
        LEFT JOIN
            essay_info ei ON es.eid = ei.eid
        LEFT JOIN
            students s ON es.sid = s.sid
        INNER JOIN (
            SELECT 
                es2.sid,
                es2.source,
                MAX(COALESCE(ei2.updated_at, es2.updated_at)) AS max_updated
            FROM essay_state es2
            LEFT JOIN essay_info ei2 ON es2.eid = ei2.eid
            WHERE es2.source NOT LIKE 'Previous%%'
            GROUP BY es2.sid, es2.source
        ) latest
          ON latest.sid = es.sid
         AND latest.source = es.source
         AND latest.max_updated = COALESCE(ei.updated_at, es.updated_at)
        WHERE 
            es.source NOT LIKE 'Previous%%'
            AND es.sid IN ({placeholders})
        ORDER BY 
            es.sid ASC, es.source ASC
        """
        cursor.execute(query, tuple(student_ids))
        essays = cursor.fetchall()

        # 處理 datetime 物件
        processed_essays = []
        for essay in essays:
            essay_dict = dict(essay)
            # 將 datetime 轉換為字串
            if 'last_updated' in essay_dict and isinstance(essay_dict['last_updated'], datetime):
                essay_dict['last_updated'] = essay_dict['last_updated'].strftime('%Y-%m-%d %H:%M:%S')
            processed_essays.append(essay_dict)

        return {
            "success": True,
            "data": processed_essays,
            "total": total
        }

    except pymysql.Error as e:
        print(f"資料庫錯誤: {str(e)}")  # 記錄錯誤
        return {
            "success": False,
            "message": "取得資料時發生錯誤"
        }
    except Exception as e:
        print(f"未預期的錯誤: {str(e)}")  # 記錄錯誤
        return {
            "success": False,
            "message": "系統發生未預期的錯誤"
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def get_images_by_eid(eid: str) -> Dict[str, Union[bool, str, List[Dict]]]:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT iid, eid, keywords, modify_keywords, description, modify_description, updated_at
                FROM image
                WHERE eid = %s
                ORDER BY iid ASC
            """
            cursor.execute(sql, (eid,))
            rows = cursor.fetchall()
            processed = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("updated_at"), datetime):
                    item["updated_at"] = item["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
                processed.append(item)
            return {"success": True, "data": processed}
    except Exception as e:
        return {"success": False, "message": f"Gagal memuat gambar: {str(e)}"}
    finally:
        if connection:
            connection.close()

def get_predictions_by_eid(eid: str) -> Dict[str, Union[bool, str, List[Dict]]]:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES LIKE 'prediction'")
            if not cursor.fetchone():
                return {"success": True, "data": []}

            cursor.execute("SHOW COLUMNS FROM prediction")
            cols = {row["Field"] for row in cursor.fetchall()}

            def col_or_null(name: str) -> str:
                if name in cols:
                    return f"`{name}`"
                return f"NULL AS `{name}`"

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

            order_col = "created_at" if "created_at" in cols else ("updated_at" if "updated_at" in cols else "pid")
            sql = f"""
                SELECT {", ".join(select_cols)}
                FROM prediction
                WHERE eid = %s
                ORDER BY `{order_col}` ASC
            """
            cursor.execute(sql, (eid,))
            rows = cursor.fetchall()
            processed = []
            for row in rows:
                item = dict(row)
                if isinstance(item.get("created_at"), datetime):
                    item["created_at"] = item["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(item.get("updated_at"), datetime):
                    item["updated_at"] = item["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
                processed.append(item)
            return {"success": True, "data": processed}
    except Exception as e:
        return {"success": False, "message": f"Gagal memuat prediksi: {str(e)}"}
    finally:
        if connection:
            connection.close()
