const sharp = require('sharp');
const path = require('path');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function generateIcon() {
  const size = 512;

  // Modern gradient icon with "ERP" letters
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a73e8"/>
      <stop offset="50%" style="stop-color:#1557b0"/>
      <stop offset="100%" style="stop-color:#0d47a1"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4fc3f7"/>
      <stop offset="100%" style="stop-color:#29b6f6"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.25)"/>
      <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>

  <!-- Rounded square background -->
  <rect x="20" y="20" width="472" height="472" rx="96" ry="96" fill="url(#bg)"/>

  <!-- Subtle top shine -->
  <rect x="20" y="20" width="472" height="236" rx="96" ry="96" fill="url(#shine)" opacity="0.5"/>

  <!-- Building/chart abstract shape (represents construction + data) -->
  <g transform="translate(256, 256)" filter="url(#shadow)">
    <!-- Left bar -->
    <rect x="-140" y="-20" width="48" height="140" rx="8" fill="url(#accent)" opacity="0.7"/>
    <!-- Middle bar (tallest) -->
    <rect x="-56" y="-80" width="48" height="200" rx="8" fill="url(#accent)" opacity="0.85"/>
    <!-- Right bar -->
    <rect x="28" y="-50" width="48" height="170" rx="8" fill="url(#accent)" opacity="0.7"/>
    <!-- Top right bar -->
    <rect x="112" y="-10" width="48" height="130" rx="8" fill="url(#accent)" opacity="0.55"/>
  </g>

  <!-- "ERP" text overlay -->
  <text x="256" y="200" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="120" fill="white" letter-spacing="-4" opacity="0.95">ERP</text>

  <!-- Underline accent -->
  <rect x="130" y="220" width="252" height="6" rx="3" fill="url(#accent)" opacity="0.9"/>

  <!-- Small tagline area -->
  <text x="256" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="42" fill="rgba(255,255,255,0.85)" letter-spacing="8">MANAGER</text>
</svg>`;

  const pngPath = path.join(__dirname, '..', 'build', 'icon.png');
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const png256Path = path.join(__dirname, '..', 'build', 'icon256.png');

  // Generate 512px PNG
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(pngPath);
  console.log('Generated icon.png (512x512)');

  // Generate 256px PNG for ICO
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(png256Path);
  console.log('Generated icon256.png (256x256)');

  // Generate ICO from PNG
  const pngBuf = fs.readFileSync(png256Path);
  const icoBuf = await pngToIco.default([pngBuf]);
  fs.writeFileSync(icoPath, icoBuf);
  console.log('Generated icon.ico');

  // Cleanup
  fs.unlinkSync(png256Path);
  console.log('Done!');
}

generateIcon().catch(console.error);
