# 🎬 ClipGrab

A sleek, modern web app to download YouTube videos — full or clipped to a specific section.

![ClipGrab UI](https://img.shields.io/badge/Stack-Node.js%20%2B%20Express-green?style=flat-square) ![yt-dlp](https://img.shields.io/badge/Powered%20by-yt--dlp-red?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## ✨ Features

- 🎥 **Full Video Download** — grab the entire video as MP4
- ✂️ **Section Download** — clip a specific time range (start → end)
- 🔍 **Video Preview** — fetches title, thumbnail & duration before downloading
- 🌙 **Dark Glassmorphism UI** — animated backgrounds, smooth transitions
- 🐳 **Docker Ready** — deploy anywhere with one command

## 🖼️ Preview

| Full Video Mode | Section Mode |
|:-:|:-:|
| Paste URL → Download entire video | Set start/end times → Download clip |

## 🚀 Quick Start

### 🪄 The Easiest Way (Windows)

No installation required! Just double-click the **`Start_ClipGrab.bat`** file. 
It will automatically download a portable version of Node.js (if you don't have it), install all requirements, and open the app in your browser!

### 💻 Manual Setup (Mac / Linux / Windows)

**Prerequisite:** You must have [Node.js](https://nodejs.org/) installed before running these commands. If you get an `'npm' is not recognized` error, it means you need to install Node.js first.

```bash
git clone https://github.com/weallblamewasif/clipgrab.git
cd clipgrab
npm install
node server.js
```

Open **http://localhost:3000** in your browser.

> **Note:** During `npm install`, the app will automatically download the correct `yt-dlp` and `ffmpeg` binaries for your OS. No external installations required! 🎉

### 🐳 Docker

**Prerequisite:** You must have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running. If you get a `'docker' is not recognized` error, it means you need to install Docker first.

```bash
docker build -t clipgrab .
docker run -p 3000:3000 clipgrab
```

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Video Processing:** yt-dlp + FFmpeg
- **Font:** Inter (Google Fonts)

## 📁 Project Structure

```
clipgrab/
├── server.js          # Express API server
├── Dockerfile         # Docker deployment config
├── package.json
├── public/
│   ├── index.html     # Main page
│   ├── style.css      # Dark glassmorphism theme
│   └── script.js      # Frontend logic
└── temp/              # Temporary download files (auto-cleaned)
```

## 📝 API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/info` | `{ url }` | Fetch video title, thumbnail, duration |
| POST | `/api/download` | `{ url, mode, startTime?, endTime? }` | Download video as MP4 |

## 📄 License

MIT
