// =============================
// ✅ Logic cho biometric.html (YOLO detect + pose check + chặn nhiều khuôn mặt)
// =============================
if (window.location.pathname.endsWith("biometric.html")) {
  const video = document.getElementById("camera");
  const canvas = document.getElementById("overlay");
  const faceMsg = document.getElementById("faceStepMsg");
  const resetBtn = document.getElementById("resetCaptureBtn");
  const submitBtn = document.getElementById("submitRegisterBtn");
  const urlParams = new URLSearchParams(window.location.search);
  const isUpdateMode = urlParams.get("mode") === "update";
  const endpoint = isUpdateMode ? "/update_face" : "/register";

  let motionImages = {};
  let currentStep = 0;
  let captureCooldown = 0;
  let readyFrames = 0;
  let currentPose = "unknown";
  let lastBox = null;
  let lastCheckTime = 0;

  const REQUIRED_FRAMES = 15;
  const steps = ["front", "left", "right"];
  const POSE_CHECK_INTERVAL = 75;

  async function initCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    });
  }

  function stopCamera() {
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
  }

  function resetFlow() {
    stopCamera();
    ["front", "left", "right"].forEach(pos => {
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
        const res = await fetch("/detect_face_box", { method: "POST", body: form });
        const result = await res.json();
        lastBox = result.success ? result.box : null;
      } catch (err) {
        console.error("❌ Lỗi detect box:", err);
        lastBox = null;
      }

      try {
        const poseRes = await fetch("/predict_pose", { method: "POST", body: form });
        const poseResult = await poseRes.json();

        if (!poseResult.success && poseResult.message?.includes("nhiều khuôn mặt")) {
          currentPose = "invalid";
          lastBox = null;
          readyFrames = 0;
          captureCooldown = 30;
          faceMsg.textContent = "🚨 Vui lòng chỉ để 1 người trong camera!";
          return;
        }

        currentPose = typeof poseResult.pose === "string" ? poseResult.pose : "unknown";
      } catch (err) {
        console.error("❌ Lỗi predict pose:", err);
        currentPose = "unknown";
      }
    }, 300);

    async function loop() {
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
      }

      const next = steps[currentStep];
      faceMsg.textContent = `Bước ${currentStep + 1}/3: ${next.toUpperCase()} ❌ (Hãy xoay mặt đúng hướng này để tiếp tục)`;

      if (captureCooldown > 0) captureCooldown--;
      requestAnimationFrame(loop);
    }

    loop();
  }

  if (resetBtn) resetBtn.addEventListener("click", resetFlow);
  if (submitBtn) submitBtn.disabled = true;

  const startBtn = document.getElementById("startCaptureBtn");
  if (startBtn) startBtn.addEventListener("click", startLoop);

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const msgEl = document.getElementById("biometric-message");

      if (!motionImages.front || !motionImages.left || !motionImages.right) {
        if (msgEl) {
          msgEl.textContent = "Vui lòng hoàn tất cả 3 ảnh trước khi gửi.";
          msgEl.style.color = "red";
        }
        return;
      }

      const currentUser = JSON.parse(sessionStorage.getItem("register_data") || "null");
      if (!currentUser) {
        if (msgEl) {
          msgEl.textContent = "❌ Không tìm thấy thông tin người dùng.";
          msgEl.style.color = "red";
        }
        return;
      }

      try {
        let res;
        if (isUpdateMode) {
          const formData = new FormData();
          formData.append("user_id", currentUser.user_id);
          formData.append("image_front", motionImages.front);
          formData.append("image_left", motionImages.left);
          formData.append("image_right", motionImages.right);

          res = await fetch("/update_face", {
            method: "POST",
            body: formData
          });
        } else {
          const payload = {
            user_id: currentUser.user_id,
            name: currentUser.name || currentUser.user_name || "Chưa rõ",
            password: currentUser.password,
            phone_number: currentUser.phone_number,
            email: currentUser.email,
            role: currentUser.role || "student",
            image_front: motionImages.front,
            image_left: motionImages.left,
            image_right: motionImages.right
          };

          res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        }

        const result = await res.json();
        if (res.ok) {
          if (msgEl) {
            msgEl.textContent = isUpdateMode
              ? "✅ Ảnh khuôn mặt đã được cập nhật, đang quay về trang chính..."
              : "✅ Đăng ký thành công, đang chuyển về trang chủ...";
            msgEl.style.color = "green";
          }
          setTimeout(() => {
            window.location.href = "student.html";
          }, 2000);
        } else {
          if (msgEl) {
            msgEl.textContent = result.detail || "❌ Gửi thất bại";
            msgEl.style.color = "red";
          }
        }
      } catch (error) {
        console.error("Lỗi gửi ảnh:", error);
        if (msgEl) {
          msgEl.textContent = "❌ Lỗi gửi ảnh";
          msgEl.style.color = "red";
        }
      }
    });
  }
}