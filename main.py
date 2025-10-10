# uvicorn main:app --host 0.0.0.0 --port 8000
import uvicorn
import base64
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List
from fastapi.responses import JSONResponse
from fastapi import Request
from starlette.requests import Request
from starlette.responses import JSONResponse

# python function
from login_api import verify_login, verify_teacher_login
from index_api import get_user_essays
from test_api import check_pretest_status, initialize_pretest_essay, update_pretest_essay_content, check_posttest_status, initialize_posttest_essay
from hw_writing_api import check_hw1_status, check_hw2_status, load_hw_data, save_hw_content, reset_hw, submit_hw, get_history_essays_content, save_prediction_result, update_prediction_check_count
from hw_setup_api import analyze_image, initialize_homework1_essay, initialize_homework2_essay, save_hw_images
from predict_api import get_predict_sentence
from show_essay_api import update_review_count
from teacher_index_api import get_all_essay_list


app = FastAPI()

# Serve static files from the local directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure Jinja2 template rendering
templates = Jinja2Templates(directory="templates")

# Public page routes
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/404", response_class=HTMLResponse)
async def error(request: Request):
    return templates.TemplateResponse("404.html", {"request": request})

@app.get("/show_essay", response_class=HTMLResponse)
async def show_essay(request: Request):
    return templates.TemplateResponse("show_essay.html", {"request": request})

@app.get("/hw1_writing_setup", response_class=HTMLResponse)
async def hw1_writing_setup(request: Request):
    return templates.TemplateResponse("hw1_writing_setup.html", {"request": request})

@app.get("/hw1_writing", response_class=HTMLResponse)
async def hw1_writing(request: Request):
    return templates.TemplateResponse("hw1_writing.html", {"request": request})

@app.get("/hw2_writing_setup", response_class=HTMLResponse)
async def hw2_writing_setup(request: Request):
    return templates.TemplateResponse("hw2_writing_setup.html", {"request": request})

@app.get("/hw2_writing", response_class=HTMLResponse)
async def hw2_writing(request: Request):
    return templates.TemplateResponse("hw2_writing.html", {"request": request})

@app.get("/test1_writing", response_class=HTMLResponse)
async def test1_writing(request: Request):
    return templates.TemplateResponse("test1_writing.html", {"request": request})

@app.get("/test2_writing", response_class=HTMLResponse)
async def test2_writing(request: Request):
    return templates.TemplateResponse("test2_writing.html", {"request": request})

@app.get("/hw_writing_setup_instruct", response_class=HTMLResponse)
async def hw_writing_setup_instruct(request: Request):
    return templates.TemplateResponse("hw_writing_setup_instruct.html", {"request": request})

@app.get("/hw_writing_instruct", response_class=HTMLResponse)
async def hw_writing_instruct(request: Request):
    return templates.TemplateResponse("hw_writing_instruct.html", {"request": request})

@app.get("/teacher_index", response_class=HTMLResponse)
async def teacher_index(request: Request):
    return templates.TemplateResponse("teacher_index.html", {"request": request})


# Login request payload
class LoginData(BaseModel):
    account: str
    password: str

@app.post("/verify_login")
async def api_login(login_data: LoginData):
    # Check teacher credentials first
    teacher_result = verify_teacher_login(login_data.account, login_data.password)
    
    if teacher_result.get("success"):
        return JSONResponse(content={
            "success": True,
            "isTeacher": True,
            "data": {
                "tid": teacher_result.get("data", {}).get("tid"),
                "username": teacher_result.get("data", {}).get("username")
            }
        })
    
    # Fallback to student login verification
    student_result = verify_login(login_data.account, login_data.password)
    if student_result.get("success"):
        return JSONResponse(content={
            "success": True,
            "isTeacher": False,
            "data": {
                "sid": student_result.get("data", {}).get("sid"),
                "username": student_result.get("data", {}).get("username")
            }
        })
    
    # Invalid credentials response
    return JSONResponse(content={
        "success": False,
        "message": "Invalid account or password."
    })

# Retrieve essays submitted by the student
@app.get("/get_user_essays/{sid}")
async def api_get_user_essays(sid: str):
    result = get_user_essays(sid)
    return JSONResponse(content=result)

# Check if the student can take the pre-test
@app.get("/check_pretest_status/{sid}")
async def api_check_pretest_status(sid: str):
    return JSONResponse(content={"canTakeTest": check_pretest_status(sid)})

# Check if the student can take the post-test
@app.get("/check_posttest_status/{sid}")
async def api_check_posttest_status(sid: str):
    return JSONResponse(content={"canTakeTest": check_posttest_status(sid)})

# Create a new pre-test essay
@app.post("/initialize_pretest/{sid}")
async def api_initialize_pretest(sid: str):
    result = initialize_pretest_essay(sid)
    return JSONResponse(content=result)

# Create a new post-test essay
@app.post("/initialize_posttest/{sid}")
async def api_initialize_posttest(sid: str):
    result = initialize_posttest_essay(sid)
    return JSONResponse(content=result)

# Shared request model for essay content
class EssayContent(BaseModel):
    content: str

@app.post("/update_pretest_essay/{eid}")
async def api_update_pretest_essay(eid: str, essay_content: EssayContent):
    result = update_pretest_essay_content(eid, essay_content.content)
    return JSONResponse(content=result)

# Check homework 1 availability
@app.get("/check_hw1_status/{sid}")
async def api_check_hw1_status(sid: str):
    result = check_hw1_status(sid)
    return JSONResponse(content=result)

# Check homework 2 availability
@app.get("/check_hw2_status/{sid}")
async def api_check_hw2_status(sid: str):
    result = check_hw2_status(sid)
    return JSONResponse(content=result)

# Analyze uploaded homework image
@app.post("/analyze_image/")
async def api_analyze_image(file: UploadFile = File(...)):
    try:
        # Read the uploaded file and convert it to Base64
        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Send the encoded image to the analysis service
        result = analyze_image(image_base64)
        return JSONResponse(content=result)
        
    except Exception as e:
        return JSONResponse(
            content={
                "success": False,
                "error": str(e)
            },
            status_code=500
        )

# Data models for homework setup
class ImageInfo(BaseModel):
    file_data: str
    keywords: List[str]
    description: str
    modify_keywords: List[str]
    modify_description: str

class HomeworkSetup(BaseModel):
    sid: str
    title: str
    images: List[ImageInfo]

@app.post("/initialize_homework1")
async def api_initialize_homework1(setup_data: HomeworkSetup):
    # 1. Create a homework 1 essay record
    essay_result = initialize_homework1_essay(setup_data.sid, setup_data.title)
    
    if not essay_result['success']:
        return JSONResponse(content=essay_result)
    
    # 2. Save related homework images
    images_result = save_hw_images(
        essay_result['eid'],
        [img.dict() for img in setup_data.images]
    )
    
    if not images_result['success']:
        return JSONResponse(content=images_result)
    
    return JSONResponse(content={
        'success': True,
        'eid': essay_result['eid']
    })

# Initialize homework 2 essay data
@app.post("/initialize_homework2")
async def api_initialize_homework2(setup_data: HomeworkSetup):
    # 1. Create a homework 2 essay record
    essay_result = initialize_homework2_essay(setup_data.sid, setup_data.title)
    
    if not essay_result['success']:
        return JSONResponse(content=essay_result)
    
    # 2. Save related homework images
    images_result = save_hw_images(
        essay_result['eid'],
        [img.dict() for img in setup_data.images]
    )
    
    if not images_result['success']:
        return JSONResponse(content=images_result)
    
    return JSONResponse(content={
        'success': True,
        'eid': essay_result['eid']
    })

# Load existing homework data
@app.get("/load_hw_data/{eid}")
async def api_load_hw_data(eid: str):
    result = load_hw_data(eid)
    return JSONResponse(content=result)

# Request body for saving homework content
class EssayContent(BaseModel):
    content: str

@app.post("/save_hw_content/{eid}")
async def api_save_hw_content(eid: str, essay_content: EssayContent):
    result = save_hw_content(eid, essay_content.content)
    return JSONResponse(content=result)

# Reset homework progress
@app.post("/reset_hw/{eid}")
async def api_reset_hw(eid: str):
    result = reset_hw(eid)
    return JSONResponse(content=result)

# Submit homework content
@app.post("/submit_hw/{eid}")
async def api_submit_hw(eid: str, essay_content: EssayContent):
    result = submit_hw(eid, essay_content.content)
    return JSONResponse(content=result)

# Retrieve historical essays for a student
@app.get("/get_history_essays_content/{sid}")
async def api_get_history_essays_content(sid: str):
    result = get_history_essays_content(sid)
    return JSONResponse(content=result)

# Defining the request model
class PredictRequest(BaseModel):
    sid: str
    eid: int
    current_essay_content: str
    history_essay_content: str
    images_info: List[dict]
    title: str


# predicting sentences 
@app.post("/predict_sentence")
async def api_predict_sentence(predict_request: PredictRequest):
    try:
        # Temporarily rely on the provided sid and eid values
        sid = predict_request.sid
        eid = predict_request.eid

        result, user_prompt = await get_predict_sentence(
            sid=sid,
            eid=eid,
            current_essay_content=predict_request.current_essay_content,
            history_essay_content=predict_request.history_essay_content,
            images_info=predict_request.images_info,
            title=predict_request.title
        )

        return JSONResponse(content={
            "success": True,
            "predict_sentence": result,
            "predict_prompt": user_prompt
        })
    except Exception as e:
        return JSONResponse(
            content={"success": False, "error": str(e)},
            status_code=500
        )



# Request payload for storing prediction results
class PredictionData(BaseModel):
    pname: str
    pcontent: str
    option: str
    modify_pcontent: str | None = None
    record_content: str
    prompt: str | None = None
    
@app.post("/save_prediction/{eid}")
async def api_save_prediction(eid: str, prediction_data: PredictionData):
    result = save_prediction_result(eid, prediction_data.dict())
    return JSONResponse(content=result)

# Update the review counter for an essay
@app.post("/update_review_count/{eid}")
async def api_update_review_count(eid: str):
    result = update_review_count(eid)
    return JSONResponse(content=result)

# Update the prediction verification counter
@app.post("/update_prediction_count/{pid}")
async def api_update_prediction_count(pid: str):
    result = update_prediction_check_count(pid)
    return JSONResponse(content=result)

# Retrieve all essays for the teacher dashboard
@app.get("/api/get_all_essay_list")
async def api_get_all_essay_list():
    result = get_all_essay_list()
    if result["success"]:
        return JSONResponse(content={
            "success": True,
            "data": result["data"]
        })
    else:
        return JSONResponse(
            content={
                "success": False,
                "message": result["message"]
            },
            status_code=500
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, timeout_keep_alive=120)
