import sqlite3
import os
import bcrypt
from datetime import datetime
import pytz

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "../data/attendance.db")

def get_current_time():
    return datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Bảng người dùng
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT CHECK(role IN ('student', 'teacher')) NOT NULL DEFAULT 'student',
            embedding BLOB,
            created_at TEXT DEFAULT (DATETIME('now', 'localtime'))
        )''')

        # Bảng lớp học phần
        cursor.execute('''CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id TEXT UNIQUE NOT NULL,
            class_name TEXT NOT NULL,
            teacher_id TEXT NOT NULL,
            created_at TEXT
        )''')

        # Bảng đăng ký lớp học phần
        cursor.execute('''CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            class_id TEXT NOT NULL,
            created_at TEXT,
            UNIQUE(user_id, class_id)
        )''')

        # Bảng phiên điểm danh
        cursor.execute('''CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TEXT NOT NULL
        )''')

        # ✅ Bảng điểm danh (đã loại bỏ timestamp, chỉ dùng created_at)
        cursor.execute('''CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id INTEGER NOT NULL,
            status TEXT CHECK(status IN ('on-time', 'late')) NOT NULL,
            created_at TEXT NOT NULL
        )''')

        conn.commit()
        print("[INFO] Database initialized successfully!")
    except Exception as e:
        print(f"[ERROR] Database initialization failed: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def create_admin_account():
    conn = get_db_connection()
    cursor = conn.cursor()

    teacher_id = "admin"
    teacher_name = "Giảng viên Admin"
    password = "admin123"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (teacher_id,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO users (user_id, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
                           (teacher_id, hashed_password, teacher_name, "teacher", get_current_time()))
            conn.commit()
            print("[INFO] Admin account created: admin / admin123")
    except Exception as e:
        print(f"[ERROR] Failed to create admin account: {e}")
    finally:
        conn.close()

# Khởi tạo DB và tài khoản admin
init_db()
create_admin_account()
