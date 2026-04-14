import re
import pymysql
import json
from db_config import DB_CONFIG


def check_hw1_status(sid: str) -> dict:
    """Return homework 1 status information for a student.

    Args:
        sid (str): Student identifier.

    Returns:
        dict: Contains flags `hasEssay`, `state`, and `eid`.
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT state, eid
                FROM essay_state
                WHERE sid = %s 
                AND source = 'Homework1'
                AND state != 'Cancel';
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            return {
                'hasEssay': bool(result),
                'state': result['state'] if result else None,
                'eid': result['eid'] if result else None
            }
            
    except Exception as e:
        print(f"Error checking homework status: {str(e)}")
        return {
            'hasEssay': False,
            'state': None,
            'eid': None
        }
        
    finally:
        if connection:
            connection.close()

def check_hw2_status(sid: str) -> dict:
    """檢查學生作業2的狀態
    
    Args:
        sid (str): 學生ID
        
    Returns:
        dict: 包含狀態資訊的字典
        {
            'hasEssay': bool,  # NOTE: Comment replaced (original text contained non-English characters).
            'state': str | None  # NOTE: Comment replaced (original text contained non-English characters).
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT state, eid
                FROM essay_state
                WHERE sid = %s 
                AND source = 'Homework2'
                AND state != 'Cancel';
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            return {
                'hasEssay': bool(result),
                'state': result['state'] if result else None,
                'eid': result['eid'] if result else None
            }
            
    except Exception as e:
        print(f"Error checking homework status: {str(e)}")
        return {
            'hasEssay': False,
            'state': None,
            'eid': None
        }
        
    finally:
        if connection:
            connection.close()

def check_hw3_status(sid: str) -> dict:
    """Return homework 3 status information for a student."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT state, eid
                FROM essay_state
                WHERE sid = %s 
                AND source = 'Homework3'
                AND state != 'Cancel';
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            return {
                'hasEssay': bool(result),
                'state': result['state'] if result else None,
                'eid': result['eid'] if result else None
            }
            
    except Exception as e:
        print(f"Error checking homework status: {str(e)}")
        return {
            'hasEssay': False,
            'state': None,
            'eid': None
        }
        
    finally:
        if connection:
            connection.close()

def check_hw4_status(sid: str) -> dict:
    """Return homework 4 status information for a student."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT state, eid
                FROM essay_state
                WHERE sid = %s 
                AND source = 'Homework4'
                AND state != 'Cancel';
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()
            
            return {
                'hasEssay': bool(result),
                'state': result['state'] if result else None,
                'eid': result['eid'] if result else None
            }
            
    except Exception as e:
        print(f"Error checking homework status: {str(e)}")
        return {
            'hasEssay': False,
            'state': None,
            'eid': None
        }
        
    finally:
        if connection:
            connection.close()

def load_hw_data(eid: str) -> dict:
    """載入作業相關資料
    
    Args:
        eid (str): 文章ID
        
    Returns:
        dict: 包含文章資料的字典
        {
            'success': bool,
            'data': {
                'essay': {
                    'topic': str,
                    'content': str
                },
                'images': List[{
                    'iid': str,
                    'modify_keywords': List[str],
                    'modify_description': str
                }],
                'predictions': List[{
                    'pid': str,
                    'pname': str,
                    'pcontent': str,
                    'option': str,
                    'modify_pcontent': str,
                    'record_content': str
                }]
            }
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # NOTE: Comment replaced (original text contained non-English characters).
            essay_sql = """
                SELECT topic, content
                FROM essay_info
                WHERE eid = %s;
            """
            cursor.execute(essay_sql, (eid,))
            essay_data = cursor.fetchone()
            
            if not essay_data:
                return {
                    'success': False,
                    'error': 'Essay not found'
                }
            
            # NOTE: Comment replaced (original text contained non-English characters).
            images_sql = """
                SELECT iid, modify_keywords, modify_description
                FROM image
                WHERE eid = %s;
            """
            cursor.execute(images_sql, (eid,))
            images_data = cursor.fetchall()
            
            # NOTE: Comment replaced (original text contained non-English characters).
            predictions_sql = """
                SELECT pid, pname, pcontent, `option`, modify_pcontent, record_content
                FROM prediction
                WHERE eid = %s
                ORDER BY created_at DESC;
            """
            cursor.execute(predictions_sql, (eid,))
            predictions_data = cursor.fetchall()
            
            return {
                'success': True,
                'data': {
                    'essay': {
                        'topic': essay_data['topic'],
                        'content': essay_data['content']
                    },
                    'images': [{
                        'iid': img['iid'],
                        'modify_keywords': img['modify_keywords'].split(',') if img['modify_keywords'] else [],
                        'modify_description': img['modify_description']
                    } for img in images_data],
                    'predictions': [{
                        'pid': pred['pid'],
                        'pname': pred['pname'],
                        'pcontent': pred['pcontent'],
                        'option': pred['option'],
                        'modify_pcontent': pred['modify_pcontent'],
                        'record_content': pred['record_content']
                    } for pred in predictions_data]
                }
            }
            
    except Exception as e:
        print(f"Error loading essay data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def save_hw_content(eid: str, content: str, duration_sec: int | None = None) -> dict:
    """儲存文章內容
    
    Args:
        eid (str): 文章ID
        content (str): 要儲存的內容
        
    Returns:
        dict: 包含處理結果的字典
        {
            'success': bool,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            if duration_sec is None:
                sql = """
                    UPDATE essay_info
                    SET content = %s
                    WHERE eid = %s;
                """
                cursor.execute(sql, (content, eid))
            else:
                sql = """
                    UPDATE essay_info
                    SET content = %s,
                        duration_sec = %s
                    WHERE eid = %s;
                """
                cursor.execute(sql, (content, duration_sec, eid))
            connection.commit()
            
            return {
                'success': True
            }
            
    except Exception as e:
        print(f"Error saving essay content: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def submit_hw(eid: str, content: str, duration_sec: int | None = None) -> dict:
    """提交作業
    
    Args:
        eid (str): 文章ID
        content (str): 最終內容
        
    Returns:
        dict: {
            'success': bool,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        try:
            # NOTE: Comment replaced (original text contained non-English characters).
            if duration_sec is None:
                sql1 = """
                    UPDATE essay_info
                    SET content = %s
                    WHERE eid = %s
                """
                cursor.execute(sql1, (content, eid))
            else:
                sql1 = """
                    UPDATE essay_info
                    SET content = %s,
                        duration_sec = %s
                    WHERE eid = %s
                """
                cursor.execute(sql1, (content, duration_sec, eid))
            
            # NOTE: Comment replaced (original text contained non-English characters).
            sql2 = """
                UPDATE essay_state
                SET state = 'Completed'
                WHERE eid = %s
            """
            cursor.execute(sql2, (eid,))
            
            # NOTE: Comment replaced (original text contained non-English characters).
            connection.commit()
            
            return {
                'success': True
            }
            
        except Exception as e:
            # NOTE: Comment replaced (original text contained non-English characters).
            connection.rollback()
            raise e
            
    except Exception as e:
        print(f"Error submitting homework: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def reset_hw(eid: str) -> dict:
    """重置作業狀態
    
    Args:
        eid (str): 文章ID
        
    Returns:
        dict: {
            'success': bool,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                UPDATE essay_state
                SET state = 'Cancel'
                WHERE eid = %s
            """
            cursor.execute(sql, (eid,))

            # Remove any cached sentence pattern linked to this essay so future predictions regenerate it.
            delete_sql = """
                DELETE FROM sentence_patterns
                WHERE eid = %s
            """
            cursor.execute(delete_sql, (eid,))

            connection.commit()
            
            return {
                'success': True
            }
            
    except Exception as e:
        print(f"Error resetting homework: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def get_history_essays_content(sid: str) -> dict:
    """取得使用者過去的文章內容
    
    Args:
        sid (str): 學生ID
        
    Returns:
        dict: {
            'success': bool,
            'content': str,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT ei.content
                FROM essay_state es
                JOIN essay_info ei ON es.eid = ei.eid
                WHERE es.sid = %s
            """
            cursor.execute(sql, (sid,))
            results = cursor.fetchall()
            
            if not results:
                return {
                    'success': True,
                    'content': "No previous essays found."
                }
            
            # NOTE: Comment replaced (original text contained non-English characters).
            processed_contents = []
            for i, row in enumerate(results, 1):
                # NOTE: Comment replaced (original text contained non-English characters).
                content = re.sub(r'<[^>]+>', '', row['content'])
                # NOTE: Comment replaced (original text contained non-English characters).
                content = '\n'.join(line for line in content.splitlines() if line.strip())
                processed_contents.append(f"Essay {i}:\n{content}\n")
            
            # NOTE: Comment replaced (original text contained non-English characters).
            final_content = '\n'.join(processed_contents)
            
            return {
                'success': True,
                'content': final_content
            }
            
    except Exception as e:
        print(f"Error getting user essays: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def save_prediction_result(eid: str, prediction_data: dict) -> dict:
    """儲存預測結果
    
    Args:
        eid (str): 文章ID
        prediction_data (dict): 預測相關資料，包含：
            - pname (str): 預測ID
            - pcontent (str): 預測內容
            - option (str): 選擇的選項
            - modify_pcontent (str): 修改後的內容
            - record_content (str): 完整記錄內容
            - prompt (str, optional): 預測使用的 prompt
            
    Returns:
        dict: {
            'success': bool,
            'pid': str,
            'message': str,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # NOTE: Comment replaced (original text contained non-English characters).
            if 'prompt' in prediction_data and prediction_data['prompt']:
                sql = """
                    INSERT INTO prediction (
                        eid, pname, pcontent, `option`, modify_pcontent, 
                        record_content, prompt, created_at, check_count, updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, NOW(), 0, NOW()
                    )
                """
                cursor.execute(sql, (
                    eid,
                    prediction_data['pname'],
                    prediction_data['pcontent'],
                    prediction_data['option'],
                    prediction_data.get('modify_pcontent', None),  # NOTE: Comment replaced (original text contained non-English characters).
                    prediction_data['record_content'],
                    prediction_data['prompt']
                ))
            else:
                # NOTE: Comment replaced (original text contained non-English characters).
                sql = """
                    INSERT INTO prediction (
                        eid, pname, pcontent, `option`, modify_pcontent, 
                        record_content, created_at, check_count, updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, NOW(), 0, NOW()
                    )
                """
                cursor.execute(sql, (
                    eid,
                    prediction_data['pname'],
                    prediction_data['pcontent'],
                    prediction_data['option'],
                    prediction_data.get('modify_pcontent', None),  # NOTE: Comment replaced (original text contained non-English characters).
                    prediction_data['record_content']
                ))

            # NOTE: Comment replaced (original text contained non-English characters).
            pid = cursor.lastrowid
            
            connection.commit()
            
            return {
                'success': True,
                'pid': str(pid),
                'message': '儲存預測結果成功'
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        print(f"Error saving prediction: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
        
    finally:
        if connection:
            connection.close()

def update_prediction_check_count(pid: str) -> dict:
    """更新預測的查看次數
    
    Args:
        pid (str): 預測ID
        
    Returns:
        dict: {
            'success': bool,
            'error': str (optional)
        }
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                UPDATE prediction
                SET check_count = check_count + 1
                WHERE pid = %s
            """
            cursor.execute(sql, (pid,))
            connection.commit()
            
            return {
                'success': True,
                'message': '更新查看次數成功'
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            'success': False,
            'error': f'更新查看次數失敗: {str(e)}'
        }
        
    finally:
        if connection:
            connection.close()

def save_homework_feedback(feedback: dict) -> dict:
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO essay_feedback (
                    eid,
                    sid,
                    task_type,
                    q1_rating,
                    q1_comment,
                    q2_rating,
                    q2_comment,
                    predictions_json,
                    suggestion,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            cursor.execute(
                sql,
                (
                    feedback.get("eid"),
                    feedback.get("sid"),
                    feedback.get("task_type"),
                    feedback.get("q1_rating"),
                    feedback.get("q1_comment"),
                    feedback.get("q2_rating"),
                    feedback.get("q2_comment"),
                    json.dumps(feedback.get("predictions") or []),
                    feedback.get("suggestion"),
                ),
            )
            connection.commit()
        return {"success": True}
    except Exception as e:
        if connection:
            connection.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if connection:
            connection.close()

            
