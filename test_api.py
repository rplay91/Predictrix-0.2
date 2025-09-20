from typing import Dict, Union
import pymysql
from db_config import DB_CONFIG

def check_pretest_status(sid: str) -> bool:
    """
    檢查學生是否已完成前測
    
    Args:
        sid (str): 學生ID
        
    Returns:
        bool: True 表示尚未完成前測可以進入測驗，False 表示已完成前測
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT COUNT(*) AS count
                FROM essay_state
                WHERE sid = %s
                  AND source = 'Pre-test'
                  AND state = 'Completed'
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            # 如果 count = 0，表示尚未完成前測，回傳 True
            # 如果 count > 0，表示已完成前測，回傳 False
            return result['count'] == 0
            
    except Exception as e:
        print(f"檢查前測狀態時發生錯誤: {str(e)}")
        return False
        
    finally:
        if connection:
            connection.close()

def initialize_pretest_essay(sid: str) -> dict:
    """初始化前測文章"""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # 第一步：新增文章
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES ('How To Make Kimchi', '', NOW())
            """
            cursor.execute(sql1)
            
            # 第二步：取得新增的 eid
            eid = cursor.lastrowid
            
            # 第三步：新增狀態記錄
            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Pre-test', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))
            
            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Essay initialized successfully"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to initialize essay: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()

def update_pretest_essay_content(eid: str, content: str) -> dict:
    """更新文章內容和狀態"""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # 更新文章內容
            sql1 = """
                UPDATE essay_info 
                SET content = %s
                WHERE eid = %s
            """
            cursor.execute(sql1, (content, eid))
            
            # 更新文章狀態
            sql2 = """
                UPDATE essay_state
                SET state = 'Completed'
                WHERE eid = %s
            """
            cursor.execute(sql2, (eid,))
            
            connection.commit()
            return {
                "success": True,
                "message": "Essay updated successfully"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to update essay: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()

def check_posttest_status(sid: str) -> bool:
    """
    檢查學生是否已完成後測
    
    Args:
        sid (str): 學生ID
        
    Returns:
        bool: True 表示尚未完成後測可以進入測驗，False 表示已完成後測
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT COUNT(*) AS count
                FROM essay_state
                WHERE sid = %s
                  AND source = 'Post-test'
                  AND state = 'Completed'
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            # 如果 count = 0，表示尚未完成後測，回傳 True
            # 如果 count > 0，表示已完成後測，回傳 False
            return result['count'] == 0
            
    except Exception as e:
        print(f"檢查後測狀態時發生錯誤: {str(e)}")
        return False
        
    finally:
        if connection:
            connection.close()

def initialize_posttest_essay(sid: str) -> dict:
    """初始化後測文章"""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # 第一步：新增文章
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES ('Introducing Lebaran in Indonesia', '', NOW())
            """
            cursor.execute(sql1)
            
            # 第二步：取得新增的 eid
            eid = cursor.lastrowid
            
            # 第三步：新增狀態記錄
            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Post-test', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))
            
            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Essay initialized successfully"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to initialize essay: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()


