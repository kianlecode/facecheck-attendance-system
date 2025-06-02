from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Query, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from models.db import get_db_connection, get_current_time
from uuid import uuid4
from datetime import datetime
import pytz
import os
import bcrypt
from api.face_processing import (
    decode_base64_to_image,
    crop_face,
    extract_embedding,
    detect_face_yolo,
    predict_pose_from_base64
)
from api.faiss_engine import add_embedding, save_index
from api.notification import notify_user
import base64
import os
import cv2

router = APIRouter()
UPLOAD_FOLDER = "face_images"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

FACE_DIR = "face_images"
FRONT_DIR = os.path.join(FACE_DIR, "front")
LEFT_DIR = os.path.join(FACE_DIR, "left")
RIGHT_DIR = os.path.join(FACE_DIR, "right")

os.makedirs(FRONT_DIR, exist_ok=True)
os.makedirs(LEFT_DIR, exist_ok=True)
os.makedirs(RIGHT_DIR, exist_ok=True)

# 📌 MODEL: Yêu cầu đăng ký lớp học
class EnrollRequest(BaseModel):
    user_id: str
    class_id: str
    enrollment_key: str

# 📌 API: Lấy thông tin người dùng
@router.get("/info")
def get_user_info(request: Request, user_id: str = None):
    # Nếu không truyền user_id thì lấy từ request (trong thực tế có thể lấy từ token)
    user_id = user_id or request.query_params.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Thiếu user_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT user_id, name, email, phone_number, role, updated_at, can_update_face
            FROM users
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

        data = {
            "user_id": row.user_id,
            "name": row.name,
            "email": row.email,
            "phone_number": row.phone_number,
            "role": row.role,
            "updated_at": row.updated_at.strftime("%Y-%m-%d %H:%M:%S") if row.updated_at else None,
            "can_update_face": bool(row.can_update_face)  # ✅ Bổ sung đúng định dạng
        }

        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi truy vấn: {e}")
    finally:
        conn.close()

@router.post("/info/update_name")
def update_name(user_id: str = Body(...), new_name: str = Body(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    updated_time = datetime.now().isoformat(" ", "seconds")
    try:
        cursor.execute(
            "UPDATE users SET name = ?, updated_at = ? WHERE user_id = ?",
            (new_name, updated_time, user_id)
        )
        conn.commit()
        return {"message": "Cập nhật tên thành công."}
    finally:
        conn.close()


class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str

@router.post("/info/change_password")
def change_password(payload: ChangePasswordRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password FROM users WHERE user_id = ?", (payload.user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

        hashed_password = row[0]
        if not bcrypt.checkpw(payload.old_password.encode(), hashed_password.encode()):
            raise HTTPException(status_code=400, detail="Mật khẩu cũ không đúng.")

        new_hashed = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
        updated_time = datetime.now().isoformat(" ", "seconds")
        cursor.execute(
            "UPDATE users SET password = ?, updated_at = ? WHERE user_id = ?",
            (new_hashed, updated_time, payload.user_id)
        )
        conn.commit()
        return {"success": True, "message": "Mật khẩu đã được thay đổi."}
    finally:
        conn.close()


@router.post("/info/update_face")
def update_face(user_id: str = Query(...), file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[-1]
    filename = f"{user_id}_{uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, "wb") as f:
        f.write(file.file.read())

    conn = get_db_connection()
    cursor = conn.cursor()
    updated_time = datetime.now().isoformat(" ", "seconds")
    try:
        cursor.execute(
            "UPDATE users SET face_image_path_front = ?, updated_at = ? WHERE user_id = ?",
            (filepath, updated_time, user_id)
        )
        conn.commit()
        return {"message": "Ảnh khuôn mặt đã được cập nhật."}
    finally:
        conn.close()

@router.get("/info/face_image")
def get_face_image(user_id: str = Query(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT face_image_path_front FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

        if not row or not row[0] or not os.path.exists(row[0]):
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh khuôn mặt.")

        return FileResponse(row[0])
    finally:
        conn.close()

@router.post("/info/update_phone")
def update_phone(user_id: str = Body(...), phone_number: str = Body(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    updated_time = datetime.now().isoformat(" ", "seconds")
    try:
        cursor.execute(
            "UPDATE users SET phone_number = ?, updated_at = ? WHERE user_id = ?",
            (phone_number, updated_time, user_id)
        )
        conn.commit()
        return {"message": "Cập nhật số điện thoại thành công."}
    finally:
        conn.close()

@router.get("/get_student_classes")
def get_student_classes(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT c.class_id, c.class_name
            FROM enrollments e
            JOIN classes c ON e.class_id = c.class_id
            WHERE e.user_id = ?
            ORDER BY c.class_id ASC
        """, (user_id,))
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description]
        return {"success": True, "data": [dict(zip(columns, row)) for row in rows]}
    finally:
        conn.close()

@router.get("/get_attendance_history")
def get_attendance_history(user_id: str, class_id: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        print("user_id:", user_id, "class_id:", class_id)
        query = """
            SELECT s.class_id, c.class_name, s.start_time, s.end_time, a.status
            FROM attendance a
            JOIN sessions s ON a.session_id = s.id
            JOIN classes c ON s.class_id = c.class_id
            WHERE a.user_id = ?
        """
        params = [user_id]

        if class_id:
            query += " AND s.class_id = ?"
            params.append(class_id)

        query += " ORDER BY s.start_time DESC"

        print("Running query:", query)
        print("With params:", params)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        history = []
        for row in rows:
            start_time = row[2]
            end_time = row[3]
            
            date_only = start_time.strftime("%d/%m/%Y")
            time_range = f"{start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}"

            history.append({
                "class_id": row[0],
                "class_name": row[1],
                "date": date_only,
                "time_range": time_range,
                "status": row[4]
            })

        return {"success": True, "data": history}
    except Exception as e:
        print("❌ ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/enroll_class")
def enroll_class(req: EnrollRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM classes WHERE class_id = ? AND enrollment_key = ?", (req.class_id, req.enrollment_key))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="❌ Mã lớp hoặc key không chính xác.")

        cursor.execute("SELECT * FROM enrollments WHERE user_id = ? AND class_id = ?",
                       (req.user_id, req.class_id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="⚠️ Bạn đã đăng ký lớp này rồi!")

        vn_time = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("INSERT INTO enrollments (user_id, class_id, created_at) VALUES (?, ?, ?)",
                       (req.user_id, req.class_id, vn_time))
        conn.commit()
        notify_user(req.user_id, f"📚 Bạn đã tham gia lớp {req.class_id} thành công.")

        return {"success": True, "message": "✅ Đăng ký lớp học phần thành công!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"success": False, "message": f"Lỗi hệ thống: {str(e)}"}
    finally:
        conn.close()

@router.delete("/unenroll_class")
def unenroll_class(user_id: str, class_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM enrollments WHERE user_id = ? AND class_id = ?",
                       (user_id, class_id))
        conn.commit()
        if cursor.rowcount == 0:
            return {"success": False, "message": "⚠ Bạn chưa đăng ký lớp này hoặc đã huỷ trước đó."}
        notify_user(user_id, f"⚠️ Bạn đã huỷ lớp {class_id}.")
        return {"success": True, "message": "✅ Đã huỷ đăng ký lớp học phần."}
    finally:
        conn.close()

@router.post("/update_face")
def update_face(
    user_id: str = Form(...),
    image_front: str = Form(...),
    image_left: str = Form(...),
    image_right: str = Form(...)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Kiểm tra quyền cập nhật
        cursor.execute("SELECT can_update_face FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
        if not row.can_update_face:
            raise HTTPException(status_code=403, detail="Bạn không có quyền cập nhật ảnh khuôn mặt.")

        def check_pose(image_data: str, expected_pose: str):
            result = predict_pose_from_base64(image_data)
            if not result["success"]:
                raise HTTPException(status_code=400, detail=result["message"])
            if result["pose"] != expected_pose:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ảnh {expected_pose} sai góc mặt (phát hiện: {result['pose']})"
                )

        def save_and_embed(image_data: str, folder: str, suffix: str):
            img = decode_base64_to_image(image_data)
            boxes = detect_face_yolo(img)
            if len(boxes) == 0:
                raise HTTPException(status_code=400, detail=f"Không phát hiện khuôn mặt trong ảnh {suffix}.")
            face = crop_face(img, boxes[0])
            face = cv2.resize(face, (112, 112))
            filename = f"{user_id}_{suffix}.jpg"
            filepath = os.path.join(folder, filename)
            cv2.imwrite(filepath, face)

            vec = extract_embedding(face)
            if vec is None:
                raise HTTPException(status_code=400, detail=f"Lỗi trích xuất vector từ ảnh {suffix}.")
            vec_str = base64.b64encode(vec.tobytes()).decode("utf-8")
            return vec_str, vec, filepath

        # Kiểm tra góc mặt đúng
        check_pose(image_front, "front")
        check_pose(image_left, "left")
        check_pose(image_right, "right")

        # Xử lý và lưu ảnh
        embed_front, vec_front, path_front = save_and_embed(image_front, FRONT_DIR, "front")
        embed_left, vec_left, path_left = save_and_embed(image_left, LEFT_DIR, "left")
        embed_right, vec_right, path_right = save_and_embed(image_right, RIGHT_DIR, "right")

        # Cập nhật FAISS index
        add_embedding(user_id, vec_front, "front")
        add_embedding(user_id, vec_left, "left")
        add_embedding(user_id, vec_right, "right")
        save_index()

        # Cập nhật database
        cursor.execute("""
            UPDATE users
            SET
                embedding_front = ?, embedding_left = ?, embedding_right = ?,
                face_image_path_front = ?, face_image_path_left = ?, face_image_path_right = ?,
                updated_at = ?, can_update_face = 0
            WHERE user_id = ?
        """, (
            embed_front, embed_left, embed_right,
            path_front, path_left, path_right,
            get_current_time(),
            user_id
        ))

        conn.commit()
        notify_user(user_id, "✅📸 Bạn đã cập nhật ảnh khuôn mặt thành công.")
        return {"success": True, "message": "✅ Cập nhật ảnh khuôn mặt thành công."}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {e}")
    finally:
        conn.close()