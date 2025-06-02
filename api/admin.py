from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from models.db import get_db_connection
import bcrypt
from datetime import datetime
from api.notification import notify_user
import pytz

router = APIRouter(prefix="/admin", tags=["admin"])

def get_current_vietnam_time():
    tz = pytz.timezone("Asia/Ho_Chi_Minh")
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")

# --------- Schema để tạo giảng viên / admin ---------
class CreateUserRequest(BaseModel):
    user_id: str
    name: str
    phone_number: str
    email: str
    password: str
    role: str  # 'admin' hoặc 'teacher'

# --------- API tạo tài khoản ---------
@router.post("/create_user")
def create_user(user_data: CreateUserRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_data.user_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="❌ Mã người dùng đã tồn tại.")

        if user_data.role not in ["teacher", "admin", "student"]:
            raise HTTPException(status_code=400, detail="❌ Role không hợp lệ. Chỉ cho phép 'teacher', 'admin' hoặc 'student'.")

        hashed_pw = bcrypt.hashpw(user_data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        now = get_current_vietnam_time()

        cursor.execute("""
            INSERT INTO users (user_id, name, phone_number, email, password, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_data.user_id, user_data.name, user_data.phone_number, user_data.email, hashed_pw, user_data.role, 1, now))
        conn.commit()

        return {"success": True, "message": f"✅ Đã tạo tài khoản {user_data.role} thành công!"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo tài khoản: {e}")
    finally:
        conn.close()

# --------- API lấy danh sách tất cả người dùng---------
@router.get("/get_all_users")
def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT user_id, name, phone_number, email, role, is_active, created_at
            FROM users
        """)
        users = cursor.fetchall()
        return {
            "success": True,
            "data": [
                {
                    "user_id": row[0],
                    "name": row[1],
                    "phone_number": row[2],
                    "email": row[3],
                    "role": row[4],
                    "is_active": row[5],
                    "created_at": row[6]
                }
                for row in users
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách tài khoản: {e}")
    finally:
        conn.close()

# --------- API lấy danh sách lớp của giảng viên ---------
@router.get("/classes_of_teacher")
def get_classes_of_teacher(teacher_id: str = Query(..., alias="teacher_id")):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT class_id, class_name, created_at
            FROM classes
            WHERE teacher_id = ?
        """, (teacher_id,))
        classes = cursor.fetchall()
        return {
            "success": True,
            "data": [
                {
                    "class_id": row[0],
                    "class_name": row[1],
                    "created_at": row[2]
                }
                for row in classes
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy lớp của giảng viên: {e}")
    finally:
        conn.close()

# --------- API xoá tài khoản bất kỳ ---------
@router.delete("/delete_user/{user_id}")
def delete_user(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
        conn.commit()
        return {"success": True, "message": f"✅ Đã xoá tài khoản {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xoá tài khoản: {e}")
    finally:
        conn.close()


# --------- API khoá / mở khoá tài khoản ---------
@router.put("/toggle_user_status/{user_id}")
def toggle_user_status(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT is_active FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

        current_status = row[0]
        new_status = 0 if current_status == 1 else 1

        cursor.execute("UPDATE users SET is_active = ? WHERE user_id = ?", (new_status, user_id))
        conn.commit()
        action = "khoá" if new_status == 0 else "mở khoá"
        return {"success": True, "message": f"✅ Đã {action} tài khoản {user_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật trạng thái tài khoản: {e}")
    finally:
        conn.close()


# --------- API kiểm tra quyền cập nhật khuôn mặt ---------
@router.post("/grant_update_face")
def grant_update_face(user_id: str = Body(...), allow: bool = Body(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET can_update_face = ? WHERE user_id = ?",
            (1 if allow else 0, user_id)
        )
        conn.commit()
        if allow:
            notify_user(
                user_id,
                "⚠️📸 Bạn đã được cấp quyền cập nhật ảnh khuôn mặt. Vui lòng thực hiện trong thời gian sớm nhất."
            )
        return {
            "success": True,
            "message": f"{'✅ Đã cấp' if allow else '🚫 Đã thu'} quyền cập nhật ảnh khuôn mặt cho {user_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {e}")
    finally:
        conn.close()