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
const startTime   = document.getElementById("startTime");
const endTime     = document.getElementById("endTime");
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
    // Smooth entry
    timeRange.style.animation = "none";
    timeRange.offsetHeight; // trigger reflow
    timeRange.style.animation = "fadeUp 0.3s ease-out";
  } else {
    modeSlider.classList.remove("right");
    timeRange.style.display = "none";
  }
}

// ─── Time input formatting ─────────────────────────
function formatTimeInput(e) {
  let val = e.target.value.replace(/[^0-9:]/g, "");
  // Auto-insert colons
  const digits = val.replace(/:/g, "");
  if (digits.length >= 4) {
    val = digits.slice(0, 2) + ":" + digits.slice(2, 4) + ":" + digits.slice(4, 6);
  } else if (digits.length >= 2) {
    val = digits.slice(0, 2) + ":" + digits.slice(2);
  }
  e.target.value = val;
}

startTime.addEventListener("input", formatTimeInput);
endTime.addEventListener("input", formatTimeInput);

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

// Also try fetch on paste
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

async function startDownload() {
  const url = urlInput.value.trim();
  if (!url) return;

  const body = { url, mode: currentMode };

  if (currentMode === "section") {
    body.startTime = startTime.value.trim() || "00:00:00";
    body.endTime = endTime.value.trim() || "00:03:00";

    // Simple validation
    if (!/^\d{2}:\d{2}:\d{2}$/.test(body.startTime) || !/^\d{2}:\d{2}:\d{2}$/.test(body.endTime)) {
      showStatus("Please use HH:MM:SS format for times.", "error");
      return;
    }
  }

  // UI → loading state
  btnContent.style.display = "none";
  btnLoading.style.display = "flex";
  downloadBtn.disabled = true;
  showStatus("Downloading... this may take a minute.", "info");

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Download failed");
    }

    // Get the blob and trigger download
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    // filename from header or default
    const cd = res.headers.get("Content-Disposition");
    let filename = "clipgrab_video.mp4";
    if (cd) {
      const m = cd.match(/filename="?([^"]+)"?/);
      if (m) filename = m[1];
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    showStatus("✓ Download complete!", "success");
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    btnContent.style.display = "flex";
    btnLoading.style.display = "none";
    downloadBtn.disabled = false;
  }
}

// ─── Status Helper ─────────────────────────────────
function showStatus(msg, type) {
  status.textContent = msg;
  status.className = "status" + (type ? " " + type : "");
}
