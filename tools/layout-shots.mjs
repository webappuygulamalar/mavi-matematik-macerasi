// Farklı ekran oranlarında oyun alanının ekranı nasıl doldurduğunu ölçer ve ekran görüntüsü alır.
// Kullanım: node tools/layout-shots.mjs <çıktı-klasörü>
// Çıktı .gitignore'daki visual-snapshots/ altında tutulur.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, process.argv[2] || "visual-snapshots/layout-latest");
mkdirSync(outDir, { recursive: true });
const PORT = 8133;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${PORT}/?nosw=1&autostart=1`;

const sizes = [
  { name: "telefon-844x390", viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, touch: true },
  { name: "android-915x412", viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, touch: true },
  { name: "iphone-ekran-2556x1179", viewport: { width: 2556, height: 1179 }, deviceScaleFactor: 1, touch: true },
  { name: "iphone-852x393-centik", viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, touch: true, notch: true },
  { name: "1280x720", viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  { name: "tablet-1024x768", viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, touch: true },
  { name: "masaustu-1440x900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
];

const browser = await chromium.launch();
const report = [];
try {
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.deviceScaleFactor, hasTouch: Boolean(s.touch), isMobile: Boolean(s.touch) });
    const page = await ctx.newPage();
    if (s.notch) {
      // Chromium env(safe-area-inset-*) emülasyonu yok: yatay iPhone değerleri CSS değişkenleriyle verilir
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = ":root{--safe-l:59px;--safe-r:59px;--safe-b:21px;--safe-t:0px}";
          document.head.appendChild(st);
        });
      });
    }
    for (const [scene, q] of [["seviye1", "&level=1"], ["boss", "&boss=1&level=2"]]) {
      await page.goto(`${base}${q}`);
      await page.waitForFunction(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.state.started);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(outDir, `${s.name}-${scene}.png`) });
    }
    const m = await page.evaluate(() => {
      const shell = document.getElementById("gameShell").getBoundingClientRect();
      const canvas = document.getElementById("game").getBoundingClientRect();
      const g = window.__MAVI_GAME__;
      const view = g.view || { w: 1280, h: 720 };
      return {
        solBosluk: Math.round(canvas.left),
        sagBosluk: Math.round(innerWidth - canvas.right),
        ustBosluk: Math.round(canvas.top),
        altBosluk: Math.round(innerHeight - canvas.bottom),
        canvasCss: `${Math.round(canvas.width)}x${Math.round(canvas.height)}`,
        mantiksal: `${view.w}x${view.h}`,
        olcekX: +(canvas.width / view.w).toFixed(4),
        olcekY: +(canvas.height / view.h).toFixed(4),
        shell: `${Math.round(shell.width)}x${Math.round(shell.height)}`
      };
    });
    report.push({ boyut: s.name, ...m });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.table(report);
