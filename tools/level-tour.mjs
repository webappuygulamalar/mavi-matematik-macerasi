// Dört seviyenin baştan boss'a kadar görünümünü çıkarır (göz kontrolü için; piksel testi değildir).
// Kullanım: node tools/level-tour.mjs <çıktı-klasörü>
// Çıktı .gitignore'daki visual-snapshots/ altında tutulur.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, process.argv[2] || "visual-snapshots/levels-latest");
mkdirSync(outDir, { recursive: true });
const PORT = 8132;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${PORT}/?nosw=1&autostart=1`;
const STOPS = [90, 1500, 3000, 4500, 5900];

const browser = await chromium.launch();
try {
  for (const profile of [
    { name: "masaustu", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, stops: STOPS },
    { name: "telefon", viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, stops: [90, 3000] }
  ]) {
    const { name, stops, ...opts } = profile;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    for (const level of [1, 2, 3, 4]) {
      await page.goto(`${base}&level=${level}`);
      await page.waitForFunction(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.state.started);
      // Eski kod ?level= parametresini yalnızca boss ile tanır: tema için seviyeyi elle ayarla
      await page.evaluate((lv) => {
        const g = window.__MAVI_GAME__;
        if (g.state.level !== lv) g.state.level = lv;
      }, level);
      for (const x of stops) {
        await page.evaluate((px) => {
          const g = window.__MAVI_GAME__;
          g.player.invuln = 0;
          // Bu x'teki en yüksek zemin yüzeyine yerleştir (çukur üstüne düşmesin)
          let best = null;
          for (const p of g.platforms) {
            if (px + 23 >= p.x && px + 23 <= p.x + p.w && (best === null || p.y > best.y)) best = p;
          }
          if (!best) best = g.platforms[0];
          g.player.x = Math.max(best.x + 4, Math.min(best.x + best.w - 50, px));
          g.player.y = best.y - g.player.h;
          g.player.vx = 0;
          g.player.vy = 0;
          const vw = g.view ? g.view.w : 1280;
          g.state.cameraX = Math.max(0, Math.min(7500 - vw, g.player.x - vw * 0.42));
        }, x);
        await page.waitForTimeout(450);
        await page.screenshot({ path: join(outDir, `${name}-seviye${level}-x${String(x).padStart(4, "0")}.png`) });
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Seviye turu: ${outDir}`);
