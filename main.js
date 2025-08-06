const text =
  "Hi, I'm Ho Thanh Trung, currently working at Tan Phu Vietnam JSC. I like to travel, play video games and watch movies.";
const speed = 30; // tốc độ gõ (ms)

let i = 0;
function typeWriter() {
  if (i < text.length) {
    document.getElementById("typewriter").innerHTML += text.charAt(i);
    i++;
    setTimeout(typeWriter, speed);
  }
}

window.onload = typeWriter;
function toggleQR() {
  const popup = document.getElementById("qrPopup");
  popup.style.display = popup.style.display === "block" ? "none" : "block";
}

function playMusic() {
  const audio = document.getElementById("bgMusic");
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  document.getElementById("clock").textContent = `🕒 ${timeString}`;
}

// Gọi mỗi giây
setInterval(updateClock, 1000);
updateClock(); // Gọi ngay khi trang load
