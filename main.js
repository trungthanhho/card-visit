// ====== CONFIG ======
const TY_STRINGS = [
  "Hi, I'm Ho Thanh Trung.",
  "Currently working at Tan Phu Vietnam JSC.",
  "I like to travel, play video games and watch movies.",
  "Socialist Republic of Vietnam",
  "Independence - Freedom - Happiness",
];
const TYPE_SPEED = 30; // ms/char
const DELETE_SPEED = 18; // ms/char khi xóa
const PAUSE_AFTER_TYPE = 900; // ms dừng sau khi gõ xong 1 câu
const PAUSE_AFTER_DELETE = 400; // ms dừng sau khi xóa xong

// ====== TYPEWRITER (loop + delete + pause) ======
function startTypewriter() {
  const el = document.getElementById("typewriter");
  if (!el) return;

  // Tôn trọng người dùng "prefers-reduced-motion"
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (media.matches) {
    el.textContent = TY_STRINGS.join(" ");
    return;
  }

  let idx = 0; // index câu
  let pos = 0; // vị trí ký tự
  let deleting = false;

  function tick() {
    const current = TY_STRINGS[idx];
    el.textContent = deleting
      ? current.slice(0, pos--)
      : current.slice(0, pos++);

    if (!deleting && pos === current.length + 1) {
      setTimeout(() => {
        deleting = true;
        tick();
      }, PAUSE_AFTER_TYPE);
      return;
    }
    if (deleting && pos < 0) {
      deleting = false;
      idx = (idx + 1) % TY_STRINGS.length;
      setTimeout(tick, PAUSE_AFTER_DELETE);
      return;
    }

    setTimeout(tick, deleting ? DELETE_SPEED : TYPE_SPEED);
  }
  tick();
}

// ====== QR POPUP (toggle + click outside + ESC + khóa scroll) ======
function toggleQR(force) {
  const popup = document.getElementById("qrPopup");
  if (!popup) return;
  const willOpen =
    typeof force === "boolean" ? force : popup.style.display !== "block";

  if (willOpen) {
    popup.style.display = "block"; // hoặc "flex" nếu bạn muốn center bằng flex
    document.body.style.overflow = "hidden";
  } else {
    popup.style.display = "none";
    document.body.style.overflow = "";
  }
}

// Đóng khi click ra ngoài nội dung
function setupQrDismiss() {
  const popup = document.getElementById("qrPopup");
  if (!popup) return;
  popup.addEventListener("click", (e) => {
    const content = popup.querySelector(".qr-content");
    if (!content || !content.contains(e.target)) toggleQR(false);
  });
  // Đóng bằng ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popup.style.display === "block") toggleQR(false);
  });
}

// ====== MUSIC (toggle play/pause + đổi icon + ripple) ======
function setupMusic() {
  const audio = document.getElementById("bgMusic");
  const btn = document.querySelector(".play-btn");
  const wrapper = document.querySelector(".music-wrapper");
  if (!audio || !btn || !wrapper) return;

  // Tương thích iOS: khởi tạo audio context khi có gesture
  const resumeAudioContext = () => {
    if (typeof AudioContext !== "undefined") {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    }
  };

  function toggleIcon() {
    btn.textContent = audio.paused ? "▶" : "⏸";
  }

  function addRipple(x, y) {
    const rect = btn.getBoundingClientRect();
    const span = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.8;
    span.style.position = "absolute";
    span.style.left = `${x - rect.left - size / 2}px`;
    span.style.top = `${y - rect.top - size / 2}px`;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.borderRadius = "50%";
    span.style.background = "rgba(255,255,255,0.5)";
    span.style.transform = "scale(0)";
    span.style.transition = "transform 0.45s ease, opacity 0.45s ease";
    span.style.pointerEvents = "none";
    btn.appendChild(span);
    requestAnimationFrame(() => {
      span.style.transform = "scale(1)";
      span.style.opacity = "0";
    });
    setTimeout(() => span.remove(), 500);
  }

  function playMusic(e) {
    resumeAudioContext();
    if (audio.paused) {
      audio.play().catch(() => {}); // tránh lỗi autoplay block
    } else {
      audio.pause();
    }
    toggleIcon();
    if (e) addRipple(e.clientX, e.clientY);
  }

  // Click lên wrapper hoặc nút đều phát nhạc
  wrapper.addEventListener("click", playMusic);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    playMusic(e);
  });

  // Khi audio kết thúc -> về biểu tượng play
  audio.addEventListener("ended", toggleIcon);
}

// ====== CLOCK ======
function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const now = new Date();
  const timeString = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  el.textContent = `🕒 ${timeString}`;
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  startTypewriter();
  setupQrDismiss();
  setupMusic();
  updateClock();
  setInterval(updateClock, 1000);
});

// (Giữ lại hàm toggleQR nếu bạn đã gọi trong HTML onclick)
window.toggleQR = toggleQR;
