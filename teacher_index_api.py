import pymysql
from db_config import DB_CONFIG
from typing import Dict, List, Union
from datetime import datetime

def get_all_essay_list() -> Dict[str, Union[bool, str, List[Dict]]]:
    try:
        # 建立資料庫連線
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # SQL 查詢
        query = """
        SELECT 
            es.eid,
            s.sid,
            s.name,
            s.account,
            es.source,
            ei.topic AS title,
            ei.content AS content,
            es.state AS status,
            ei.updated_at AS last_updated
        FROM 
            students s
        JOIN 
            essay_state es ON s.sid = es.sid
        JOIN 
            essay_info ei ON es.eid = ei.eid
        WHERE 
            s.account IN (
                '12a-2_Alexander',
                '12b-30_Vidya',
                '12b-5_Bayu',
                '12c-27_Olga',
                '12e-22_Kenneth',
                '12f-26_Mellinda',
                '12a-25_Nathania'
            )
            AND es.source NOT LIKE 'Previous%'
        ORDER BY 
            ei.eid DESC
        """        
        cursor.execute(query)
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
            "data": processed_essays
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