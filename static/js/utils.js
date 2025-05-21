// =============================
// ✅ Các hàm tiện ích dùng chung (global)
// =============================
window.getCurrentUser = function () {
  return {
    user_id: localStorage.getItem("user_id"),
    user_name: localStorage.getItem("user_name"),
    role: localStorage.getItem("role")
  };
};

window.showMessage = function (id, message, success = true) {
  const p = document.getElementById(id);
  if (!p) return;
  p.textContent = message;
  p.style.color = success ? "green" : "red";
};

window.postJSON = async (url, data) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
};

window.logout = function () {
  localStorage.clear();
  window.location.href = "/login.html";
};

// ✅ Mở modal xác nhận đăng xuất
window.showModalLogout = function () {
  document.getElementById("modal-logout").style.display = "flex";
};

// ✅ Đóng modal xác nhận đăng xuất
window.closeModalLogout = function () {
  document.getElementById("modal-logout").style.display = "none";
};

// ✅ Gán hành vi nút 'Đăng xuất'
window.setupModalLogout = function () {
  const confirmBtn = document.getElementById("modal-logout-confirm");
  if (confirmBtn) {
    confirmBtn.onclick = function () {
      logout();
    };
  }
};

// =============================
// ✅ Khởi tạo sau khi DOM sẵn sàng (KHÔNG tự bật camera)
// =============================
window.addEventListener("DOMContentLoaded", () => {
  // ✅ 1. Cảnh báo Caps Lock cho input password
  const passwordInputs = document.querySelectorAll("input[type='password']");
  passwordInputs.forEach(input => {
    const warning = document.createElement("p");
    warning.style.color = "orange";
    warning.style.fontSize = "0.9em";
    warning.style.marginTop = "0.3rem";
    warning.textContent = "⚠️ Caps Lock đang bật!";
    warning.style.display = "none";
    input.insertAdjacentElement("afterend", warning);

    input.addEventListener("keydown", (e) => {
      warning.style.display = e.getModifierState("CapsLock") ? "block" : "none";
    });

    input.addEventListener("blur", () => {
      warning.style.display = "none";
    });
  });

  // ✅ 2. Reset ảnh preview nếu có nút (an toàn cho cả biometric và attendance)
  const resetBtn = document.getElementById("resetCaptureBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const video = document.getElementById("camera");
      const stream = video?.srcObject;
      if (stream) stream.getTracks().forEach(track => track.stop());

      ["front", "left", "right"].forEach(pos => {
        const img = document.getElementById(`preview_${pos}`);
        if (img) img.src = "";
      });

      window.motionImages = {};

      // ✅ Gọi lại camera nếu hàm có tồn tại
      if (typeof startMotionFaceCapture === "function") {
        startMotionFaceCapture("camera", "overlay");
      }
    });
  }
});

// =============================
// ✅ Hàm phân trang dùng chung
// =============================
/**
 * Hiển thị bảng phân trang
 * @param {Array} data - Dữ liệu đầy đủ (mảng object)
 * @param {Function} renderRowFn - Hàm nhận 1 object, trả về 1 phần tử <tr>
 * @param {HTMLElement} tableBody - Thẻ <tbody> để chèn dữ liệu
 * @param {HTMLElement} pagination - Thẻ để hiển thị thanh phân trang
 * @param {number} rowsPerPage - Số dòng mỗi trang (default 10)
 */
function renderPaginatedTable(data, renderRowFn, tableBody, pagination, rowsPerPage = 10) {
  let currentPage = 1;
  const totalPages = Math.ceil(data.length / rowsPerPage);

  function renderPage(page) {
    currentPage = page;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = data.slice(start, end);

    // Clear and render table body
    tableBody.innerHTML = "";
    pageData.forEach(item => {
      const row = renderRowFn(item);
      if (row) tableBody.appendChild(row);
    });

    // Clear pagination
    pagination.innerHTML = "";

    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Nút « Prev
    if (page > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.textContent = "«";
      prevBtn.classList.add("pagination-button"); 
      prevBtn.onclick = () => renderPage(page - 1);
      pagination.appendChild(prevBtn);
    }

    // Các nút số
    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.classList.add("pagination-button");
      btn.classList.toggle("active", i === page);
      btn.onclick = () => renderPage(i);
      pagination.appendChild(btn);
    }

    // Nút » Next
    if (page < totalPages) {
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "»";
      nextBtn.classList.add("pagination-button");
      nextBtn.onclick = () => renderPage(page + 1);
      pagination.appendChild(nextBtn);
    }
  }

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="100%">⚠ Không có dữ liệu để hiển thị.</td></tr>`;
    pagination.innerHTML = "";
    return;
  }

  renderPage(currentPage);
}

function getRandomColor() {
  const colors = ['#dbeafe'];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function loadNotifications(user_id, containerId = "notificationList") {
  try {
    const res = await fetch(`/notifications?user_id=${user_id}`);
    const data = await res.json();

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.success || !data.data.length) {
      container.innerHTML = `<p>🔕 Không có thông báo.</p>`;
      updateNotifBadge(0);
      return;
    }

    container.innerHTML = data.data.map(notif => `
      <li class="notif-item ${notif.is_read ? '' : 'unread'}"
          onclick="markNotificationRead(${notif.id})">
        <div class="notif-message">${notif.message}</div>
        <div class="notif-date">${formatDate(notif.created_at)}</div>
      </li>
    `).join("");

    // ✅ Tính số lượng chưa đọc
    const unreadCount = data.data.filter(n => !n.is_read).length;
    updateNotifBadge(unreadCount);
  } catch (err) {
    console.error("❌ Lỗi khi tải thông báo:", err);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `<p style="color:red;">❌ Không thể tải thông báo.</p>`;
    }
  }
}

function updateNotifBadge(count, badgeId = "notif-badge") {
  const badge = document.getElementById(badgeId);
  if (!badge) return;

  if (count > 0) {
    badge.textContent = `(${count})`;
    badge.style.display = "inline-block";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
}

async function getUnreadCount(user_id, badgeId = "notif-badge") {
  try {
    const res = await fetch(`/notifications?user_id=${user_id}`);
    const data = await res.json();
    if (!data.success) return;

    const unreadCount = data.data.filter(n => !n.is_read).length;
    updateNotifBadge(unreadCount, badgeId);
  } catch (err) {
    console.error("❌ Lỗi khi đếm thông báo:", err);
  }
}

async function markNotificationRead(id) {
  try {
    await fetch(`/notifications/${id}/read`, { method: "PUT" });

    // Xoá style "unread" cho UI
    const item = document.querySelector(`.notif-item[onclick*="${id}"]`);
    if (item) {
      item.classList.remove("unread");
    }

    // 🔁 Cập nhật lại badge
    const user = getCurrentUser();
    if (user) {
      const badgeId = user.role === "teacher" ? "teacherNotifBadge"
                    : user.role === "admin" ? "adminNotifBadge"
                    : "notif-badge";
      getUnreadCount(user.user_id, badgeId);
    }
  } catch (err) {
    console.error("❌ Không thể đánh dấu đã đọc:", err);
  }
}

function refreshNotifBadge() {
  const user = getCurrentUser();
  if (!user || !user.user_id || !user.role) return;

  let badgeId = "notif-badge";
  if (user.role === "teacher") badgeId = "teacherNotifBadge";
  else if (user.role === "admin") badgeId = "adminNotifBadge";

  getUnreadCount(user.user_id, badgeId);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  });
}