// One-off generator for the PWA's home-screen icons. Run with:
//   node scripts/generate-pwa-icons.js
// Produces public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
// (iOS specifically wants a PNG apple-touch-icon, not an SVG, for Add to Home Screen).
const sharp = require("sharp");
const path = require("path");

const BRAND = "#4F46E5"; // same indigo used for the "P" badge on the login screen

function svgFor(size, radius) {
  const fontSize = Math.round(size * 0.52);
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
      <text x="50%" y="54%" font-family="Arial, Helvetica, sans-serif" font-weight="700"
            font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">P</text>
    </svg>`;
}

async function main() {
  const outDir = path.join(__dirname, "..", "public");
  const targets = [
    { size: 192, radius: 40, file: "icon-192.png" },
    { size: 512, radius: 100, file: "icon-512.png" },
    { size: 180, radius: 40, file: "apple-touch-icon.png" }, // iOS ignores rx itself but keep consistent
  ];
  for (const t of targets) {
    await sharp(Buffer.from(svgFor(t.size, t.radius)))
      .png()
      .toFile(path.join(outDir, t.file));
    console.log(`wrote ${t.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
