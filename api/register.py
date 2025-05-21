# (giữ nguyên phần import và cấu hình ban đầu)
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from models.db import get_db_connection
import numpy as np
import base64
import bcrypt
import os
import cv2
from datetime import datetime
import pytz
from api.faiss_engine import init_index, add_embedding, save_index
from api.face_processing import detect_face_box_from_base64, predict_pose_from_base64, decode_base64_to_image, detect_face_yolo, crop_face, extract_embedding

router = APIRouter()

FACE_DIR = "face_images"
FRONT_DIR = os.path.join(FACE_DIR, "front")
LEFT_DIR = os.path.join(FACE_DIR, "left")
RIGHT_DIR = os.path.join(FACE_DIR, "right")

os.makedirs(FRONT_DIR, exist_ok=True)
os.makedirs(LEFT_DIR, exist_ok=True)
os.makedirs(RIGHT_DIR, exist_ok=True)

def get_current_vietnam_time():
    tz = pytz.timezone("Asia/Ho_Chi_Minh")
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")

class MotionRegisterRequest(BaseModel):
    user_id: str
    name: str
    password: str
    phone_number: str
    email: str
    role: str = "student"
    image_front: str
    image_left: str
    image_right: str

@router.get("/check-user-id")
def check_user_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,))
        return {"exists": cursor.fetchone() is not None}
    finally:
        conn.close()

@router.post("/detect_face_box")
def detect_face_box(image_base64: str = Form(...)):
    box = detect_face_box_from_base64(image_base64)
    if box:
        return {"success": True, "box": box}
    else:
        return {"success": False, "message": "Không phát hiện khuôn mặt"}

@router.post("/register")
def register_motion(request: MotionRegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    print("🧩 Đã vào register_motion")
    print("➡ user_id:", request.user_id)
    print("➡ name:", request.name)
    print("➡ email:", request.email)
    print("➡ image_front[:30]:", request.image_front[:30])
    print("➡ image_left [:30]:", request.image_left[:30])
    print("➡ image_right[:30]:", request.image_right[:30])

    try:
        cursor.execute("SELECT 1 FROM users WHERE user_id = ?", (request.user_id,))
        if cursor.fetchone():
            print("❌ Mã sinh viên đã tồn tại.")
            raise HTTPException(status_code=400, detail="Mã sinh viên đã tồn tại.")

        hashed_password = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        now = get_current_vietnam_time()

        init_index()

        def save_and_embed(image_data: str, folder: str, suffix: str):
            print(f"🔍 Xử lý ảnh {suffix}")
            now = get_current_vietnam_time()
            filename = f"{request.user_id}_{suffix}_{now.replace(':', '').replace(' ', '_')}.jpg"
            filepath = os.path.join(folder, filename)

            try:
                if not image_data.startswith("data:image"):
                    print(f"⚠️ Ảnh {suffix} không có prefix base64 hợp lệ")
                img = decode_base64_to_image(image_data)
                print(f"✅ Đã decode ảnh {suffix}, shape: {img.shape}")

                boxes = detect_face_yolo(img)
                print(f"✅ YOLO phát hiện {len(boxes)} khuôn mặt")

                if len(boxes) == 0:
                    raise HTTPException(status_code=400, detail=f"Không phát hiện khuôn mặt trong ảnh {suffix}.")

                face = crop_face(img, boxes[0])
                print(f"✅ Crop thành công, shape: {face.shape}")

                face = cv2.resize(face, (112, 112))
                print("✅ Resize thành công")

                cv2.imwrite(filepath, face)
                print(f"✅ Ảnh đã lưu vào {filepath}")

                vec = extract_embedding(face)
                if vec is None:
                    print(f"❌ Không trích xuất được vector từ ảnh {suffix}")
                    raise HTTPException(status_code=400, detail=f"Lỗi trích xuất vector từ ảnh {suffix}.")
                else:
                    print("✅ Trích xuất vector thành công")

                vec_str = base64.b64encode(vec.tobytes()).decode("utf-8")
                return vec_str, vec, filepath
            except Exception as e:
                print(f"🛑 Lỗi trong save_and_embed ({suffix}):", e)
                raise

        def check_pose(image_data: str, expected_pose: str):
            print(f"🔍 Đang kiểm tra pose của ảnh {expected_pose}")
            result = predict_pose_from_base64(image_data)
            print(f"➡ Kết quả pose trả về: {result}")
            if not result["success"]:
                raise HTTPException(status_code=400, detail=result["message"])
            if result["pose"] != expected_pose:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ảnh gửi không đúng góc mặt. Mong đợi: {expected_pose}, phát hiện: {result['pose']}"
                )

        check_pose(request.image_front, "front")
        check_pose(request.image_left, "left")
        check_pose(request.image_right, "right")

        embed_front, vec_front, path_front = save_and_embed(request.image_front, FRONT_DIR, "front")
        embed_left, vec_left, path_left = save_and_embed(request.image_left, LEFT_DIR, "left")
        embed_right, vec_right, path_right = save_and_embed(request.image_right, RIGHT_DIR, "right")

        add_embedding(request.user_id, vec_front, "front")
        add_embedding(request.user_id, vec_left, "left")
        add_embedding(request.user_id, vec_right, "right")
        save_index()

        cursor.execute("""
            INSERT INTO users (
                user_id, name, password, role, phone_number, email,
                embedding_front, embedding_left, embedding_right,
                face_image_path_front, face_image_path_left, face_image_path_right,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            request.user_id,
            request.name,
            hashed_password,
            request.role,
            request.phone_number,
            request.email,
            embed_front,
            embed_left,
            embed_right,
            path_front,
            path_left,
            path_right,
            1,
            now,
            now
        ))
        conn.commit()
        print("✅ Đăng ký thành công!")
        return {"success": True, "message": "✅ Đăng ký thành công"}

    except HTTPException as http_exc:
        print("🛑 HTTPException:", http_exc.detail)
        raise http_exc
    except Exception as e:
        print("🛑 Lỗi hệ thống:", e)
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {e}")
    finally:
        conn.close()