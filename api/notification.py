from fastapi import APIRouter
from pydantic import BaseModel
from models.db import get_db_connection
from datetime import datetime
import pytz

router = APIRouter()

# ======= Model input ========
class NotificationIn(BaseModel):
    user_id: str
    message: str

# ======= Hàm dùng chung để gửi thông báo ========
def notify_user(user_id: str, message: str):
    try:
        created_at = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d %H:%M:%S")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (user_id, message, created_at)
            VALUES (?, ?, ?)
        """, (user_id, message, created_at))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ notify_user error: {e}")
        return False

# ======= API: Lấy danh sách thông báo ========
@router.get("/notifications")
def get_notifications(user_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, message, created_at, is_read
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()

        result = [
            {
                "id": r[0],
                "message": r[1],
                "created_at": r[2],
                "is_read": r[3]
            } for r in rows
        ]

        return {"success": True, "data": result}

    except Exception as e:
        return {"success": False, "message": str(e)}

# ======= API: Tạo thông báo mới ========
@router.post("/notifications")
def create_notification(payload: NotificationIn):
    success = notify_user(payload.user_id, payload.message)
    return {
        "success": success,
        "message": "Đã tạo thông báo" if success else "Lỗi khi tạo thông báo"
    }

# ======= API: Đánh dấu đã đọc ========
@router.put("/notifications/{notif_id}/read")
def mark_as_read(notif_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications
            SET is_read = 1
            WHERE id = ?
        """, (notif_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Đã cập nhật"}
    except Exception as e:
        return {"success": False, "message": str(e)}