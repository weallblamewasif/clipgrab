const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const binDir = path.join(__dirname, 'bin');

if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

const platform = os.platform();
let filename = 'yt-dlp';
let downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';

if (platform === 'win32') {
    filename += '.exe';
    downloadUrl += 'yt-dlp.exe';
} else if (platform === 'darwin') {
    downloadUrl += 'yt-dlp_macos';
} else {
    downloadUrl += 'yt-dlp';
}

const destPath = path.join(binDir, filename);

console.log(`\n⬇️  Downloading latest yt-dlp binary for your system...`);

function downloadFile(url, destPath) {
    https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
            return downloadFile(response.headers.location, destPath);
        }
        
        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        
        file.on('finish', () => {
            file.close();
            if (platform !== 'win32') fs.chmodSync(destPath, '755');
            console.log(`✅ yt-dlp downloaded successfully to ./bin/${filename}\n`);
        });
    }).on('error', (err) => {
        fs.unlinkSync(destPath);
        console.error('❌ Error downloading yt-dlp:', err.message);
    });
}

downloadFile(downloadUrl, destPath);
