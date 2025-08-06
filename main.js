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
