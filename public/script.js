// ─── DOM Elements ──────────────────────────────────
const urlInput    = document.getElementById("urlInput");
const fetchBtn    = document.getElementById("fetchBtn");
const preview     = document.getElementById("preview");
const previewThumb   = document.getElementById("previewThumb");
const previewTitle   = document.getElementById("previewTitle");
const previewChannel = document.getElementById("previewChannel");
const previewDuration = document.getElementById("previewDuration");
const btnFull     = document.getElementById("btnFull");
const btnSection  = document.getElementById("btnSection");
const modeSlider  = document.getElementById("modeSlider");
const timeRange   = document.getElementById("timeRange");
const downloadBtn = document.getElementById("downloadBtn");
const btnContent  = document.getElementById("btnContent");
const btnLoading  = document.getElementById("btnLoading");
const status      = document.getElementById("status");

let currentMode = "full";
let videoInfoLoaded = false;

// ─── Mode Toggle ───────────────────────────────────
btnFull.addEventListener("click", () => setMode("full"));
btnSection.addEventListener("click", () => setMode("section"));

function setMode(mode) {
  currentMode = mode;

  btnFull.classList.toggle("active", mode === "full");
  btnSection.classList.toggle("active", mode === "section");

  if (mode === "section") {
    modeSlider.classList.add("right");
    timeRange.style.display = "flex";
    timeRange.style.animation = "none";
    timeRange.offsetHeight; // trigger reflow
    timeRange.style.animation = "fadeUp 0.3s ease-out";
  } else {
    modeSlider.classList.remove("right");
    timeRange.style.display = "none";
  }
}

// ─── Time input formatting ─────────────────────────
// Pad numbers with leading zero when leaving focus
document.querySelectorAll('.time-split-group input').forEach(input => {
  input.addEventListener('blur', (e) => {
    let val = parseInt(e.target.value) || 0;
    let max = parseInt(e.target.getAttribute('max')) || 59;
    if (val > max) val = max;
    if (val < 0) val = 0;
    e.target.value = val.toString().padStart(2, "0");
  });
});

// ─── URL validation ────────────────────────────────
function isValidYTUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/.test(url);
}

urlInput.addEventListener("input", () => {
  downloadBtn.disabled = !isValidYTUrl(urlInput.value.trim());
  if (!isValidYTUrl(urlInput.value.trim())) {
    preview.style.display = "none";
    videoInfoLoaded = false;
  }
});

// ─── Fetch Video Info ──────────────────────────────
fetchBtn.addEventListener("click", fetchInfo);

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchInfo();
});

urlInput.addEventListener("paste", () => {
  setTimeout(fetchInfo, 100);
});

async function fetchInfo() {
  const url = urlInput.value.trim();
  if (!isValidYTUrl(url)) {
    showStatus("Please enter a valid YouTube URL.", "error");
    return;
  }

  fetchBtn.classList.add("loading");
  showStatus("Fetching video info...", "info");

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to fetch info");

    previewThumb.src = data.thumbnail;
    previewTitle.textContent = data.title;
    previewChannel.textContent = data.channel;
    previewDuration.textContent = data.duration;
    preview.style.display = "flex";
    videoInfoLoaded = true;
    downloadBtn.disabled = false;
    showStatus("", "");
  } catch (err) {
    showStatus(err.message, "error");
    preview.style.display = "none";
    videoInfoLoaded = false;
  } finally {
    fetchBtn.classList.remove("loading");
  }
}

// ─── Download ──────────────────────────────────────
downloadBtn.addEventListener("click", startDownload);

function getFormatTime(idPrefix) {
  const h = document.getElementById(idPrefix + 'H').value.padStart(2, '0');
  const m = document.getElementById(idPrefix + 'M').value.padStart(2, '0');
  const s = document.getElementById(idPrefix + 'S').value.padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const resetBtn    = document.getElementById("resetBtn");
const progressBox = document.getElementById("progressBox");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");

// ─── Download Again Reset ──────────────────────────
resetBtn.addEventListener("click", () => {
  urlInput.value = "";
  preview.style.display = "none";
  resetBtn.style.display = "none";
  downloadBtn.style.display = "block";
  downloadBtn.disabled = true;
  videoInfoLoaded = false;
  showStatus("", "");
});

async function startDownload() {
  const url = urlInput.value.trim();
  if (!url) return;

  const body = { url, mode: currentMode };

  if (currentMode === "section") {
    body.startTime = getFormatTime("start");
    body.endTime = getFormatTime("end");
  }

  // UI → start preparing
  downloadBtn.style.display = "none";
  progressBox.style.display = "block";
  progressFill.style.width = "0%";
  progressPercent.textContent = "0%";
  progressText.textContent = "Initializing...";
  showStatus("", "");

  try {
    const res = await fetch("/api/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Preparation failed");
    }

    const { id } = await res.json();
    
    // Connect to SSE for progress
    const evtSource = new EventSource(`/api/progress/${id}`);
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      progressFill.style.width = `${data.progress}%`;
      progressPercent.textContent = `${data.progress}%`;
      progressText.textContent = data.text;

      if (data.status === "error") {
        evtSource.close();
        progressBox.style.display = "none";
        downloadBtn.style.display = "block";
        showStatus(data.error || "Download failed", "error");
      }

      if (data.status === "done") {
        evtSource.close();
        progressBox.style.display = "none";
        resetBtn.style.display = "block";
        showStatus("✓ Download complete!", "success");
        
        // Trigger file download
        const a = document.createElement("a");
        a.href = `/api/file/${id}`;
        a.download = "clipgrab_video.mp4";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      progressBox.style.display = "none";
      downloadBtn.style.display = "block";
      showStatus("Connection to server lost.", "error");
    };

  } catch (err) {
    progressBox.style.display = "none";
    downloadBtn.style.display = "block";
    showStatus(err.message, "error");
  }
}

// ─── Status Helper ─────────────────────────────────
function showStatus(msg, type) {
  status.textContent = msg;
  status.className = "status" + (type ? " " + type : "");
}
