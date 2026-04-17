const TY_STRINGS = [
  "Currently working at Tan Phu Vietnam Joint Stock Company.",
  "Travel, video games, movies and good conversations.",
  "Socialist Republic of Vietnam.",
  "Independence - Freedom - Happiness.",
];

const TYPE_SPEED = 34;
const DELETE_SPEED = 18;
const PAUSE_AFTER_TYPE = 1100;
const PAUSE_AFTER_DELETE = 420;

function startTypewriter() {
  const el = document.getElementById("typewriter");
  if (!el) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = TY_STRINGS[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const phrase = TY_STRINGS[phraseIndex];
    el.textContent = phrase.slice(0, charIndex);

    if (!deleting && charIndex < phrase.length) {
      charIndex += 1;
      setTimeout(tick, TYPE_SPEED);
      return;
    }

    if (!deleting) {
      deleting = true;
      setTimeout(tick, PAUSE_AFTER_TYPE);
      return;
    }

    if (charIndex > 0) {
      charIndex -= 1;
      setTimeout(tick, DELETE_SPEED);
      return;
    }

    deleting = false;
    phraseIndex = (phraseIndex + 1) % TY_STRINGS.length;
    setTimeout(tick, PAUSE_AFTER_DELETE);
  }

  tick();
}

function setupQrPopup() {
  const popup = document.getElementById("qrPopup");
  const openButton = document.getElementById("zaloButton");
  const closeButton = document.getElementById("closeQr");
  if (!popup || !openButton || !closeButton) return;

  function setOpen(isOpen) {
    popup.classList.toggle("is-open", isOpen);
    popup.setAttribute("aria-hidden", String(!isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  openButton.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));

  popup.addEventListener("click", (event) => {
    if (event.target === popup) setOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && popup.classList.contains("is-open")) {
      setOpen(false);
    }
  });
}

function setupBankPopup() {
  const popup = document.getElementById("bankPopup");
  const openButton = document.getElementById("bankQrButton");
  const closeButton = document.getElementById("closeBankQr");
  const copyButton = document.getElementById("copyBankHint");
  const status = document.getElementById("bankCopyStatus");
  if (!popup || !openButton || !closeButton || !copyButton || !status) return;

  function setOpen(isOpen) {
    popup.classList.toggle("is-open", isOpen);
    popup.setAttribute("aria-hidden", String(!isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  openButton.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));

  popup.addEventListener("click", (event) => {
    if (event.target === popup) setOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && popup.classList.contains("is-open")) {
      setOpen(false);
    }
  });

  copyButton.addEventListener("click", async () => {
    const text = "VietinBank\nSTK: 100883054915\nChu tai khoan: HO THANH TRUNG";
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "Đã copy thông tin chuyển khoản.";
    } catch {
      status.textContent = "Không copy được trên trình duyệt này.";
    }
  });
}

function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;

  const timeString = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  el.textContent = timeString;
}

function setupMusic() {
  const audio = document.getElementById("bgMusic");
  const button = document.getElementById("musicToggle");
  const icon = document.getElementById("musicIcon");
  const backButton = document.getElementById("musicBack");
  const nextButton = document.getElementById("musicNext");
  const progress = document.getElementById("musicProgress");
  if (!audio || !button || !icon || !backButton || !nextButton || !progress) return;

  function syncState() {
    const isPlaying = !audio.paused;
    icon.textContent = isPlaying ? "⏸" : "▶";
    button.setAttribute("aria-label", isPlaying ? "Tạm dừng nhạc" : "Phát nhạc");
  }

  function syncProgress() {
    const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progress.style.width = `${Math.min(percent, 100)}%`;
  }

  button.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    syncState();
  });

  backButton.addEventListener("click", () => {
    audio.currentTime = 0;
    syncProgress();
  });

  nextButton.addEventListener("click", () => {
    if (!audio.duration) return;
    audio.currentTime = Math.max(audio.duration - 8, 0);
    syncProgress();
  });

  audio.addEventListener("play", syncState);
  audio.addEventListener("pause", syncState);
  audio.addEventListener("timeupdate", syncProgress);
  audio.addEventListener("loadedmetadata", syncProgress);
  audio.addEventListener("ended", () => {
    syncState();
    syncProgress();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  startTypewriter();
  setupQrPopup();
  setupBankPopup();
  setupMusic();
  updateClock();
  setInterval(updateClock, 1000);
});
