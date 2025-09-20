import pymysql
from db_config import DB_CONFIG
from typing import Dict, Union

def verify_login(account: str, password: str) -> Dict[str, Union[bool, str, dict]]:
    """
    驗證使用者登入資訊
    
    Args:
        account: 使用者帳號
        password: 使用者密碼
        
    Returns:
        Dict: 包含登入結果的字典，格式如下：
        {
            "success": bool,
            "message": str,
            "data": {
                "sid": str,
                "username": str
            }
        }
    """
    try:
        # 連接資料庫
        connection = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            db=DB_CONFIG['db'],
            charset=DB_CONFIG['charset'],
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # 查詢使用者
            sql = """
                SELECT sid, name
                FROM students 
                WHERE account = %s AND password = %s
            """
            cursor.execute(sql, (account, password))
            user = cursor.fetchone()
            
            if user:
                # 登入成功
                return {
                    "success": True,
                    "message": "Login successful",
                    "data": {
                        "sid": str(user['sid']),
                        "username": user['name']
                    }
                }
            else:
                # 登入失敗
                return {
                    "success": False,
                    "message": "Invalid account or password"
                }
                
    except Exception as e:
        print(f"Login error: {str(e)}")
        return {
            "success": False,
            "message": "Server error occurred"
        }
    
    finally:
        if 'connection' in locals():
            connection.close()

def verify_teacher_login(account: str, password: str) -> Dict[str, Union[bool, str, dict]]:
    """
    驗證使用者登入資訊
    
    Args:
        account: 使用者帳號
        password: 使用者密碼
        
    Returns:
        Dict: 包含登入結果的字典，格式如下：
        {
            "success": bool,
            "message": str,
            "data": {
                "tid": str,
                "username": str
            }
        }
    """
    try:
        # 連接資料庫
        connection = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            db=DB_CONFIG['db'],
            charset=DB_CONFIG['charset'],
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # 查詢使用者
            sql = """
                SELECT tid, name
                FROM teacher 
                WHERE account = %s AND password = %s
            """
            cursor.execute(sql, (account, password))
            user = cursor.fetchone()
            
            if user:
                # 登入成功
                return {
                    "success": True,
                    "message": "Login successful",
                    "data": {
                        "tid": str(user['tid']),
                        "username": user['name']
                    }
                }
            else:
                # 登入失敗
                return {
                    "success": False,
                    "message": "Invalid account or password"
                }
                
    except Exception as e:
        print(f"Login error: {str(e)}")
        return {
            "success": False,
            "message": "Server error occurred"
        }
    
    finally:
        if 'connection' in locals():
            connection.close()