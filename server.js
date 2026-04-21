const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { execFile, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Self-contained paths ───────────────────────────────────────────
const isWindows = os.platform() === "win32";
const YT_DLP = path.join(__dirname, "bin", isWindows ? "yt-dlp.exe" : "yt-dlp");
const FFMPEG_DIR = path.dirname(ffmpegPath);

const TEMP_DIR = path.join(__dirname, "temp");

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Fetch video info ───────────────────────────────────────────────
app.post("/api/info", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const envPath = isWindows ? FFMPEG_DIR + ";" + process.env.PATH : process.env.PATH;

  execFile(
    YT_DLP,
    ["--dump-json", "--no-warnings", "--no-playlist", url],
    { timeout: 30000, env: { ...process.env, PATH: envPath } },
    (err, stdout, stderr) => {
      if (err) {
        console.error("Info error:", stderr || err.message);
        return res.status(500).json({ error: "Failed to fetch video info. Check the URL." });
      }
      try {
        const info = JSON.parse(stdout);
        res.json({
          title: info.title || "Unknown",
          thumbnail: info.thumbnail || "",
          duration: info.duration_string || "0:00",
          channel: info.channel || info.uploader || "Unknown",
        });
      } catch (e) {
        res.status(500).json({ error: "Failed to parse video info." });
      }
    }
  );
});

// ─── Download Management ──────────────────────────────────────────────
const downloads = {};

app.post("/api/prepare", (req, res) => {
  const { url, mode, startTime, endTime } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const id = uuidv4();
  
  // Calculate duration for section mode to track ffmpeg percentage
  let duration = 0;
  if (mode === "section" && startTime && endTime) {
    const sPts = startTime.split(':').reduce((acc, time) => (60 * acc) + +time);
    const ePts = endTime.split(':').reduce((acc, time) => (60 * acc) + +time);
    duration = ePts - sPts;
  }

  downloads[id] = { status: "starting", progress: 0, text: "Initializing...", file: null, error: null, duration };

  const outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);
  const args = [];

  if (mode === "section" && startTime && endTime) {
    args.push("--download-sections", `*${startTime}-${endTime}`);
    args.push("--force-keyframes-at-cuts");
    args.push("--postprocessor-args", "ffmpeg:-vf setpts=PTS-STARTPTS -af asetpts=PTS-STARTPTS");
  }

  // -N 4 uses 4 concurrent connections to significantly speed up downloading!
  args.push("-N", "4", "-f", "bv*[ext=mp4]+ba[ext=m4a]/mp4", "--merge-output-format", "mp4", "--recode-video", "mp4", "--no-playlist", "--no-warnings", "--no-colors", "--newline", "-o", outputTemplate, url);

  const envPath = isWindows ? FFMPEG_DIR + ";" + process.env.PATH : process.env.PATH;
  const child = spawn(YT_DLP, args, { env: { ...process.env, PATH: envPath } });

  // Helper to parse line string
  const parseLine = (dataStr) => {
    // 1. Check for standard yt-dlp percent
    const ytMatch = dataStr.match(/([\d\.]+)%/);
    if (ytMatch && !dataStr.includes("time=")) {
      const p = parseFloat(ytMatch[1]);
      downloads[id].progress = p;
      if (dataStr.includes("Destination") && dataStr.includes(".m4a")) {
        downloads[id].text = `Downloading Audio: ${p}%`;
      } else if (dataStr.includes("Destination") && dataStr.includes(".mp4")) {
        downloads[id].text = `Downloading Video: ${p}%`;
      } else if (downloads[id].text === "Initializing...") {
        downloads[id].text = `Downloading Stream: ${p}%`;
      } else {
        downloads[id].text = downloads[id].text.replace(/[\d\.]+%\s*$/g, '') + ` ${p}%`;
      }
      return;
    }

    // 2. Check for ffmpeg Section Clipping progress
    if (downloads[id].duration > 0) {
      const ffmpegMatch = dataStr.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (ffmpegMatch) {
        const h = parseInt(ffmpegMatch[1]);
        const m = parseInt(ffmpegMatch[2]);
        const s = parseFloat(ffmpegMatch[3]);
        const totalSecs = (h * 3600) + (m * 60) + s;
        
        const p = Math.min(100, Math.floor((totalSecs / downloads[id].duration) * 100));
        downloads[id].progress = p;
        downloads[id].text = `Clipping Section: ${p}%`;
        return;
      }
    }

    // 3. Fallbacks
    if (dataStr.includes("Destination")) {
      downloads[id].text = "Connecting to media stream...";
    } else if (dataStr.includes("Merger")) {
      downloads[id].text = "Merging video and audio... (Processing)";
    }
  };

  child.stdout.on("data", (data) => {
    const output = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
    parseLine(output);
  });

  let stderrData = "";
  child.stderr.on("data", (data) => { 
    const output = data.toString().replace(/\x1b\[[0-9;]*m/g, '');
    stderrData += output; 
    parseLine(output); // ffmpeg pushes natively to stderr!
  });

  child.on("close", (code) => {
    if (code !== 0) {
      downloads[id].status = "error";
      downloads[id].error = stderrData || "Unknown error occurred";
      return;
    }

    const files = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(id));
    if (files.length > 0) {
      downloads[id].file = path.join(TEMP_DIR, files[0]);
      downloads[id].status = "done";
      downloads[id].progress = 100;
      downloads[id].text = "Complete!";
    } else {
      downloads[id].status = "error";
      downloads[id].error = "Output file not found";
    }
  });

  res.json({ id });
});

app.get("/api/progress/:id", (req, res) => {
  const id = req.params.id;
  if (!downloads[id]) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    if (!downloads[id]) return clearInterval(interval);
    
    res.write(`data: ${JSON.stringify(downloads[id])}\n\n`);
    
    if (downloads[id].status === "done" || downloads[id].status === "error") {
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on("close", () => clearInterval(interval));
});

app.get("/api/file/:id", (req, res) => {
  const id = req.params.id;
  if (!downloads[id] || !downloads[id].file) return res.status(404).send("File not found");

  const filePath = downloads[id].file;
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="clipgrab_video.mp4"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on("end", () => {
    try { fs.unlinkSync(filePath); } catch (_) {}
    delete downloads[id]; // Cleanup
  });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 ClipGrab is running at http://localhost:${PORT}\n`);
  
  // Automatically open the user's browser to the correct page
  const startCmd = isWindows ? "start" : (os.platform() === 'darwin' ? "open" : "xdg-open");
  require('child_process').exec(`${startCmd} http://localhost:${PORT}`);
});
