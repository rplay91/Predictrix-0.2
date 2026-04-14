from typing import Dict, Union, Any
import pymysql
from db_config import DB_CONFIG

def get_essay_detail(eid: str) -> Dict[str, Union[bool, str, Dict[str, Any]]]:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT 
                    ei.eid,
                    ei.topic AS title,
                    ei.content AS content,
                    ei.updated_at AS last_updated,
                    es.source AS source,
                    es.state AS status,
                    es.sid AS sid
                FROM essay_info ei
                LEFT JOIN essay_state es ON ei.eid = es.eid
                WHERE ei.eid = %s
                LIMIT 1
            """
            cursor.execute(sql, (eid,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "Esai tidak ditemukan"}
            return {"success": True, "data": dict(row)}
    except Exception as e:
        return {"success": False, "error": f"Gagal memuat esai: {str(e)}"}
    finally:
        if connection:
            connection.close()

def get_essay_info(eid: str) -> Dict[str, Union[bool, str, Dict[str, Any]]]:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT 
                    eid,
                    topic,
                    content,
                    updated_at,
                    review_count,
                    duration_sec
                FROM essay_info
                WHERE eid = %s
                LIMIT 1
            """
            cursor.execute(sql, (eid,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "Esai tidak ditemukan"}
            data = dict(row)
            if isinstance(data.get("updated_at"), datetime):
                data["updated_at"] = data["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
            return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": f"Gagal memuat esai: {str(e)}"}
    finally:
        if connection:
            connection.close()

def update_review_count(eid: str) -> Dict[str, Union[bool, str]]:
    """
    更新文章的閱讀次數
    
    Args:
        eid (str): 文章ID
        
    Returns:
        Dict[str, Union[bool, str]]: 包含操作結果的字典
            - success (bool): 操作是否成功
            - message (str): 成功訊息
            - error (str): 錯誤訊息 (僅在失敗時存在)
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                UPDATE essay_info 
                SET review_count = review_count + 1 
                WHERE eid = %s
            """
            cursor.execute(sql, (eid,))
            connection.commit()
            
            return {
                "success": True,
                "message": "更新閱讀次數成功"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "error": f"更新閱讀次數失敗: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()
