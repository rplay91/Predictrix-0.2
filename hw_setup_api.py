import pymysql
import os
import json
import base64
from datetime import datetime
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Dict
from api_config import GPT_API_KEY
from db_config import DB_CONFIG

client = OpenAI(api_key=GPT_API_KEY)

# NOTE: Comment replaced (original text contained non-English characters).
class ImageAnalysis(BaseModel):
    keywords: List[str]  # NOTE: Comment replaced (original text contained non-English characters).
    description: str     # NOTE: Comment replaced (original text contained non-English characters).

def analyze_image(image_base64: str) -> dict:
    """
    Analyze image content using gpt-4o-mini by first abstracting the overall scene,
    then generating keywords and descriptions to support EFL (English as a Foreign Language)
    writing tasks.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """You are an EFL writing assistant.

Before producing the final answer, perform the following internal steps:

Step 1: High-level understanding
- Identify the overall scene shown in the image.
- Determine what is happening, where it is happening, and who is involved.

Step 2: Abstraction for writing support
- Select elements that are most useful for EFL learners.
- Focus on concrete, observable objects, actions, and attributes.

Step 3: Final output generation
Based on the understanding above, provide:

1. Keywords (5–8 items):
- Important nouns (objects, people, places)
- Action verbs (movements, activities)
- Descriptive adjectives (colors, sizes, emotions)

2. Description (2–3 sentences):
- Use the identified keywords
- Use clear, simple, and beginner-friendly sentence structures
- Describe the main elements and their relationships logically

Format your response strictly as:
Keywords:
[list your keywords]

Description:
[your description]

Response restrictions:
- No special characters allowed
- Output only keywords and description
- Do not include explanations, reasoning steps, or extra text."""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )

        content = response.choices[0].message.content

        # Parse AI response
        try:
            # Separate keywords and description sections
            keywords_section = content.split("Keywords:")[1].split("Description:")[0]
            description_section = content.split("Description:")[1]

            # Process keywords
            keywords = [
                k.strip().strip("- ")
                for k in keywords_section.strip().split("\n")
                if k.strip() and k.strip() != "-"
            ]

            # Process description
            description = description_section.strip()

            # Validate using Pydantic model
            analysis = ImageAnalysis(
                keywords=keywords,
                description=description
            )

            return {
                "success": True,
                "data": analysis.dict()
            }

        except Exception:
            return {
                "success": False,
                "error": "Failed to parse AI response format"
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

    
def initialize_homework1_essay(sid: str, title: str) -> Dict[str, any]:
    """
    初始化作業文章
    
    Args:
        sid (str): 學生ID
        title (str): 文章主題
        
    Returns:
        Dict[str, any]: 包含處理結果的字典
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # NOTE: Comment replaced (original text contained non-English characters).
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES (%s, '', NOW())
            """
            cursor.execute(sql1, (title,))
            
            # NOTE: Comment replaced (original text contained non-English characters).
            eid = cursor.lastrowid
            
            # NOTE: Comment replaced (original text contained non-English characters).
            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Homework1', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))
            
            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Homework essay initialized successfully"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "error": f"Failed to initialize homework essay: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()

def initialize_homework2_essay(sid: str, title: str) -> Dict[str, any]:
    """
    初始化作業文章
    
    Args:
        sid (str): 學生ID
        title (str): 文章主題
        
    Returns:
        Dict[str, any]: 包含處理結果的字典
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # NOTE: Comment replaced (original text contained non-English characters).
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES (%s, '', NOW())
            """
            cursor.execute(sql1, (title,))
            
            # NOTE: Comment replaced (original text contained non-English characters).
            eid = cursor.lastrowid
            
            # NOTE: Comment replaced (original text contained non-English characters).
            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Homework2', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))
            
            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Homework essay initialized successfully"
            }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "error": f"Failed to initialize homework essay: {str(e)}"
        }
        
    finally:
        if connection:
            connection.close()

def save_hw_images(eid: str, images: List[dict]) -> dict:
    """
    儲存作業的圖片資訊
    
    Args:
        eid (str): 文章ID
        images (List[dict]): 圖片資訊列表，每個dict包含:
            - file_data: base64圖片資料
            - keywords: API分析的關鍵字列表
            - description: API分析的描述文字
            - modify_keywords: 使用者修改的關鍵字列表
            - modify_description: 使用者修改的描述文字
            
    Returns:
        dict: 包含處理結果的字典
    """
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        
        def clean_text(text: str) -> str:
            """清理文字，移除多餘空白、換行和特殊字元"""
            return text.strip().replace('\n', '').replace('\r', '').strip('"[]')
        
        def clean_keywords(keywords: List[str]) -> str:
            """清理關鍵字列表並轉換為字串"""
            cleaned = [clean_text(kw) for kw in keywords if clean_text(kw)]
            return ','.join(cleaned)  # NOTE: Comment replaced (original text contained non-English characters).
        
        results = []
        # NOTE: Comment replaced (original text contained non-English characters).
        img_dir = os.path.join('static', 'assets', 'img')
        os.makedirs(img_dir, exist_ok=True)
        
        for img in images:
            with connection.cursor() as cursor:
                # NOTE: Comment replaced (original text contained non-English characters).
                cleaned_data = {
                    'keywords': clean_keywords(img['keywords']),
                    'modify_keywords': clean_keywords(img['modify_keywords']),
                    'description': clean_text(img['description']),
                    'modify_description': clean_text(img['modify_description'])
                }
                
                # NOTE: Comment replaced (original text contained non-English characters).
                sql = """
                    INSERT INTO image (
                        eid, 
                        keywords, 
                        modify_keywords, 
                        description, 
                        modify_description, 
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, NOW())
                """
                cursor.execute(sql, (
                    eid,
                    cleaned_data['keywords'],  # NOTE: Comment replaced (original text contained non-English characters).
                    cleaned_data['modify_keywords'],
                    cleaned_data['description'],
                    cleaned_data['modify_description']
                ))
                
                # NOTE: Comment replaced (original text contained non-English characters).
                iid = cursor.lastrowid
                
                # NOTE: Comment replaced (original text contained non-English characters).
                try:
                    # NOTE: Comment replaced (original text contained non-English characters).
                    img_data = img['file_data']
                    if ',' in img_data:  # NOTE: Comment replaced (original text contained non-English characters).
                        img_data = img_data.split(',')[1]
                    
                    # NOTE: Comment replaced (original text contained non-English characters).
                    img_binary = base64.b64decode(img_data)
                    
                    # NOTE: Comment replaced (original text contained non-English characters).
                    img_header = img_binary[:10]
                    if img_header.startswith(b'\xFF\xD8'):
                        ext = '.jpg'
                    elif img_header.startswith(b'\x89PNG\r\n'):
                        ext = '.png'
                    elif img_header.startswith(b'RIFF') and b'WEBP' in img_header:
                        ext = '.webp'
                    else:
                        ext = '.jpg'  # NOTE: Comment replaced (original text contained non-English characters).
                    
                    # NOTE: Comment replaced (original text contained non-English characters).
                    img_path = os.path.join(img_dir, f"{iid}{ext}")
                    with open(img_path, 'wb') as f:
                        f.write(img_binary)
                    
                except Exception as e:
                    print(f"Error saving image file: {str(e)}")
                    raise
                
                results.append({
                    'iid': iid,
                    'status': 'success'
                })
        
        connection.commit()
        return {
            'success': True,
            'data': results
        }
            
    except Exception as e:
        if connection:
            connection.rollback()
        return {
            'success': False,
            'error': f'Failed to save images: {str(e)}'
        }
        
    finally:
        if connection:
            connection.close()
