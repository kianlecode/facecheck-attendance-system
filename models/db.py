import pyodbc
import bcrypt
from datetime import datetime
import pytz

# Thiết lập kết nối đến SQL Server bằng Windows Authentication
def get_db_connection():
    conn = pyodbc.connect(
        'DRIVER={ODBC Driver 18 for SQL Server};'
        'SERVER=Kianlee\\SQLEXPRESS;'
        'DATABASE=AttendanceDB;'
        'Trusted_Connection=yes;'
        'TrustServerCertificate=yes;'
    )
    return conn

def get_current_time():
    return datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # USERS
        cursor.execute("""
        IF OBJECT_ID('users', 'U') IS NULL
        CREATE TABLE users (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) UNIQUE NOT NULL,
            password NVARCHAR(255) NOT NULL,
            name NVARCHAR(100) NOT NULL,
            role NVARCHAR(20) CHECK (role IN ('student', 'teacher', 'admin')) NOT NULL DEFAULT 'student',
            email NVARCHAR(255),
            phone_number NVARCHAR(20),
            embedding_front NVARCHAR(MAX),
            embedding_left NVARCHAR(MAX),
            embedding_right NVARCHAR(MAX),
            face_image_path_front NVARCHAR(255),
            face_image_path_left NVARCHAR(255),
            face_image_path_right NVARCHAR(255),
            is_active BIT DEFAULT 1,
            can_update_face BIT DEFAULT 0,
            created_at DATETIME DEFAULT GETDATE(),
            updated_at DATETIME
        )
        """)

        # CLASSES
        cursor.execute("""
        IF OBJECT_ID('classes', 'U') IS NULL
        CREATE TABLE classes (
            id INT IDENTITY(1,1) PRIMARY KEY,
            class_id NVARCHAR(50) UNIQUE NOT NULL,
            class_name NVARCHAR(100) NOT NULL,
            teacher_id NVARCHAR(50) NOT NULL,
            enrollment_key NVARCHAR(50),
            created_at DATETIME
        )
        """)

        # ENROLLMENTS
        cursor.execute("""
        IF OBJECT_ID('enrollments', 'U') IS NULL
        CREATE TABLE enrollments (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) NOT NULL,
            class_id NVARCHAR(50) NOT NULL,
            created_at DATETIME,
            CONSTRAINT uq_enrollment UNIQUE (user_id, class_id)
        )
        """)

        # SESSIONS
        cursor.execute("""
        IF OBJECT_ID('sessions', 'U') IS NULL
        CREATE TABLE sessions (
            id INT IDENTITY(1,1) PRIMARY KEY,
            class_id NVARCHAR(50) NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            ontime_limit INT NOT NULL DEFAULT 10,
            created_at DATETIME NOT NULL
        )
        """)

        # ATTENDANCE
        cursor.execute("""
        IF OBJECT_ID('attendance', 'U') IS NULL
        CREATE TABLE attendance (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) NOT NULL,
            session_id INT NOT NULL,
            status NVARCHAR(20) CHECK (status IN ('on-time', 'late')) NOT NULL,
            created_at DATETIME NOT NULL
        )
        """)

        # NOFICATIONS
        cursor.execute("""
        IF OBJECT_ID('notifications', 'U') IS NULL
        CREATE TABLE notifications (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) NOT NULL,
            message NVARCHAR(255) NOT NULL,
            is_read BIT DEFAULT 0,
            created_at DATETIME DEFAULT GETDATE()
        )
        """)

        conn.commit()
        print("[INFO] Database initialized successfully!")
    except Exception as e:
        print(f"[ERROR] Database initialization failed: {e}")
    finally:
        conn.close()

def create_admin_account():
    conn = get_db_connection()
    cursor = conn.cursor()

    admin_id = "admin1"
    admin_name = "Admin 1"
    password = "codeadmin1"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    try:
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (admin_id,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO users (user_id, password, name, role, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (admin_id, hashed_password, admin_name, "admin", get_current_time()))
            conn.commit()
            print("[INFO] Admin account created: admin1 / codeadmin1")
    except Exception as e:
        print(f"[ERROR] Failed to create admin account: {e}")
    finally:
        conn.close()

# Khởi tạo DB và admin
init_db()
create_admin_account()