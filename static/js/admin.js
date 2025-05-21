// =============================
// Logic cho admin.html
// =============================

if (window.location.pathname.endsWith("admin.html")) {
  const teacherForm = document.getElementById("create-teacher-form");
  const accountTableBody = document.getElementById("account-table-body");
  const loadBtn = document.getElementById("load-accounts");
  const searchInput = document.getElementById("search-input");
  const roleFilter = document.getElementById("account-role-filter");

  const { user_name, role } = getCurrentUser();
  if (role !== "admin") {
    window.location.href = "/login.html";
  }

  document.getElementById("admin-name").textContent = user_name || "Admin";

  if (teacherForm) {
    teacherForm.onsubmit = async (e) => {
      e.preventDefault();

      const user_id = document.getElementById("user_id").value.trim();
      const name = document.getElementById("name").value.trim();
      const phone_number = document.getElementById("phone_number").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const role = document.getElementById("role").value;

      if (!user_id || !name || !phone_number || !email || !password) {
        showMessage("admin-message", "⚠ Vui lòng nhập đầy đủ thông tin.", false);
        return;
      }

      const res = await postJSON("/admin/create_user", {
        user_id,
        name,
        phone_number,
        email,
        password,
        role
      });

      showMessage("admin-message", res.message || res.detail, res.success !== false);
      if (res.success) {
        teacherForm.reset();
        if (loadBtn) loadBtn.click();
      }
    };
  }

  if (loadBtn && accountTableBody) {
    loadBtn.onclick = async () => {
      const keyword = document.getElementById("search-input").value.toLowerCase();
      const selectedRole = document.getElementById("account-role-filter").value;
      const tableBody = document.getElementById("account-table-body");
      const pagination = document.getElementById("pagination");

      tableBody.innerHTML = `<tr><td colspan="8">⏳ Đang tải...</td></tr>`;
      pagination.innerHTML = "";

      const res = await fetch("/admin/get_all_users");
      const data = await res.json();

      if (!data.success || !data.data.length) {
        tableBody.innerHTML = `<tr><td colspan="8">⚠ Không có tài khoản nào.</td></tr>`;
        return;
      }

      const filtered = data.data.filter(u => {
        const matchKeyword =
          (u.name || "").toLowerCase().includes(keyword) ||
          (u.email || "").toLowerCase().includes(keyword) ||
          (u.user_id || "").toLowerCase().includes(keyword);

        const matchRole = selectedRole ? u.role === selectedRole : true;

        return matchKeyword && matchRole;
      });

      if (!filtered.length) {
        tableBody.innerHTML = `<tr><td colspan="8">⚠ Không tìm thấy tài khoản phù hợp.</td></tr>`;
        return;
      }

      renderPaginatedTable(
        filtered,
        user => {
          const tr = document.createElement("tr");
          const isActive = Number(user.is_active) === 1;

          tr.innerHTML = `
            <td>${user.user_id}</td>
            <td>${user.name}</td>
            <td>${user.phone_number || ""}</td>
            <td>${user.email || ""}</td>
            <td>${user.role}</td>
            <td>${new Date(user.created_at).toLocaleDateString("vi-VN")}</td>
            <td style="color: ${isActive ? 'green' : 'crimson'}; font-weight: 500;">
              ${isActive ? 'Đang hoạt động' : 'Đã bị khoá'}
            </td>
            <td>
              <input type="checkbox" ${user.can_update_face ? "checked" : ""} 
                    onchange="toggleUpdateFace('${user.user_id}', this.checked)" />
            </td>
            <td>
              <button onclick="toggleUserStatus('${user.user_id}')">
                ${isActive ? 'Khoá' : 'Mở khoá'}
              </button>
              <button onclick="deleteUser('${user.user_id}')">🗑 Xoá</button>
            </td>
          `;
          return tr;
        },
        tableBody,
        pagination,
        10 // Số dòng mỗi trang
      );
    };

    loadBtn.click();
    setupModalLogout();
    showSection("list");
  }

  window.toggleUpdateFace = async function (user_id, allow) {
    const res = await fetch("/admin/grant_update_face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, allow })
    });

    const json = await res.json();
    showMessage("admin-message", json.message, json.success !== false);
  };
  
  window.toggleUserStatus = async function(user_id) {
    const res = await fetch(`/admin/toggle_user_status/${user_id}`, {
      method: "PUT"
    });
    const data = await res.json();
    showMessage("admin-message", data.message || data.detail, data.success !== false);
    if (data.success) document.getElementById("load-accounts").click();
  };

  window.deleteUser = async function(user_id) {
    if (!confirm(`Bạn có chắc chắn muốn xoá tài khoản ${user_id}?`)) return;
    const res = await fetch(`/admin/delete_user/${user_id}`, { method: "DELETE" });
    const data = await res.json();
    showMessage("admin-message", data.message || data.detail, data.success !== false);
    if (data.success) document.getElementById("load-accounts").click();
  };

  document.getElementById("export-excel").onclick = async () => {
    const res = await fetch("/admin/get_all_users");
    const data = await res.json();
    if (!data.success || !data.data.length) {
      alert("⚠ Không có dữ liệu!");
      return;
    }

    const wsData = [["ID", "Họ tên", "SĐT", "Email", "Vai trò", "Ngày tạo", "Trạng thái"]];
    data.data.forEach(u => {
      wsData.push([
        u.user_id,
        u.name,
        u.phone_number || "",
        u.email || "",
        u.role,
        new Date(u.created_at).toLocaleDateString("vi-VN"),
        Number(u.is_active) === 1 ? "Đang hoạt động" : "Đã khoá"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TaiKhoan");

    const today = new Date();
    const dateStr = today.toLocaleDateString("vi-VN");
    const filename = `Danh_sach_tai_khoan_${dateStr.replaceAll("/", "_")}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  loadAdminInfo();
}

  // ========== Tải thông tin tài khoản admin ========== 
  async function loadAdminInfo() {
    const { user_id } = getCurrentUser();
    const res = await fetch(`/info?user_id=${user_id}`);
    const json = await res.json();
    const data = json.data;
    const infoArea = document.getElementById("account-info");

    infoArea.innerHTML = `
      <div class="profile-container">
        <div class="info-view">
          <table class="info-table">
            <tr><th>Mã người dùng</th><td>${data.user_id}</td></tr>
            <tr><th>Họ tên</th><td>${data.name}</td></tr>
            <tr><th>Email</th><td>${data.email || "Chưa có"}</td></tr>
            <tr><th>Số điện thoại</th><td>${data.phone_number || "Chưa có"}</td></tr>
            <tr><th>Vai trò</th><td>${data.role}</td></tr>
            <tr><th>Cập nhật lần cuối</th><td>${data.updated_at || "Không rõ"}</td></tr>
          </table>
          <button id="edit-info-btn" class="btn mt-2">✏️ Sửa thông tin</button>
        </div>

        <div class="info-edit" style="display: none;">
          <form id="edit-info-form">
            <label>Họ tên:</label>
            <input type="text" id="edit-name" value="${data.name}" required />

            <label>Email:</label>
            <input type="email" id="edit-email" value="${data.email || ''}" required />

            <label>Số điện thoại:</label>
            <input type="text" id="edit-phone" value="${data.phone_number || ''}" required />

            <hr style="margin: 1rem 0;" />
            <h4>🔐 Đổi mật khẩu</h4>

            <label>Mật khẩu hiện tại:</label>
            <input type="password" id="current-password" />

            <label>Mật khẩu mới:</label>
            <input type="password" id="new-password" />

            <label>Nhập lại mật khẩu mới:</label>
            <input type="password" id="confirm-password" />

            <div class="mt-2">
              <button type="submit" class="btn">💾 Lưu</button>
              <button type="button" class="btn btn-secondary" id="cancel-edit-btn">❌ Hủy</button>
            </div>

            <p id="info-message" class="mt-2"></p>
          </form>
        </div>
      </div>
    `;
  
  document.getElementById("edit-info-btn").onclick = () => {
    document.querySelector(".info-view").style.display = "none";
    document.querySelector(".info-edit").style.display = "block";
  };

  document.getElementById("cancel-edit-btn").onclick = () => {
    loadAdminInfo();
  };

  document.getElementById("edit-info-form").onsubmit = async (e) => {
    e.preventDefault();
    const new_name = document.getElementById("edit-name").value.trim();
    const new_email = document.getElementById("edit-email").value.trim();
    const new_phone = document.getElementById("edit-phone").value.trim();
    const msg = document.getElementById("info-message");

    const currentPass = document.getElementById("current-password").value.trim();
    const newPass = document.getElementById("new-password").value.trim();
    const confirmPass = document.getElementById("confirm-password").value.trim();

    try {
      const r1 = await fetch("/info/update_name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, new_name })
      });
      const r2 = await fetch("/info/update_phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, phone_number: new_phone })
      });

      const res1 = await r1.json();
      const res2 = await r2.json();

      let res3Message = "";
      if (currentPass || newPass || confirmPass) {
        if (!currentPass || !newPass || !confirmPass) {
          msg.textContent = "❗ Vui lòng điền đầy đủ thông tin đổi mật khẩu.";
          msg.style.color = "red";
          return;
        }
        if (newPass !== confirmPass) {
          msg.textContent = "❗ Mật khẩu mới không trùng khớp.";
          msg.style.color = "red";
          return;
        }

        const res3 = await fetch("/info/change_password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, old_password: currentPass, new_password: newPass })
        });

        if (!res3.ok) {
          const errText = await res3.text();
          msg.textContent = `❌ Lỗi: ${res3.status} - ${errText}`;
          msg.style.color = "red";
          return;
        }

        const res3Data = await res3.json();
        if (!res3Data.success) {
          msg.textContent = res3Data.message || "❌ Đổi mật khẩu thất bại.";
          msg.style.color = "red";
          return;
        }
        res3Message = res3Data.message || "";
      }

      msg.style.color = res1.message && res2.message ? "green" : "red";
      msg.textContent = `${res1.message || ""} ${res2.message || ""} ${res3Message}`.trim();

      if (res1.message && res2.message) {
        localStorage.setItem("user_name", new_name);
        setTimeout(loadAdminInfo, 1000);
      }
    } catch (err) {
      msg.textContent = "❌ Có lỗi xảy ra khi cập nhật!";
      msg.style.color = "red";
    }
  };
}

