import random
import bcrypt
from datetime import datetime
from db import get_db_connection

def delete_all_users():
    """Xoá toàn bộ người dùng trong bảng users."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users")
        conn.commit()
        print("✅ Đã xoá toàn bộ người dùng.")
    except Exception as e:
        print("🛑 Lỗi khi xoá toàn bộ:", e)
    finally:
        conn.close()

def delete_user_by_id(user_id: str):
    """Xoá một người dùng theo user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        if cursor.rowcount == 0:
            print(f"⚠️ Không tìm thấy user với ID: {user_id}")
        else:
            conn.commit()
            print(f"✅ Đã xoá user: {user_id}")
    except Exception as e:
        print("🛑 Lỗi khi xoá user:", e)
    finally:
        conn.close()

def insert_random_users(n: int = 20):
    """Thêm ngẫu nhiên n tài khoản vào bảng users để test."""
    roles = ["student", "teacher", "admin"]
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        for i in range(1, n + 1):
            user_id = f"test{i:02d}"
            name = f"User Test {i}"
            phone = f"09{random.randint(10000000, 99999999)}"
            email = f"user{i}@example.com"
            role = random.choice(roles)
            is_active = random.choice([0, 1])
            password = bcrypt.hashpw("123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

            cursor.execute("""
                INSERT INTO users (
                    user_id, name, phone_number, email, password, role,
                    embedding_front, embedding_left, embedding_right,
                    face_image_path_front, face_image_path_left, face_image_path_right,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', '', '', ?, ?, ?)
            """, (
                user_id, name, phone, email, password, role,
                is_active, now, now
            ))

        conn.commit()
        print(f"✅ Đã thêm {n} tài khoản test thành công.")
    except Exception as e:
        print("🛑 Lỗi khi thêm tài khoản:", e)
    finally:
        conn.close()

# Ví dụ gọi hàm trực tiếp (tuỳ chọn)
if __name__ == "__main__":
    # delete_all_users()  # Bỏ comment nếu muốn xoá toàn bộ
    delete_user_by_id("s1")  # Thay bằng user_id cần xoá
    # insert_random_users()  # Bỏ comment để test
    pass