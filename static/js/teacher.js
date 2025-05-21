if (window.location.pathname.endsWith("teacher.html")) {
  const { user_id, user_name, role } = getCurrentUser();
  if (!user_id || role !== "teacher") {
    window.location.href = "/login.html";
  }

  if (user_name) {
    document.getElementById("teacherName").textContent = user_name;
  }
  
  const user = getCurrentUser();
  if (user) {
    getUnreadCount(user.user_id, "teacherNotifBadge");
  }

  let allClasses = [];
  let deleteTarget = { class_id: null, user_id: null };
  let currentEditClassId = null;
  let currentClassForSession = null;
  let allTeacherClassData = [];

  // ✅ Tạo lớp học phần
  document.getElementById("createClassForm").onsubmit = async (e) => {
    e.preventDefault();
    const class_id = document.getElementById("class_id").value.trim();
    const class_name = document.getElementById("class_name").value.trim();
    const enrollment_key = document.getElementById("enrollment_key").value.trim();

    const res = await fetch(
      `/create_class?class_id=${class_id}&class_name=${encodeURIComponent(class_name)}&enrollment_key=${encodeURIComponent(enrollment_key)}&teacher_id=${user_id}`,
      { method: "POST" }
    );

    const result = await res.json();
    showMessage("createMsg", result.message || result.detail, result.success !== false);

    if (result.success) {
      document.getElementById("createClassForm").reset();
      loadClasses();
      refreshNotifBadge();
    }
  };

  window.loadClasses = async function () {
    const div = document.getElementById("classList");
    const pagination = document.getElementById("classPagination");

    div.innerHTML = "Đang tải...";
    pagination.innerHTML = "";

    try {
      const res = await fetch(`/get_classes_by_teacher?teacher_id=${user_id}`);
      const result = await res.json();

      if (!result.success || !result.data.length) {
        div.innerHTML = `<p style="color:red;">${result.message || "Không có lớp học nào."}</p>`;
        pagination.innerHTML = "";
        return;
      }

      allTeacherClassData = result.data;
      renderFilteredTeacherClasses();
    } catch (err) {
      console.error("Lỗi khi tải danh sách lớp:", err);
      div.innerHTML = `<p style="color:red;">❌ Lỗi khi tải danh sách lớp học.</p>`;
    }
  };

  function renderFilteredTeacherClasses() {
    const div = document.getElementById("classList");
    const pagination = document.getElementById("classPagination");
    const keyword = document.getElementById("teacher-class-search")?.value.toLowerCase() || "";

    const filtered = allTeacherClassData.filter(cls =>
      cls.class_id.toLowerCase().includes(keyword) ||
      cls.class_name.toLowerCase().includes(keyword)
    );

  renderPaginatedTable(
    filtered,
    cls => {
      const card = document.createElement("div");
      card.className = "class-card";

      const color = getRandomColor(); // bạn nên khai báo hàm này trong utils.js

      card.innerHTML = `
        <div class="class-cover" style="background-color: ${color};"></div>
        <div class="class-info">
          <p class="class-id"><strong>Mã lớp:</strong> ${cls.class_id}</p>
          <h3 class="class-name" title="${cls.class_name}">${cls.class_name}</h3>
          <p class="class-date"><strong>Ngày tạo:</strong> ${formatDate(cls.created_at)}</p>

          <div class="key-input-container" style="margin-top: 8px;">
            <label><strong>Mã đăng ký:</strong></label>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
              <input type="password" class="class-key-pass" id="key-${cls.class_id}" value="${cls.enrollment_key}" readonly />
              <button type="button"
                class="class-key-toggle"
                onmousedown="togglePassword('key-${cls.class_id}', true)"
                onmouseup="togglePassword('key-${cls.class_id}', false)"
                onmouseleave="togglePassword('key-${cls.class_id}', false)">👁</button>
            </div>
          </div>

          <div class="class-actions">
            <div class="action-row">
              <button onclick="showCreateSessionModal('${cls.class_id}')">Tạo phiên</button>
              <button onclick="viewSessionsModal('${cls.class_id}')">Xem phiên</button>
            </div>
            <div class="action-row">
              <button onclick="viewStudentsModal('${cls.class_id}')">Xem SV</button>
              <button onclick="openEditClassModal('${cls.class_id}', '${cls.class_name}', '${cls.enrollment_key}')">Chỉnh sửa</button>
            </div>
          </div>
        </div>
      `;
      return card;
    },
    div, pagination, 6
  );
  }

  // ✅ Hàm định dạng ngày
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  }

  function formatDateTime(isoString) {
    const d = new Date(isoString);
    const date = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const time = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    });

    return `${date} - ${time}`;
  }

  window.togglePassword = function(id, show) {
    const input = document.getElementById(id);
    if (input) input.type = show ? 'text' : 'password';
  };
  
  // ✅ Mở modal tạo phiên
  window.showCreateSessionModal = function(class_id) {
    currentClassForSession = class_id;
    document.getElementById("sessionStartInput").value = "";
    document.getElementById("sessionEndInput").value = "";
    document.getElementById("createSessionMsg").textContent = "";
    document.getElementById("createSessionModal").style.display = "flex";
  };

  // ✅ Đóng modal tạo phiên
  window.closeCreateSessionModal = function () {
    document.getElementById("createSessionModal").style.display = "none";
    currentClassForSession = null;
  };

  // ✅ Gửi tạo phiên lên server
  const createBtn = document.getElementById("confirmCreateSessionBtn");
  if (createBtn) {
    createBtn.onclick = async function () {
      const start = document.getElementById("sessionStartInput").value;
      const end = document.getElementById("sessionEndInput").value;
      const msg = document.getElementById("createSessionMsg");
      const ontimeLimit = parseInt(document.getElementById("ontimeLimitInput").value || "10");

      if (!start || !end) {
        msg.textContent = "⚠️ Vui lòng chọn đủ thời gian!";
        return;
      }

      const res = await fetch("/create_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: currentClassForSession,
          start_time: start,
          end_time: end,
          ontime_limit: ontimeLimit
        })
      });

      const result = await res.json();

      if (result.success) {
        msg.textContent = "✅ Tạo phiên thành công!";
        setTimeout(() => {
          closeCreateSessionModal();
          loadClasses();
          refreshNotifBadge();
        }, 1000); // chờ 1 giây để giảng viên thấy thông báo
      } else {
        msg.textContent = result.message || "❌ Lỗi tạo phiên!";
      }
    };
  }


    // ✅ Hàm hiển thị danh sách sinh viên trong modal
    window.viewStudentsModal = async function (class_id) {
      const modal = document.getElementById("studentModal");
      const body = document.getElementById("studentModalBody");
    
      modal.style.display = "flex";
      modal.dataset.classId = class_id;
    
      body.innerHTML = "⏳ Đang tải...";
    
      const res = await fetch(`/teacher/students?class_id=${class_id}`);
      const result = await res.json();
    
      if (!result.success || !result.data.length) {
        body.innerHTML = "<p>⚠ Không có sinh viên nào.</p>";
        return;
      }
    
      const students = result.data.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
      const tableId = `student-table-${class_id}`;
    
      body.innerHTML = `
      <p style="margin: 10px 0;">Tổng số sinh viên: ${students.length}</p>
      <div style="overflow-x: auto;">
        <table id="${tableId}" class="student-table" style="min-width: 800px;">
          <thead><tr><th>STT</th><th>Mã SV</th><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Xoá</th></tr></thead>
          <tbody>
            ${students.map((sv, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${sv.user_id}</td>
                <td>${sv.name}</td>
                <td>${sv.email || "-"}</td>
                <td>${sv.phone_number || "-"}</td>
                <td><button onclick="showConfirmDelete('${class_id}', '${sv.user_id}')">❌</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    
      // ✅ Cập nhật lại ô tìm kiếm sau khi render bảng xong
      const searchInput = document.getElementById("studentSearchInput");
      if (searchInput) {
        searchInput.oninput = function() {
          filterStudents(tableId, this.value);
        };
      }
    };
  
    window.showConfirmDelete = function (class_id, user_id) {
      deleteTarget = { class_id, user_id };
      document.getElementById("confirmDeleteText").innerHTML =
          `Bạn có chắc chắn muốn xoá sinh viên <strong>${user_id}</strong> khỏi lớp <strong>${class_id}</strong>?`;
      document.getElementById("confirmDeleteModal").style.display = "flex";
    };
  
    window.closeConfirmDelete = function () {
      document.getElementById("confirmDeleteModal").style.display = "none";
    };

    document.getElementById("confirmDeleteBtn").onclick = async function () {
      const { class_id, user_id } = deleteTarget;
    
      if (user_id) {
        // Xoá sinh viên
        const res = await fetch(`/remove_student_from_class?class_id=${class_id}&user_id=${user_id}`, { method: "DELETE" });
        const result = await res.json();
        alert(result.message || (result.success ? "✅ Đã xoá sinh viên" : "❌ Lỗi"));
        if (result.success) viewStudentsModal(class_id);
      } else {
        // Xoá lớp học phần
        const res = await fetch(`/delete_class?class_id=${class_id}`, { method: "DELETE" });
        const result = await res.json();
        alert(result.message || (result.success ? "✅ Đã xoá lớp học phần" : "❌ Lỗi"));
        if (result.success) loadClasses();
      }
    
      closeConfirmDelete();
    };
    
    // Khi bấm nút "Sửa" lớp
    window.openEditClassModal = function(classId, className, classKey) {
      const modal = document.getElementById('modal-edit-class');
      document.getElementById('edit-class-name').value = className || '';
      document.getElementById('edit-class-key').value = classKey || '';
      document.getElementById('edit-class-form').dataset.classId = classId;
      modal.style.display = 'flex';
      modal.style.justifyContent = 'center';
      modal.style.alignItems = 'center';
    }

    // Hàm đóng modal
    window.closeEditModal = function() {
      const modal = document.getElementById('modal-edit-class');
      modal.style.display = 'none';
      // Reset form khi đóng
      document.getElementById('edit-class-form').reset();
      delete document.getElementById('edit-class-form').dataset.classId;
    }

    // Hàm xử lý lưu chỉnh sửa lớp
    document.getElementById('edit-class-form').onsubmit = async function(e) {
      e.preventDefault();
      const classId = e.target.dataset.classId;
      const newName = document.getElementById('edit-class-name').value.trim();
      const newKey = document.getElementById('edit-class-key').value.trim();

      if (!newName || !newKey) {
        showMessage('⚠️ Vui lòng nhập đầy đủ thông tin!', false);
        return;
      }

      const res = await fetch('/update_class', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ class_id: classId, class_name: newName, enrollment_key: newKey })
      });

      const result = await res.json();
      if (result.success) {
        showMessage('✅ Cập nhật lớp thành công!');
        closeEditModal();
        loadClasses(); // load lại danh sách lớp
        refreshNotifBadge();
      } else {
        showMessage('❌ Lỗi cập nhật lớp!', false);
      }
    }
    
    // Mở modal xác nhận xoá lớp
    window.openConfirmDeleteModal = function() {
      const modal = document.getElementById('modal-confirm-delete-class');
      modal.style.display = 'flex'; // ✅
      modal.style.justifyContent = 'center'; // ✅
      modal.style.alignItems = 'center'; // ✅
      modal.style.zIndex = 9999; // ✅ nổi lên trên tất cả
    }

    // Đóng modal xác nhận xoá
    window.closeConfirmDeleteModal = function() {
      document.getElementById('modal-confirm-delete-class').style.display = 'none';
    }

    // Thực hiện xoá lớp học phần
    document.getElementById('confirmDeleteClassBtn').onclick = async function() {
      const classId = document.getElementById('edit-class-form').dataset.classId;
      if (!classId) {
        alert('Không tìm thấy lớp để xoá!');
        return;
      }

      const res = await fetch('/delete_class', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ class_id: classId })
      });

      const result = await res.json();
      if (result.success) {
        showMessage('✅ Đã xoá lớp học phần!');
        closeConfirmDeleteModal();
        closeEditModal();
        loadClasses(); // load lại danh sách lớp
        refreshNotifBadge();
      } else {
        showMessage('❌ Xoá lớp thất bại!', false);
      }
    }

  // ✅ Thêm sinh viên
  window.addStudentToClass = async function() {
    const input = document.getElementById("addStudentInput");
    const user_id = input.value.trim();
    const class_id = document.getElementById("studentModal").dataset.classId;
    
    if (!user_id) {
      alert("⚠️ Vui lòng nhập mã sinh viên!");
      return;
    }
  
    const res = await postJSON("/add_student_to_class", { class_id, user_id });
    alert(res.message || (res.success ? "✅ Thêm sinh viên thành công!" : "❌ Thêm thất bại"));
  
    if (res.success) {
      input.value = "";
      viewStudentsModal(class_id);
      refreshNotifBadge();
    }
  };

  // ✅ Xoá sinh viên khỏi lớp
  window.removeStudent = async function (class_id, user_id) {
    if (!confirm(`Bạn có chắc chắn muốn xoá sinh viên ${user_id} khỏi lớp ${class_id}?`)) return;
    const res = await fetch(`/remove_student_from_class?class_id=${class_id}&user_id=${user_id}`, { method: "DELETE" });
    const result = await res.json();
    showMessage("studentListMsg", result.message || (result.success ? "✅ Đã xoá" : "❌ Lỗi"), result.success);
    if (result.success) {
      viewStudentsModal(class_id);
      refreshNotifBadge();
    }
  };

  // ✅ Đóng modal
  window.closeStudentModal = function () {
    document.getElementById("studentModal").style.display = "none";
  };

  window.closeSessionModal = function () {
    document.getElementById("sessionModal").style.display = "none";
  };

  // ✅ Tìm kiếm sinh viên
  window.filterStudents = function(tableId, keyword) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll("tbody tr");
    keyword = keyword.toLowerCase();

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(keyword) ? "" : "none";
    });
  };
  
// =============================
// ✅ Xem danh sách điểm danh theo phiên - triển khai đầy đủ
// =============================
window.viewAttendanceBySession = async function(session_id, class_id) {
  const modal = document.getElementById("sessionModal");
  const body = document.getElementById("sessionModalBody");

  body.innerHTML = "⏳ Đang tải dữ liệu điểm danh...";
  const res = await fetch(`/attendance_list_by_session?session_id=${session_id}&class_id=${class_id}`);
  const result = await res.json();

  if (!result.success || !result.data.length) {
    body.innerHTML = "<p>⚠ Không có sinh viên điểm danh.</p><button onclick=\"viewSessionsModal('" + class_id + "')\">🔙 Quay lại danh sách phiên</button>";
    return;
  }

  const rows = result.data.map(r => `
    <tr>
      <td>${r.user_id}</td>
      <td>${r.name}</td>
      <td>${r.status}</td>
      <td>${formatDateTime(r.created_at)}</td>
    </tr>
  `).join("");

  body.innerHTML = `
    <h4>Kết quả điểm danh</h4>
    <table>
      <thead><tr><th>Mã SV</th><th>Họ tên</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align: right; margin-top: 10px;">
      <button onclick="viewSessionsModal('${class_id}')" class="btn-blue">Quay lại</button>
    </div>
  `;
};

// =============================
// ✅ Cập nhật thêm nút "Xem điểm danh" trong viewSessionsModal
// =============================
window.viewSessionsModal = async function (class_id) {
  const modal = document.getElementById("sessionModal");
  const body = document.getElementById("sessionModalBody");

  modal.style.display = "flex";
  body.innerHTML = "⏳ Đang tải...";

  const res = await fetch(`/get_sessions?class_id=${class_id}`);
  const result = await res.json();

  if (!result.success || !result.data.length) {
    body.innerHTML = "<p>⚠ Không có phiên nào.</p>";
    return;
  }

  const sessions = result.data;

  body.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
      <thead>
        <tr>
          <th>STT</th>
          <th>Bắt đầu</th>
          <th>Kết thúc</th>
          <th>Ngày tạo</th>
          <th>On-time</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        ${sessions.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${formatDateTime(s.start_time)}</td>
            <td>${formatDateTime(s.end_time)}</td>
            <td>${formatDateTime(s.created_at)}</td>
            <td>${s.ontime_limit || 10} phút</td>
            <td>
              <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                <button class="btn-action" onclick="viewAttendanceBySession('${s.session_id}', '${class_id}')">📄 Xem điểm danh</button>
                <button class="btn-action" onclick="exportAttendanceExcel('${s.session_id}', '${class_id}')">📥 Xuất Excel</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
};

window.exportAttendanceExcel = function(session_id, class_id) {
  const url = `/export_attendance_excel?session_id=${session_id}&class_id=${class_id}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance_${class_id}_session${session_id}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

async function loadTeacherInfo() {
  const { user_id } = getCurrentUser();
  const res = await fetch(`/info?user_id=${user_id}`);
  const json = await res.json();
  const data = json.data;
  const infoArea = document.getElementById("account-info");

  infoArea.innerHTML = `
    <div class="profile-container">
      <div class="info-view">
        <table class="info-table">
          <tr><th>Mã giảng viên</th><td>${data.user_id}</td></tr>
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
    loadTeacherInfo();
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
        setTimeout(loadTeacherInfo, 1000);
      }
    } catch (err) {
      msg.textContent = "❌ Có lỗi xảy ra khi cập nhật!";
      msg.style.color = "red";
    }
  };
}
window.loadTeacherInfo = loadTeacherInfo;

  // ✅ Khởi động
  loadClasses();
  setupModalLogout();
  const searchInput = document.getElementById("teacher-class-search");
  if (searchInput) {
    searchInput.addEventListener("input", renderFilteredTeacherClasses);
  }
}

function switchTeacherTab(tab) {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelector(`.tab-button[data-tab="${tab}"]`)?.classList.add("active");

  document.getElementById("teacher-tab-list").style.display = tab === "list" ? "block" : "none";
  document.getElementById("teacher-tab-create").style.display = tab === "create" ? "block" : "none";

  if (tab === "list") loadClasses();
}