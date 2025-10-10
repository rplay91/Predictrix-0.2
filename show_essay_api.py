from typing import Dict, Union
import pymysql
from db_config import DB_CONFIG

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
