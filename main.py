from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from api.faiss_engine import init_index
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Import các router
from api import register, login, attendance, teacher, student, admin, notification

# Tạo FastAPI app
app = FastAPI(title="Hệ thống điểm danh bằng khuôn mặt")

# ✅ Khởi tạo FAISS index khi hệ thống chạy
init_index()

# Mount static và templates
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/models", StaticFiles(directory="models"), name="models")
app.mount("/face_images", StaticFiles(directory="face_images"), name="face_images")
templates = Jinja2Templates(directory="templates")

# Đăng ký các router API
app.include_router(register.router)
app.include_router(login.router)
app.include_router(attendance.router)
app.include_router(teacher.router)
app.include_router(student.router)
app.include_router(admin.router)
app.include_router(notification.router)

# Route HTML trang chính
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Các route hiển thị HTML từ thư mục templates/
@app.get("/register.html", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/login.html", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/student.html", response_class=HTMLResponse)
async def student_dashboard(request: Request):
    return templates.TemplateResponse("student.html", {"request": request})

@app.get("/teacher.html", response_class=HTMLResponse)
async def teacher_dashboard(request: Request):
    return templates.TemplateResponse("teacher.html", {"request": request})

@app.get("/attendance.html", response_class=HTMLResponse)
async def attendance_page(request: Request):
    return templates.TemplateResponse("attendance.html", {"request": request})

@app.get("/admin.html", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/biometric.html", response_class=HTMLResponse)
def biometric_page(request: Request):
    return templates.TemplateResponse("biometric.html", {"request": request})