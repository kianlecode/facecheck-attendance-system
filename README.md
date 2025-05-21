# Hệ thống điểm danh sinh viên bằng nhận diện khuôn mặt

## Giới thiệu

Hệ thống hỗ trợ việc điểm danh trong lớp học và quản lý điểm danh lớp học một cách **tự động**, **chính xác**, và **tiết kiệm thời gian** dựa trên công nghệ **nhận diện khuôn mặt với nhiều góc nhìn (trái – phải – chính diện)**. Giao diện được phân quyền giữa **Admin**, **Giảng viên**, và **Sinh viên**.

---

## Công nghệ sử dụng

- **Backend**: FastAPI
- **Frontend**: HTML, CSS, JavaScript
- **Cơ sở dữ liệu**: SQL Server (kết nối qua `pyodbc`)
- **Nhận diện khuôn mặt**:
  - DeepFace (ArcFace) + FAISS
  - YOLOv8 + MediaPipe Face Landmarker
- **Các thư viện khác**: OpenCV, bcrypt, numpy, pyodbc, pydantic, pytz...

---

## Các chức năng chính

### Sinh viên
- Đăng ký tài khoản và khuôn mặt (3 góc: trái – phải – chính diện)
- Tham gia lớp học bằng mã lớp hoặc được giảng viên thêm
- Thực hiện điểm danh tại lớp thông qua camera
- Xem lịch sử điểm danh cá nhân
- Nhận thông báo từ hệ thống hoặc từ giảng viên

### Giảng viên
- Tạo lớp học phần (có key bảo mật)
- Tạo phiên điểm danh theo ngày/giờ
- Thêm/xoá sinh viên vào lớp
- Theo dõi danh sách điểm danh từng phiên
- Xuất danh sách điểm danh thành Excel
- Gửi thông báo đến sinh viên
- Cấp quyền cập nhật khuôn mặt cho sinh viên

### Admin
- Quản lý toàn bộ tài khoản (sinh viên, giảng viên, admin)
- Tìm kiếm, phân trang, lọc theo vai trò
- Khoá / mở / xoá tài khoản
- Xem thông tin chi tiết người dùng
- Quản lý phân quyền và bảo mật hệ thống

---

## Cấu trúc thư mục
facecheck-attendance-system-main/
├── api/ # Các API xử lý backend
├── data/
│ └─── face_data/ # Chứa FAISS index và id_map
├── face_images/ # Ảnh khuôn mặt theo góc: front, left, right
├── models/ # Kết nối SQL Server, tạo bảng, YOLOv8 model
├── static/
│ ├── img/ # Logo NEU
│ ├── js/ # Các file JavaScript chia theo từng trang
│ └── style.css # Giao diện chung
├── templates/ # Giao diện HTML cho các trang
├── main.py # Điểm khởi chạy FastAPI
├── requirements.txt # Danh sách thư viện
└── README.md # Mô tả dự án


## Hướng dẫn cài đặt & triển khai

### 1. Cài đặt môi trường

!!! Yêu cầu Python version: 3.11.9

```bash
pip install -r requirements.txt

### 2. Kết nối SQL Server
conn = pyodbc.connect(
    'DRIVER={ODBC Driver 18 for SQL Server};'
    'SERVER=KIANLE-PC\\SQLEXPRESS;'
    'DATABASE=AttendanceDB;'
    'Trusted_Connection=yes;'
    'TrustServerCertificate=yes;'
)

### 3. Khởi chạy Backend
uvicorn backend.main:app --reload

### Sau đó truy cập: http://localhost:8000

### Lưu ý triển khai
# Phải đảm bảo camera máy tính hoạt động ổn định, chỉ có 1 khuôn mặt trong khung hình.
# Hệ thống yêu cầu ảnh khuôn mặt ở 3 góc để tăng độ chính xác nhận diện.
# File ảnh và vector được lưu trong thư mục data/face_data.

### Liên hệ & hỗ trợ
# Email: kienle091003@gmail.com
# GitHub: https://github.com/kianlecode/facecheck-attendance-system
