import os
import json
import numpy as np
import faiss

# ===== CẤU HÌNH ĐƯỜNG DẪN =====
FACE_DATA_DIR = "data/face_data"
INDEX_PATH = os.path.join(FACE_DATA_DIR, "face_index.faiss")
ID_MAP_PATH = os.path.join(FACE_DATA_DIR, "id_map.json")

# ===== BIẾN TOÀN CỤC =====
index = None           # FAISS index
id_map = {}            # Map: FAISS internal ID -> user_id__angle
next_index_id = 0      # Tăng dần theo số vector

# ===== KHỞI TẠO INDEX =====
def init_index(d=512):
    global index, id_map, next_index_id

    os.makedirs(FACE_DATA_DIR, exist_ok=True)

    if os.path.exists(INDEX_PATH) and os.path.exists(ID_MAP_PATH):
        index = faiss.read_index(INDEX_PATH)
        with open(ID_MAP_PATH, "r") as f:
            id_map = json.load(f)
        next_index_id = max([int(k) for k in id_map.keys()]) + 1
    else:
        # Dùng cosine similarity (cần normalize vector trước khi add/search)
        index = faiss.IndexIDMap(faiss.IndexFlatIP(d))
        id_map = {}
        next_index_id = 0

# ===== THÊM VECTOR MỚI VÀO INDEX =====
def add_embedding(user_id: str, embedding: np.ndarray, angle: str = "front"):
    global next_index_id
    vec = np.array([embedding], dtype='float32')
    vec = vec / np.linalg.norm(vec, axis=1, keepdims=True)  # Normalize
    faiss_id = next_index_id
    full_id = f"{user_id}__{angle}"
    index.add_with_ids(vec, np.array([faiss_id]))
    id_map[str(faiss_id)] = full_id
    next_index_id += 1
    print(f"✅ FAISS: Đã thêm vector cho {full_id}, FAISS ID = {faiss_id}")

# ===== TÌM KIẾM USER GẦN NHẤT VỚI 3 GÓC =====
def search_by_user_all_angles(user_id: str, embeddings: dict, threshold=0.6):
    matched_count = 0

    for angle in ["front", "left", "right"]:
        query_vec = embeddings.get(angle, None)

        if not isinstance(query_vec, np.ndarray) or query_vec.shape != (512,):
            print(f"⚠️ Bỏ qua góc {angle} do không có vector hợp lệ.")
            continue

        vec = np.expand_dims(query_vec.astype("float32"), axis=0)
        vec = vec / np.linalg.norm(vec, axis=1, keepdims=True)  # Normalize truy vấn

        distances, indices = index.search(vec, 1)

        if (
            indices is None or
            indices[0][0] == -1 or
            np.isnan(distances[0][0]) or
            np.isinf(distances[0][0])
        ):
            print(f"⚠️ Không tìm thấy kết quả cho góc {angle}")
            continue

        best_index = str(indices[0][0])
        cosine_score = distances[0][0]
        matched = id_map.get(best_index)

        if (
            isinstance(matched, str) and
            matched.startswith(f"{user_id}__") and
            matched.endswith(angle) and
            cosine_score >= threshold  # Cosine nên >= threshold
        ):
            matched_count += 1
            print(f"✅ MATCH {angle}: user={user_id}, cosine={cosine_score:.4f}, id={matched}")
        else:
            print(f"❌ NOT MATCH {angle}: user={user_id}, cosine={cosine_score:.4f}, id={matched}")

    return matched_count

# ===== LƯU FILE =====
def save_index():
    faiss.write_index(index, INDEX_PATH)
    with open(ID_MAP_PATH, "w") as f:
        json.dump(id_map, f, indent=2)
