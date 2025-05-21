from ultralytics import YOLO
import numpy as np
import cv2
from deepface import DeepFace
import base64
import mediapipe as mp

# === Load YOLOv8 model ===
yolo_model = YOLO("models/yolov8n-face.pt")  # hoặc model khác nếu bạn có
MODEL_NAME = "ArcFace"

# === Load MediaPipe FaceMesh model ===
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True)

def decode_base64_to_image(base64_str):
    img_data = base64.b64decode(base64_str.split(",")[1])
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img

def detect_face_yolo(image):
    results = yolo_model.predict(image, imgsz=640, conf=0.4)
    boxes = results[0].boxes.xyxy.cpu().numpy() if results and results[0].boxes else []
    return boxes

def crop_face(image, box):
    x1, y1, x2, y2 = map(int, box)
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(image.shape[1], x2)
    y2 = min(image.shape[0], y2)
    return image[y1:y2, x1:x2]

def extract_embedding(face_image):
    try:
        print("📦 Bắt đầu trích xuất vector từ ảnh mặt...")
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        temp_path = "temp_face.jpg"
        cv2.imwrite(temp_path, rgb)
        print(f"✅ Ảnh tạm đã lưu tại: {temp_path}")

        from deepface import DeepFace
        embedding = DeepFace.represent(
            img_path=temp_path,
            model_name="ArcFace",
            enforce_detection=False
        )
        print("🧠 Bắt đầu DeepFace.represent...")
        print("🎯 Kết quả embedding:", embedding)

        if not embedding or 'embedding' not in embedding[0]:
            print("❌ Không tìm thấy trường 'embedding'")
            return None

        return np.array(embedding[0]['embedding'], dtype=np.float32)

    except Exception as e:
        print("🛑 Lỗi khi trích xuất embedding:", e)
        return None

def process_face_from_base64(base64_str):
    img = decode_base64_to_image(base64_str)
    boxes = detect_face_yolo(img)

    if len(boxes) == 0:
        print("❌ Không phát hiện khuôn mặt.")
        return None

    if len(boxes) > 1:
        print("🚨 Phát hiện nhiều hơn 1 khuôn mặt! Hệ thống từ chối xử lý.")
        return None

    face_img = crop_face(img, boxes[0])

    # ✅ Resize khuôn mặt về 112x112 để đồng bộ với ArcFace
    face_resized = cv2.resize(face_img, (112, 112))

    return extract_embedding(face_resized)


def detect_face_box_from_base64(base64_str):
    img = decode_base64_to_image(base64_str)
    boxes = detect_face_yolo(img)
    if len(boxes) == 0:
        return None
    box = boxes[0]
    return {
        "x1": int(box[0]),
        "y1": int(box[1]),
        "x2": int(box[2]),
        "y2": int(box[3])
    }

def predict_pose(face_img):
    rgb_image = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)

    if not results.multi_face_landmarks:
        print("[DEBUG] Không tìm thấy landmarks")
        return "unknown"

    landmarks = results.multi_face_landmarks[0].landmark

    nose = landmarks[1]
    left_cheek = landmarks[234]
    right_cheek = landmarks[454]

    offset = nose.x - ((left_cheek.x + right_cheek.x) / 2)
    print("[DEBUG] Offset X:", offset)

    if abs(offset) < 0.02:
        return "front"
    elif offset < -0.04:
        return "left"
    elif offset > 0.04:
        return "right"
    else:
        return "unknown"

def predict_pose_from_base64(base64_str):
    try:
        img = decode_base64_to_image(base64_str)
        boxes = detect_face_yolo(img)
        # print("[DEBUG] YOLO boxes:", boxes)

        if boxes is None or len(boxes) == 0:
            # print("[DEBUG] Không tìm thấy box YOLO")
            return {
                "success": False,
                "message": "Không phát hiện khuôn mặt"
            }

        if len(boxes) > 1:
            # print("🚨 Phát hiện nhiều hơn 1 khuôn mặt!")
            return {
                "success": False,
                "message": "Phát hiện nhiều khuôn mặt. Vui lòng chỉ để 1 người trong camera."
            }

        box = boxes[0]
        face_img = crop_face(img, box)
        # print("[DEBUG] Box toạ độ:", box)
        # print("[DEBUG] Face shape:", face_img.shape)

        face_resized = cv2.resize(face_img, (320, 320))  # MediaPipe hoạt động tốt ở kích thước này
        pose = predict_pose(face_resized)

        return {
            "success": True,
            "pose": pose  # ✅ Trả chuỗi trực tiếp thay vì object lồng
        }

    except Exception as e:
        # print("[ERR] predict_pose_from_base64 lỗi:", e)
        return {
            "success": False,
            "message": "Lỗi xử lý pose: " + str(e)
        }