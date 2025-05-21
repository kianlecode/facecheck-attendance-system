// =============================
// ✅ Logic cho login.html
// =============================
if (window.location.pathname.endsWith("login.html")) {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();

      const user_id = document.getElementById("user_id").value.trim();
      const password = document.getElementById("password").value;

      if (!user_id || !password) {
        showMessage("loginMsg", "⚠ Vui lòng nhập đầy đủ thông tin.", false);
        return;
      }

      try {
        const response = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, password })
        });

        let res = {};
        try {
          res = await response.json();
        } catch {
          res.detail = "❌ Server không trả về phản hồi hợp lệ.";
        }

        if (!response.ok) {
          showMessage("loginMsg", res.detail || `❌ Lỗi hệ thống (${response.status})`, false);
          return;
        }

        // ✅ Thành công
        localStorage.setItem("user_id", res.user_id);
        localStorage.setItem("user_name", res.user_name);
        localStorage.setItem("role", res.role);

        showMessage("loginMsg", res.message || "✅ Đăng nhập thành công!", true);
        const dashboard = res.role === "teacher"
          ? "/teacher.html"
          : res.role === "admin"
          ? "/admin.html"
          : "/student.html";

        setTimeout(() => window.location.href = dashboard, 1000);

      } catch (err) {
        showMessage("loginMsg", "❌ Không thể kết nối đến máy chủ!", false);
        console.error(err);
      }
    };
  }
}