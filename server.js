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

// ─── Download video ─────────────────────────────────────────────────
app.post("/api/download", (req, res) => {
  const { url, mode, startTime, endTime } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const fileId = uuidv4();
  const outputTemplate = path.join(TEMP_DIR, `${fileId}.%(ext)s`);

  // Build yt-dlp args
  const args = [];

  if (mode === "section" && startTime && endTime) {
    args.push("--download-sections", `*${startTime}-${endTime}`);
    args.push("--force-keyframes-at-cuts");
    args.push("--postprocessor-args", "ffmpeg:-vf setpts=PTS-STARTPTS -af asetpts=PTS-STARTPTS");
  }

  args.push(
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/mp4",
    "--merge-output-format", "mp4",
    "--recode-video", "mp4",
    "--no-playlist",
    "--no-warnings",
    "-o", outputTemplate,
    url
  );

  console.log(`\n⬇  Starting download [${mode}]`);
  console.log(`   Command: yt-dlp ${args.join(" ")}\n`);

  const envPath = isWindows ? FFMPEG_DIR + ";" + process.env.PATH : process.env.PATH;

  const child = spawn(YT_DLP, args, {
    env: { ...process.env, PATH: envPath },
  });

  let stderrData = "";

  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => {
    stderrData += d.toString();
    process.stderr.write(d);
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error("yt-dlp exited with code", code);
      return res.status(500).json({ error: "Download failed. " + (stderrData || "") });
    }

    // Find the output file
    const files = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(fileId));
    if (files.length === 0) {
      return res.status(500).json({ error: "No output file found." });
    }

    const filePath = path.join(TEMP_DIR, files[0]);

    // Stream the file back
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="clipgrab_video.mp4"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("end", () => {
      try { fs.unlinkSync(filePath); } catch (_) {}
    });
    stream.on("error", (e) => {
      console.error("Stream error:", e);
      res.status(500).end();
    });
  });

  child.on("error", (err) => {
    console.error("Spawn error:", err);
    res.status(500).json({ error: "Failed to start yt-dlp." });
  });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 ClipGrab is running at http://localhost:${PORT}\n`);
});
