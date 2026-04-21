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

### Local Setup

```bash
git clone https://github.com/weallblamewasif/clipgrab.git
cd clipgrab
npm install
```
when you click Start_ClipGrab.bat in the clipgrab folder once its cloned in your system it will automatically open in your browser and ready to use

> **Note:** During `npm install`, the app will automatically download the correct `yt-dlp` and `ffmpeg` binaries for your OS. No external installations required! 🎉

### Docker

```bash
docker build -t clipgrab .
docker run -p 3000:3000 clipgrab
```

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Video Processing:** yt-dlp + FFmpeg
- **Font:** Inter (Google Fonts)


## 📝 API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/info` | `{ url }` | Fetch video title, thumbnail, duration |
| POST | `/api/download` | `{ url, mode, startTime?, endTime? }` | Download video as MP4 |

## 📄 License

MIT
