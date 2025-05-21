// =============================
// ✅ Logic cho attendance.html (Đã tối ưu hiệu suất)
// =============================

if (window.location.pathname.endsWith("attendance.html")) {
  const video = document.getElementById("camera");
  const canvas = document.getElementById("overlay");
  const faceMsg = document.getElementById("faceStepMsg");
  const previewFront = document.getElementById("preview_front");
  const previewLeft = document.getElementById("preview_left");
  const previewRight = document.getElementById("preview_right");
  const resetBtn = document.getElementById("resetCaptureBtn");
  const submitBtn = document.getElementById("submitRegisterBtn");
  const startBtn = document.getElementById("startCaptureBtn");

  let motionImages = {};
  let currentStep = 0;
  let captureCooldown = 0;
  let readyFrames = 0;
  let currentPose = "unknown";
  let lastBox = null;
  let lastCheckTime = 0;

  const REQUIRED_FRAMES = 15;
  const POSE_CHECK_INTERVAL = 75;
  const steps = ["front", "left", "right"];

  window.onload = async function () {
    const sessionSelect = document.getElementById("session_id");
    const { user_id } = getCurrentUser();
    const res = await fetch(`/get_available_sessions?user_id=${user_id}`);
    const result = await res.json();

    if (result.success && Array.isArray(result.data)) {
      result.data.forEach((s) => {
        const option = document.createElement("option");
        option.value = s.session_id;
        
        const formatTime = iso => {
          const date = new Date(iso);
          return date.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).replace(",", "");
        };

        option.textContent = `Mã lớp: ${s.class_id} | Phiên: ${formatTime(s.start_time)} - ${formatTime(s.end_time)}`;
        sessionSelect.appendChild(option);
      });
    } else {
      const msg = document.getElementById("msg");
      msg.textContent = result.message || "Không có phiên khả dụng.";
      msg.style.color = "crimson";
    }
  };

  async function initCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = 320;
        canvas.height = 240;
        resolve();
      };
    });
  }

  function stopCamera() {
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  function resetFlow() {
    stopCamera();
    ["front", "left", "right"].forEach((pos) => {
      const img = document.getElementById(`preview_${pos}`);
      if (img) img.src = "";
    });
    motionImages = {};
    currentStep = 0;
    readyFrames = 0;
    captureCooldown = 0;
    lastCheckTime = 0;
    startLoop();
  }

  async function startLoop() {
    await initCamera();
    const ctx = canvas.getContext("2d");

    setInterval(async () => {
      const dataUrl = canvas.toDataURL("image/jpeg");
      const form = new FormData();
      form.append("image_base64", dataUrl);

      try {
        const res = await fetch("/detect_face_box", {
          method: "POST",
          body: form,
        });
        const result = await res.json();
        lastBox = result.success ? result.box : null;
      } catch (err) {
        console.error("❌ Lỗi detect box:", err);
        lastBox = null;
      }

      try {
        const poseRes = await fetch("/predict_pose", {
          method: "POST",
          body: form,
        });
        
        const poseResult = await poseRes.json();

        console.log("📤 poseResult =", poseResult);

        if (!poseResult.success) {
          const msg = poseResult.message || "❌ Lỗi xác định góc mặt.";
          faceMsg.textContent = msg;

          if (msg.includes("nhiều khuôn mặt")) {
            currentPose = "invalid";
            lastBox = null;
            readyFrames = 0;
            captureCooldown = 30;
            return;
          }

          currentPose = "unknown";
          return;
        }

      currentPose = (typeof poseResult.pose === "string") ? poseResult.pose : "unknown";

      } catch (err) {
        console.error("❌ Lỗi predict pose:", err);
        currentPose = "unknown";
      }
    }, 300);

    const loop = async () => {

      if (captureCooldown > 0) {
        captureCooldown--;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(loop);
        return;
      }
      
      if (currentPose === "invalid") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (lastBox) {
        ctx.strokeStyle = "lime";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          lastBox.x1,
          lastBox.y1,
          lastBox.x2 - lastBox.x1,
          lastBox.y2 - lastBox.y1
        );
      }

      const expected = steps[currentStep];
      const now = Date.now();

      if (currentPose === expected && now - lastCheckTime >= POSE_CHECK_INTERVAL) {
        readyFrames++;
        lastCheckTime = now;
        faceMsg.textContent = `Bước ${currentStep + 1}/3: ${expected.toUpperCase()} ✅ (${readyFrames}/${REQUIRED_FRAMES})`;
      } else if (currentPose !== expected) {
        readyFrames = 0;
        faceMsg.textContent = `Bước ${currentStep + 1}/3: ${expected.toUpperCase()} ❌ (Góc hiện tại: ${currentPose})`;
      }

      if (readyFrames >= REQUIRED_FRAMES && captureCooldown === 0) {
        const dataUrl = canvas.toDataURL("image/jpeg");
        motionImages[expected] = dataUrl;

        const imgEl = document.getElementById(`preview_${expected}`);
        if (imgEl) imgEl.src = dataUrl;

        currentStep++;
        captureCooldown = 60;
        readyFrames = 0;

        if (currentStep >= steps.length) {
          faceMsg.textContent = "✅ Đã hoàn tất chụp 3 góc!";
          stopCamera();
          submitBtn.disabled = false;
          return;
        }

        const next = steps[currentStep];
        faceMsg.textContent = `Bước ${currentStep + 1}/3: ${next.toUpperCase()} ❌ (Hãy xoay mặt đúng hướng này để tiếp tục)`;
      }
      if (captureCooldown > 0) captureCooldown--;
      requestAnimationFrame(loop);
    };

    video.addEventListener("playing", loop, { once: true });
  }

  if (resetBtn) resetBtn.addEventListener("click", resetFlow);
  if (startBtn) startBtn.addEventListener("click", startLoop);
  if (submitBtn) submitBtn.disabled = true;

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const { user_id } = getCurrentUser();
      const session_id = document.getElementById("session_id").value;
      const msg = document.getElementById("msg");

      if (!motionImages.front || !motionImages.left || !motionImages.right) {
        msg.textContent = "⚠️ Bạn chưa hoàn tất quét khuôn mặt 3 hướng!";
        msg.style.color = "crimson";
        return;
      }

      const formData = new FormData();
      formData.append("user_id", user_id);
      formData.append("session_id", session_id);
      formData.append("image_front", motionImages.front);
      formData.append("image_left", motionImages.left);
      formData.append("image_right", motionImages.right);

      try {
        const res = await fetch("/attendance", {
          method: "POST",
          body: formData,
        });
        const result = await res.json();
        msg.textContent = result.message || "✅ Gửi điểm danh thành công!";
        msg.style.color = result.success ? "#16a34a" : "crimson";

        if (result.success) {
          msg.textContent += " Đang chuyển hướng...";
          setTimeout(() => {
            window.location.href = "/student.html";
          }, 2000);
        }
      } catch (err) {
        msg.textContent = "❌ Lỗi kết nối khi gửi điểm danh.";
        msg.style.color = "crimson";
        console.error(err);
      }
    });
  }
}