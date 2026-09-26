// PWA ikonlarını assets/img/player.png karakterinden üretir.
// Kullanım: node tools/generate-icons.mjs  (Playwright Chromium gerekir)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "icons");
mkdirSync(outDir, { recursive: true });
const playerDataUrl = `data:image/png;base64,${readFileSync(join(root, "assets", "img", "player.png")).toString("base64")}`;

// maskable: karakter %80 güvenli alanın içinde kalır, köşeler kırpılabilir.
const icons = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon-180.png", size: 180, maskable: true },
  { file: "favicon-32.png", size: 32, maskable: false }
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<canvas id='c'></canvas>");

for (const icon of icons) {
  const dataUrl = await page.evaluate(async ({ size, maskable, playerDataUrl }) => {
    const img = new Image();
    img.src = playerDataUrl;
    await img.decode();
    const c = document.getElementById("c");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const s = size / 512;
    ctx.clearRect(0, 0, size, size);

    // Arka plan: maskable için tam kare, normal ikon için yuvarlatılmış kare.
    ctx.save();
    if (!maskable) {
      const r = 112 * s;
      ctx.beginPath();
      ctx.roundRect(8 * s, 8 * s, size - 16 * s, size - 16 * s, r);
      ctx.clip();
    }
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, "#58c4ff");
    bg.addColorStop(0.62, "#bff0ff");
    bg.addColorStop(0.63, "#7fd765");
    bg.addColorStop(1, "#46a84a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Güneş
    ctx.fillStyle = "#fff09a";
    ctx.beginPath();
    ctx.arc(128 * s, 128 * s, 58 * s, 0, Math.PI * 2);
    ctx.fill();

    if (size >= 64) {
      // Matematik sembolleri
      const syms = [
        ["+", 392, 116, "#ff5d73"],
        ["×", 424, 214, "#7e66ff"],
        ["−", 96, 250, "#ff9f1c"]
      ];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [ch, x, y, color] of syms) {
        ctx.font = `900 ${86 * s}px ui-rounded, system-ui, sans-serif`;
        ctx.lineWidth = 12 * s;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(ch, x * s, y * s);
        ctx.fillStyle = color;
        ctx.fillText(ch, x * s, y * s);
      }
    }

    // Karakter
    const scale = maskable ? 0.66 : size < 64 ? 0.86 : 0.74;
    const h = size * scale;
    const w = h * (img.naturalWidth / img.naturalHeight);
    const x = (size - w) / 2;
    const y = maskable ? size * 0.2 : size * (size < 64 ? 0.1 : 0.2);
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return c.toDataURL("image/png");
  }, { ...icon, playerDataUrl });
  writeFileSync(join(outDir, icon.file), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("yazıldı:", icon.file);
}

await browser.close();
