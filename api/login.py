from fastapi import APIRouter, HTTPException, Request
from fastapi.exceptions import HTTPException as FastAPIHTTPException  # để không nuốt lỗi
from pydantic import BaseModel
from models.db import get_db_connection
import bcrypt

router = APIRouter()

class LoginRequest(BaseModel):
    user_id: str
    password: str

@router.post("/login")
def login(request_data: LoginRequest, request: Request):
    user_id = request_data.user_id.strip()
    password = request_data.password.strip()

    if not user_id or not password:
        raise HTTPException(status_code=400, detail="⚠ Mã người dùng và mật khẩu không được để trống!")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT name, password, role, is_active
            FROM users
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="⚠ Tài khoản hoặc mật khẩu không đúng.")

        name = row[0]
        hashed_password = row[1]
        role = row[2]
        is_active = row[3]

        if not bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8')):
            raise HTTPException(status_code=401, detail="⚠ Tài khoản hoặc mật khẩu không đúng.")

        if is_active == 0:
            raise HTTPException(status_code=403, detail="⚠ Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.")

        return {
            "success": True,
            "message": "✅ Đăng nhập thành công!",
            "user_id": user_id,
            "user_name": name,
            "role": role
        }

    except FastAPIHTTPException as he:
        raise he  # ❗ Cho phép HTTPException được trả ra đúng status
    except Exception as e:
        print("🛑 LỖI LOGIN:", e)
        raise HTTPException(status_code=500, detail="Lỗi hệ thống đăng nhập.")
    finally:
        conn.close()