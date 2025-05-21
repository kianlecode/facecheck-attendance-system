// =============================
// ✅ Logic cho register.html (có kiểm tra trùng mã sinh viên)
// =============================

if (window.location.pathname.endsWith("register.html")) {
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMsg");

  form.onsubmit = async (e) => {
    e.preventDefault();

    const user_id = document.getElementById("user_id").value.trim();
    const name = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value;
    const phone_number = document.getElementById("phone_number").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!user_id || !name || !password || !phone_number || !email) {
      showMessage("registerMsg", "⚠️ Vui lòng nhập đầy đủ thông tin!", false);
      return;
    }

    // ⚠️ Kiểm tra trùng user_id
    try {
      const res = await fetch(`/check-user-id?user_id=${encodeURIComponent(user_id)}`);
      const data = await res.json();

      if (data.exists) {
        showMessage("registerMsg", "❌ Mã sinh viên đã tồn tại. Vui lòng nhập mã khác.", false);
        return;
      }
    } catch (err) {
      console.error("Lỗi kiểm tra user_id:", err);
      showMessage("registerMsg", "⚠️ Lỗi kiểm tra mã sinh viên. Vui lòng thử lại.", false);
      return;
    }

    // Lưu tạm toàn bộ thông tin vào sessionStorage
    const registerData = {
      user_id,
      name,
      password,
      phone_number,
      email
    };
    sessionStorage.setItem("register_data", JSON.stringify(registerData));

    // Điều hướng sang bước xác thực khuôn mặt
    window.location.href = "/biometric.html";
  };
}