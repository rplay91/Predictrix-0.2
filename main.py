import os
# uvicorn main:app --host 0.0.0.0 --port 8000
import uvicorn
import base64
from typing import List

from fastapi import FastAPI, File, Request, UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.routing import Match
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from auth import create_access_token, verify_access_token

# python function
from login_api import verify_login, verify_teacher_login, register_student
from index_api import get_user_essays
from test_api import check_pretest_status, initialize_pretest_essay, update_pretest_essay_content, check_posttest_status, initialize_posttest_essay
from hw_writing_api import check_hw1_status, check_hw2_status, check_hw3_status, check_hw4_status, load_hw_data, save_hw_content, reset_hw, submit_hw, get_history_essays_content, save_prediction_result, update_prediction_check_count, save_homework_feedback
from hw_setup_api import analyze_image, initialize_homework1_essay, initialize_homework2_essay, initialize_homework3_essay, initialize_homework4_essay, save_hw_images
from predict_api import get_predict_sentence, run_feedback_loop
from show_essay_api import update_review_count, get_essay_detail, get_essay_info
from teacher_index_api import get_all_essay_list, get_images_by_eid, get_predictions_by_eid
from behavior_log_api import create_task_session, close_task_session


app = FastAPI()

cors_raw = os.environ.get("CORS_ALLOW_ORIGINS", "")
frontend_origins = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]
cors_allow_all = os.environ.get("CORS_ALLOW_ALL", "").strip().lower() in {"1", "true", "yes", "on"}
if "*" in frontend_origins or cors_allow_all:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif frontend_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Serve static files from the local directory (optional for frontend split)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure Jinja2 template rendering (optional for frontend split)
templates = Jinja2Templates(directory="templates")
API_BASE_URL = os.environ.get("API_BASE_URL", "").strip()

def render_template(request: Request, name: str):
    return templates.TemplateResponse(name, {"request": request, "api_base_url": API_BASE_URL})

AUTH_ENABLED = os.environ.get("AUTH_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}

AUTH_EXEMPT_PATHS = {
    "/",
    "/login",
    "/register",
    "/404",
    "/show_essay",
    "/hw1_writing_setup",
    "/hw1_writing",
    "/hw2_writing_setup",
    "/hw2_writing",
    "/hw3_writing_setup",
    "/hw3_writing",
    "/hw4_writing_setup",
    "/hw4_writing",
    "/test1_writing",
    "/test2_writing",
    "/hw_writing_setup_instruct",
    "/hw_writing_instruct",
    "/teacher_index",
    "/predict_test",
    "/verify_login",
    "/register",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if (
        not AUTH_ENABLED
        or request.method == "OPTIONS"
        or path in AUTH_EXEMPT_PATHS
        or path.startswith("/static")
    ):
        return await call_next(request)

    has_route = False
    for route in app.router.routes:
        match, _ = route.matches(request.scope)
        if match == Match.FULL:
            has_route = True
            break

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        if not has_route:
            return await call_next(request)
        return JSONResponse(content={"success": False, "error": "Missing token."}, status_code=401)

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = verify_access_token(token)
    except Exception:
        return JSONResponse(content={"success": False, "error": "Invalid token."}, status_code=401)

    # Restrict teacher-only endpoints
    if (
        (path.startswith("/api/get_all_essay_list") 
         or path.startswith("/api/essay_images")
         or path.startswith("/api/essay_predictions"))
        and payload.get("role") != "teacher"
    ):
        return JSONResponse(content={"success": False, "error": "Forbidden."}, status_code=403)

    request.state.user = payload
    return await call_next(request)

# Public page routes
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return render_template(request, "index.html")

@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return render_template(request, "login.html")

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return render_template(request, "register.html")

@app.get("/404", response_class=HTMLResponse)
async def error(request: Request):
    return render_template(request, "404.html")

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        response = render_template(request, "404.html")
        response.status_code = 404
        return response
    return JSONResponse(
        content={"success": False, "error": exc.detail},
        status_code=exc.status_code,
    )

@app.get("/show_essay", response_class=HTMLResponse)
async def show_essay(request: Request):
    return render_template(request, "show_essay.html")

@app.get("/hw1_writing_setup", response_class=HTMLResponse)
async def hw1_writing_setup(request: Request):
    return render_template(request, "hw1_writing_setup.html")

@app.get("/hw1_writing", response_class=HTMLResponse)
async def hw1_writing(request: Request):
    return render_template(request, "hw1_writing.html")

@app.get("/hw2_writing_setup", response_class=HTMLResponse)
async def hw2_writing_setup(request: Request):
    return render_template(request, "hw2_writing_setup.html")

@app.get("/hw2_writing", response_class=HTMLResponse)
async def hw2_writing(request: Request):
    return render_template(request, "hw2_writing.html")

@app.get("/hw3_writing_setup", response_class=HTMLResponse)
async def hw3_writing_setup(request: Request):
    return render_template(request, "hw3_writing_setup.html")

@app.get("/hw3_writing", response_class=HTMLResponse)
async def hw3_writing(request: Request):
    return render_template(request, "hw3_writing.html")

@app.get("/hw4_writing_setup", response_class=HTMLResponse)
async def hw4_writing_setup(request: Request):
    return render_template(request, "hw4_writing_setup.html")

@app.get("/hw4_writing", response_class=HTMLResponse)
async def hw4_writing(request: Request):
    return render_template(request, "hw4_writing.html")

@app.get("/test1_writing", response_class=HTMLResponse)
async def test1_writing(request: Request):
    return render_template(request, "test1_writing.html")

@app.get("/test2_writing", response_class=HTMLResponse)
async def test2_writing(request: Request):
    return render_template(request, "test2_writing.html")

@app.get("/hw_writing_setup_instruct", response_class=HTMLResponse)
async def hw_writing_setup_instruct(request: Request):
    return render_template(request, "hw_writing_setup_instruct.html")

@app.get("/hw_writing_instruct", response_class=HTMLResponse)
async def hw_writing_instruct(request: Request):
    return render_template(request, "hw_writing_instruct.html")

@app.get("/teacher_index", response_class=HTMLResponse)
async def teacher_index(request: Request):
    return render_template(request, "teacher_index.html")

@app.get("/predict_test", response_class=HTMLResponse)
async def predict_test(request: Request):
    return render_template(request, "predict_test.html")


# Login request payload
class LoginData(BaseModel):
    account: str
    password: str

class RegisterData(BaseModel):
    name: str
    account: str
    password: str

@app.post("/verify_login")
async def api_login(login_data: LoginData):
    # Check teacher credentials first
    teacher_result = verify_teacher_login(login_data.account, login_data.password)
    
    if teacher_result.get("success"):
        token = create_access_token(
            {
                "role": "teacher",
                "tid": teacher_result.get("data", {}).get("tid"),
                "username": teacher_result.get("data", {}).get("username"),
            }
        )
        return JSONResponse(content={
            "success": True,
            "isTeacher": True,
            "access_token": token,
            "token_type": "bearer",
            "data": {
                "tid": teacher_result.get("data", {}).get("tid"),
                "username": teacher_result.get("data", {}).get("username")
            }
        })
    
    # Fallback to student login verification
    student_result = verify_login(login_data.account, login_data.password)
    if student_result.get("success"):
        token = create_access_token(
            {
                "role": "student",
                "sid": student_result.get("data", {}).get("sid"),
                "username": student_result.get("data", {}).get("username"),
            }
        )
        return JSONResponse(content={
            "success": True,
            "isTeacher": False,
            "access_token": token,
            "token_type": "bearer",
            "data": {
                "sid": student_result.get("data", {}).get("sid"),
                "username": student_result.get("data", {}).get("username")
            }
        })
    
    # Invalid credentials response
    return JSONResponse(content={
        "success": False,
        "message": "Akun atau kata sandi salah."
    })

@app.post("/register")
async def api_register(register_data: RegisterData):
    name = register_data.name.strip()
    account = register_data.account.strip()
    password = register_data.password

    if not name or not account or not password:
        return JSONResponse(content={
            "success": False,
            "message": "Nama, akun, dan kata sandi wajib diisi."
        })

    result = register_student(name=name, account=account, password=password)
    return JSONResponse(content=result)

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
    duration_sec: int | None = None

class HomeworkFeedback(BaseModel):
    eid: int
    sid: str
    task_type: str
    q1_rating: int
    q1_comment: str | None = None
    q2_rating: int
    q2_comment: str | None = None
    predictions: List[dict] | None = None
    suggestion: str | None = None
    duration_sec: int | None = None

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

# Check homework 3 availability
@app.get("/check_hw3_status/{sid}")
async def api_check_hw3_status(sid: str):
    result = check_hw3_status(sid)
    return JSONResponse(content=result)

# Check homework 4 availability
@app.get("/check_hw4_status/{sid}")
async def api_check_hw4_status(sid: str):
    result = check_hw4_status(sid)
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

# Initialize homework 3 essay data
@app.post("/initialize_homework3")
async def api_initialize_homework3(setup_data: HomeworkSetup):
    essay_result = initialize_homework3_essay(setup_data.sid, setup_data.title)
    if not essay_result['success']:
        return JSONResponse(content=essay_result)

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

# Initialize homework 4 essay data
@app.post("/initialize_homework4")
async def api_initialize_homework4(setup_data: HomeworkSetup):
    essay_result = initialize_homework4_essay(setup_data.sid, setup_data.title)
    if not essay_result['success']:
        return JSONResponse(content=essay_result)

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
    duration_sec: int | None = None

@app.post("/save_hw_content/{eid}")
async def api_save_hw_content(eid: str, essay_content: EssayContent):
    result = save_hw_content(eid, essay_content.content, essay_content.duration_sec)
    return JSONResponse(content=result)

# Reset homework progress
@app.post("/reset_hw/{eid}")
async def api_reset_hw(eid: str):
    result = reset_hw(eid)
    return JSONResponse(content=result)

# Submit homework content
@app.post("/submit_hw/{eid}")
async def api_submit_hw(eid: str, essay_content: EssayContent):
    result = submit_hw(eid, essay_content.content, essay_content.duration_sec)
    return JSONResponse(content=result)

@app.post("/submit_hw_feedback")
async def api_submit_hw_feedback(payload: HomeworkFeedback):
    result = save_homework_feedback(payload.dict())
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

class FeedbackRequest(BaseModel):
    essay_id: int
    user_judgment: str
    user_original_sentence: str | None = None

class TaskSessionStart(BaseModel):
    sid: str
    eid: int | None = None
    task_type: str
    page_url: str | None = None
    user_agent: str | None = None

class TaskSessionEnd(BaseModel):
    session_id: int


# predicting sentences 
@app.post("/predict_sentence")
async def api_predict_sentence(predict_request: PredictRequest):
    try:
        # Temporarily rely on the provided sid and eid values
        sid = predict_request.sid
        eid = predict_request.eid

        result, user_prompt, self_improve_result = await get_predict_sentence(
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
            "predict_prompt": user_prompt,
            "best_score_summary": (self_improve_result or {}).get("best_score_summary"),
            "debug_log": (self_improve_result or {}).get("debug_log"),
        })
    except Exception as e:
        return JSONResponse(
            content={"success": False, "error": str(e)},
            status_code=500
        )

@app.post("/predict_feedback")
async def api_predict_feedback(feedback_request: FeedbackRequest):
    try:
        result = run_feedback_loop(
            essay_id=str(feedback_request.essay_id),
            user_judgment=feedback_request.user_judgment,
            user_original_sentence=feedback_request.user_original_sentence,
        )
        return JSONResponse(content={
            "success": True,
            **result
        })
    except Exception as e:
        return JSONResponse(
            content={"success": False, "error": str(e)},
            status_code=500
        )

@app.post("/track_task_session/start")
async def api_track_task_session_start(payload: TaskSessionStart):
    session_id = create_task_session(
        sid=payload.sid,
        eid=payload.eid,
        task_type=payload.task_type,
        page_url=payload.page_url,
        user_agent=payload.user_agent,
    )
    if session_id is None:
        return JSONResponse(
            content={"success": False, "error": "Failed to create session."},
            status_code=500
        )
    return JSONResponse(content={"success": True, "session_id": session_id})

@app.post("/track_task_session/end")
async def api_track_task_session_end(payload: TaskSessionEnd):
    success = close_task_session(payload.session_id)
    if not success:
        return JSONResponse(
            content={"success": False, "error": "Session not found or already closed."},
            status_code=404
        )
    return JSONResponse(content={"success": True})



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

# Retrieve a single essay detail (teacher dashboard)
@app.get("/api/show_essay/{eid}")
async def api_show_essay(eid: str):
    result = get_essay_detail(eid)
    if result.get("success"):
        return JSONResponse(content=result)
    return JSONResponse(content=result, status_code=404)

# Retrieve raw essay_info by eid (teacher dashboard)
@app.get("/api/essay_info/{eid}")
async def api_get_essay_info(eid: str):
    result = get_essay_info(eid)
    if result.get("success"):
        return JSONResponse(content=result)
    return JSONResponse(content=result, status_code=404)

# Update the prediction verification counter
@app.post("/update_prediction_count/{pid}")
async def api_update_prediction_count(pid: str):
    result = update_prediction_check_count(pid)
    return JSONResponse(content=result)

@app.get("/api/get_all_essay_list")
async def api_get_all_essay_list(page: int = 1, page_size: int = 20):
    result = get_all_essay_list(page=page, page_size=page_size)
    if result["success"]:
        return JSONResponse(content={
            "success": True,
            "data": result["data"],
            "total": result.get("total", 0),
            "page": page,
            "page_size": page_size
        })
    else:
        return JSONResponse(
            content={
                "success": False,
                "message": result["message"]
            },
            status_code=500
        )

# Teacher dashboard helpers
@app.get("/api/essay_images/{eid}")
async def api_get_essay_images(eid: str):
    result = get_images_by_eid(eid)
    if result.get("success"):
        return JSONResponse(content=result)
    return JSONResponse(content=result, status_code=500)

@app.get("/api/essay_predictions/{eid}")
async def api_get_essay_predictions(eid: str):
    result = get_predictions_by_eid(eid)
    if result.get("success"):
        return JSONResponse(content=result)
    return JSONResponse(content=result, status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, timeout_keep_alive=120)
