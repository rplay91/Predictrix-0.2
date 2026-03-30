import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

API_BASE_URL = os.environ.get("API_BASE_URL", "")


def render_template(request: Request, name: str):
    return templates.TemplateResponse(
        name,
        {"request": request, "api_base_url": API_BASE_URL},
    )


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return render_template(request, "index.html")


@app.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return render_template(request, "login.html")


@app.get("/register", response_class=HTMLResponse)
async def register(request: Request):
    return render_template(request, "register.html")


@app.get("/404", response_class=HTMLResponse)
async def error(request: Request):
    return render_template(request, "404.html")


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
