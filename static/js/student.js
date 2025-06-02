// =============================
// ✅ Logic cho student.html
// =============================
const user = getCurrentUser();
const user_id = user?.user_id;
let classIdToUnenroll = null;

window.onload = async function () {
  if (!user || user.role !== "student") {
    window.location.href = "/login.html";
    return;
  }
  document.getElementById("student-name").textContent = user.user_name;
  loadRegisteredClasses();
  if (user) {
    getUnreadCount(user.user_id);
  }  
};


function showSection(section) {
  const sections = ['attendance', 'classes', 'info', 'notifications'];
  sections.forEach(id => {
    const el = document.getElementById(`section-${id}`);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(`section-${section}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.student-sidebar a:not(.logout-button)').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.student-sidebar a[data-section="${section}"]`);
  if (link) link.classList.add('active');

  if (section === 'classes') {
    switchClassTab('list');
  }
  if (section === 'info') loadAccountInfo();
  if (section === 'notifications') {
    loadNotifications(user.user_id, "notificationList");
  }
}

// ========== Đăng ký lớp học phần ==========
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("student-class-search");
  if (searchInput) {
    searchInput.addEventListener("input", renderFilteredClasses);
  }

  const form = document.getElementById("enroll-form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const class_id = document.getElementById("enroll-class-id").value.trim();
      const enrollment_key = document.getElementById("enroll-class-key").value.trim();
      const msg = document.getElementById("enroll-message");

      const res = await fetch("/enroll_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, class_id, enrollment_key })
      });

      const data = await res.json();
      msg.textContent = data.message || "Lỗi";
      msg.style.color = data.success ? "green" : "red";

      if (data.success) {
        form.reset();
        loadRegisteredClasses();
        refreshNotifBadge();
      }
    });
  }
});

let allClassData = [];
// ========== Hiển thị danh sách lớp đã đăng ký ==========
async function loadRegisteredClasses() {
  const container = document.getElementById("registered-classes");
  const pagination = document.getElementById("studentPagination");

  container.innerHTML = "Đang tải...";
  pagination.innerHTML = "";

  try {
    const res = await fetch(`/get_student_classes?user_id=${user_id}`);
    const data = await res.json();
    if (!data.success || data.data.length === 0) {
      container.innerHTML = "<p>⚠️ Bạn chưa đăng ký lớp nào.</p>";
      return;
    }

    allClassData = data.data; // Gán vào biến toàn cục
    renderFilteredClasses();  // Hiển thị có lọc
  } catch (err) {
    container.innerHTML = `<p style='color:red;'>❌ Lỗi khi tải lớp học phần.</p>`;
  }
}

function renderFilteredClasses() {
  const container = document.getElementById("registered-classes");
  const pagination = document.getElementById("studentPagination");
  const keyword = document.getElementById("student-class-search")?.value.toLowerCase() || "";

  const filtered = allClassData.filter(cls =>
    cls.class_id.toLowerCase().includes(keyword) ||
    cls.class_name.toLowerCase().includes(keyword)
  );

  renderPaginatedTable(
    filtered,
    cls => {
      const card = document.createElement("div");
      card.className = "class-card";

      const color = getRandomColor();

      card.innerHTML = `
        <div class="class-cover" style="background-color: ${color};"></div>
        <div class="class-info">
          <p>Mã lớp: ${cls.class_id}</p>
          <h3 class="class-name" title="${cls.class_name}">${cls.class_name}</h3>
          <div class="class-actions">
            <button class="btn btn-blue btn-sm" onclick="openAttendanceModal('${cls.class_id}')">Xem lịch sử</button>
            <button class="btn btn-red btn-sm" onclick="showUnenrollModal('${cls.class_id}')">Hủy</button>
          </div>
        </div>
      `;
      return card;
    },
    container,
    pagination,
    8
  );
}

// ========== Modal xác nhận huỷ lớp ==========
function showUnenrollModal(class_id) {
  classIdToUnenroll = class_id;
  document.getElementById("unenrollModalText").innerHTML =
    `Bạn có chắc muốn hủy đăng ký lớp <strong>${class_id}</strong>?`;
  document.getElementById("confirmUnenrollModal").style.display = "flex";
}

function closeUnenrollModal() {
  document.getElementById("confirmUnenrollModal").style.display = "none";
  classIdToUnenroll = null;
}

async function confirmUnenroll() {
  if (!classIdToUnenroll) return;

  const res = await fetch(`/unenroll_class?user_id=${user_id}&class_id=${classIdToUnenroll}`, {
    method: "DELETE"
  });
  const data = await res.json();
  alert(data.message);
  closeUnenrollModal();
  if (data.success) {
    loadRegisteredClasses();
    refreshNotifBadge();
  }
}

async function loadAccountInfo() {
  const res = await fetch(`/info?user_id=${user_id}`);
  const json = await res.json();
  const data = json.data;
  const infoArea = document.getElementById("account-info");

  infoArea.innerHTML = `
    <div class="profile-container">
      <div class="avatar-section">
        <img src="/info/face_image?user_id=${data.user_id}" alt="Ảnh khuôn mặt" class="avatar-img"
             onerror="this.src='/static/default-avatar.png'">
      </div>
      <div class="info-view">
        <table class="info-table">
          <tr><th>Mã sinh viên</th><td>${data.user_id}</td></tr>
          <tr><th>Họ tên</th><td>${data.name}</td></tr>
          <tr><th>Email</th><td>${data.email || "Chưa có"}</td></tr>
          <tr><th>Số điện thoại</th><td>${data.phone_number || "Chưa có"}</td></tr>
          <tr><th>Cập nhật lần cuối</th><td>${data.updated_at || "Không rõ"}</td></tr>
        </table>
        <button id="edit-info-btn" class="btn mt-2">Sửa thông tin</button>
        <button id="btn-update-face" class="btn mt-2">Cập nhật ảnh khuôn mặt</button>
        <p id="info-message" class="mt-2"></p>
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
        </form>
      </div>
    </div>
  `;

  // ✅ Xử lý hiển thị nút cập nhật khuôn mặt
  const btnUpdate = document.getElementById("btn-update-face");
  btnUpdate.onclick = () => {
    fetch(`/info?user_id=${user_id}`)
      .then(res => res.json())
      .then(json => {
        if (json?.data?.can_update_face) {
          window.location.href = "biometric.html?mode=update&from=student";
        } else {
          const msg = document.getElementById("info-message");
          msg.textContent = "⚠️ Bạn chưa được cấp quyền cập nhật ảnh khuôn mặt.";
          msg.style.color = "red";
        }
      })
      .catch(() => {
        const msg = document.getElementById("info-message");
        msg.textContent = "❌ Lỗi khi kiểm tra quyền cập nhật.";
        msg.style.color = "red";
      });
  };

  // ✅ Sửa và huỷ thông tin cá nhân (giữ nguyên các phần này như bạn đã có)
  document.getElementById("edit-info-btn").onclick = () => {
    document.querySelector(".info-view").style.display = "none";
    document.querySelector(".info-edit").style.display = "block";
  };

  document.getElementById("cancel-edit-btn").onclick = () => {
    loadAccountInfo();
  };

  const infoForm = document.getElementById("edit-info-form");
  if (infoForm) {
    infoForm.onsubmit = async (e) => {
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
        refreshNotifBadge();
        setTimeout(loadAccountInfo, 1000);
      }
      } catch (err) {
        msg.textContent = "❌ Có lỗi xảy ra khi cập nhật!";
        msg.style.color = "red";
      }
    };
  }
}

// ========== Modal điểm danh theo lớp ==========
async function openAttendanceModal(class_id) {
  const modal = document.getElementById("attendanceHistoryModal");
  const historyContent = document.getElementById("attendance-history-content");
  historyContent.innerHTML = "Đang tải dữ liệu...";
  modal.style.display = "flex";

  try {
    const res = await fetch(`/get_attendance_history?user_id=${user_id}&class_id=${class_id}`);
    const json = await res.json();
    const data = json.data;

    if (!data || data.length === 0) {
      historyContent.innerHTML = "📭 Không có lịch sử điểm danh.";
      return;
    }

    let html = `
      <table class="table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Thời gian</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const row of data) {
      html += `
        <tr>
          <td>${row.date}</td>
          <td>${row.time_range}</td>
          <td>${row.status}</td>
        </tr>
      `;
    }

    html += "</tbody></table>";
    historyContent.innerHTML = html;
  } catch (err) {
    historyContent.innerHTML = "❌ Lỗi khi tải lịch sử.";
  }
}

function closeAttendanceModal() {
  document.getElementById("attendanceHistoryModal").style.display = "none";
}

function showClassKey() {
  document.getElementById("enroll-class-key").type = "text";
}
function hideClassKey() {
  document.getElementById("enroll-class-key").type = "password";
}

setupModalLogout();

function switchClassTab(tab) {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelector(`.tab-button[data-tab="${tab}"]`)?.classList.add("active");

  document.getElementById("class-tab-list").style.display = tab === "list" ? "block" : "none";
  document.getElementById("class-tab-enroll").style.display = tab === "enroll" ? "block" : "none";

  if (tab === "list") loadRegisteredClasses();
}

function renderNotificationItem(msg, created_at) {
  const li = document.createElement("li");
  li.className = "noti-item";

  const time = new Date(created_at).toLocaleString("vi-VN", {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Làm nổi bật nếu là thông báo phiên mới
  if (msg.includes("phiên điểm danh mới")) {
    li.innerHTML = `<strong>📢 ${msg}</strong><br><small>${time}</small>`;
    li.style.background = "#fffbe6"; // vàng nhạt
    li.style.borderLeft = "4px solid orange";
    li.style.padding = "8px";
  } else {
    li.innerHTML = `${msg}<br><small>${time}</small>`;
  }

  return li;
}