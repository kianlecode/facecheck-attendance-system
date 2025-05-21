from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from models.db import get_db_connection
from api.faiss_engine import init_index, search_by_user_all_angles
from api.face_processing import process_face_from_base64, predict_pose_from_base64
from api.notification import notify_user
import base64
import datetime
import pytz
import numpy as np

router = APIRouter()

COSINE_THRESHOLD = 0.6

init_index()

@router.post("/attendance")
def mark_attendance(
    user_id: str = Form(...),
    session_id: int = Form(...),
    image_front: str = Form(...),
    image_left: str = Form(...),
    image_right: str = Form(...)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        print("=== BẮT ĐẦU /attendance ===")
        print("📥 Nhận user_id:", user_id)
        print("📥 Nhận session_id:", session_id)

        # Trích xuất vector
        front_vec = process_face_from_base64(image_front)
        left_vec = process_face_from_base64(image_left)
        right_vec = process_face_from_base64(image_right)

        embeddings = {
            "front": front_vec,
            "left": left_vec,
            "right": right_vec
        }

        if any(v is None for v in embeddings.values()):
            return {"success": False, "message": "❌ Không phát hiện khuôn mặt trong 1 hoặc nhiều ảnh."}

        matched_count = search_by_user_all_angles(user_id, embeddings, threshold=COSINE_THRESHOLD)
        if matched_count < 2:
            return {"success": False, "message": "❌ Khuôn mặt không khớp đủ 2 góc với tài khoản!"}

        # Kiểm tra phiên hợp lệ
        cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="❌ Phiên điểm danh không tồn tại!")

        columns = [col[0] for col in cursor.description]
        session = dict(zip(columns, row))

        vn_tz = pytz.timezone("Asia/Ho_Chi_Minh")
        now = datetime.datetime.now(vn_tz)

        start_time = session["start_time"]
        end_time = session["end_time"]

        # Chuyển từ string nếu cần
        if isinstance(start_time, str):
            start_time = datetime.datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
        if isinstance(end_time, str):
            end_time = datetime.datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")

        # Localize nếu chưa có timezone
        if start_time.tzinfo is None:
            start_time = vn_tz.localize(start_time)
        if end_time.tzinfo is None:
            end_time = vn_tz.localize(end_time)
            
        ontime_limit = session.get("ontime_limit", 10)

        if not (start_time <= now <= end_time):
            return {"success": False, "message": "⚠ Ngoài thời gian điểm danh!"}

        cursor.execute("SELECT * FROM attendance WHERE user_id = ? AND session_id = ?", (user_id, session_id))
        if cursor.fetchone():
            return {"success": False, "message": "⚠ Bạn đã điểm danh rồi!"}

        status = "on-time" if now <= start_time + datetime.timedelta(minutes=ontime_limit) else "late"

        cursor.execute("""
            INSERT INTO attendance (user_id, session_id, status, created_at)
            VALUES (?, ?, ?, ?)
        """, (user_id, session_id, status, now.strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()

        # 🔔 Gửi thông báo điểm danh thành công
        cursor.execute("""
            SELECT s.start_time, c.class_id
            FROM sessions s
            JOIN classes c ON s.class_id = c.class_id
            WHERE s.id = ?
        """, (session_id,))
        session_info = cursor.fetchone()

        if session_info:
            session_time = session_info[0]
            class_id = session_info[1]
            if isinstance(session_time, str):
                session_time = datetime.datetime.strptime(session_time, "%Y-%m-%d %H:%M:%S")
            formatted_time = session_time.strftime("%H:%M %d/%m/%Y")
            notify_user(user_id, f"✅ Bạn đã điểm danh thành công lớp {class_id} lúc {formatted_time}. Trạng thái: {status.upper()}.")

        return {"success": True, "message": f"✅ Điểm danh thành công! Trạng thái: {status}"}

    except HTTPException as he:
        raise he
    except Exception as e:
        print("🛑 Lỗi hệ thống:", e)
        return {"success": False, "message": f"Lỗi hệ thống: {e}"}
    finally:
        conn.close()

@router.get("/get_available_sessions")
def get_available_sessions(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        now = datetime.datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            SELECT s.id AS session_id, s.class_id, c.class_name, s.start_time, s.end_time
            FROM sessions s
            JOIN classes c ON s.class_id = c.class_id
            JOIN enrollments e ON e.class_id = s.class_id
            WHERE e.user_id = ? AND s.start_time <= ? AND s.end_time >= ?
            ORDER BY s.start_time ASC
        """, (user_id, now, now))

        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        data = [dict(zip(columns, row)) for row in rows]

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "message": f"Lỗi hệ thống: {str(e)}"}
    finally:
        conn.close()

@router.post("/predict_pose")
def predict_pose_api(image_base64: str = Form(...)):
    result = predict_pose_from_base64(image_base64)
    return JSONResponse(content=result)