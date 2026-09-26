// Sprint 3C.2: başlangıç noktası (LEVEL_DATA.start) joystick'in arkasında kalmaz, hiçbir şeyle çakışmaz
// ve bütün akışlarda (yeniden başlat, devam et, çukur sonrası) aynı noktaya dönülür.
import { test as base, expect } from "@playwright/test";

const test = base.extend({
  consoleErrors: async ({ page }, use) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await use(errors);
    expect(errors, "konsolda hata olmamalı").toEqual([]);
  }
});

const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== "masaustu-1440x900", "Kendi ekran boyutlarını açar veya veri testi; tek projede yeterli");
const game = (page, fn, arg) => page.evaluate(fn, arg);
const NOTCH = { l: 59, r: 59, t: 0, b: 21 };
const MIN_GAP = 12;

// Oyuncunun ekranda görünen sprite dikdörtgeni (CSS px). Boşta nefes alırken en geniş an (sx 1.006) alınır.
function spriteRectInPage() {
  const g = window.__MAVI_GAME__;
  const c = document.getElementById("game").getBoundingClientRect();
  const k = c.width / g.view.w;
  const v = g.visual.playerVisualState();
  const breathe = 1.006 / v.sx;
  const left = v.footX - (v.footX - v.spriteLeft) * breathe;
  const right = v.footX + (v.spriteRight - v.footX) * breathe;
  const top = v.footY - v.frame.ay * v.scale * 1.012;
  return {
    x: c.left + (left - g.state.cameraX) * k,
    y: c.top + top * k,
    width: (right - left) * k,
    height: (v.spriteBottom - top) * k,
    cameraX: g.state.cameraX
  };
}

test.describe("Başlangıç noktası görünür", () => {
  for (const [w, h, dpr, notch, label] of [
    [844, 390, 3, false, "844x390"],
    [915, 412, 2.625, false, "915x412"],
    [852, 393, 3, true, "852x393 çentikli"],
    [2556, 1179, 1, false, "2556x1179"]
  ]) {
    test(`${label}: Mavi'nin görünen sprite'ı joystick tabanıyla örtüşmez (en az ${MIN_GAP} px)`, async ({ browser }, testInfo) => {
      desktopOnly(testInfo);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (notch) {
        await page.addInitScript((n) => {
          document.addEventListener("DOMContentLoaded", () => {
            const st = document.createElement("style");
            st.textContent = `:root{--safe-l:${n.l}px;--safe-r:${n.r}px;--safe-t:${n.t}px;--safe-b:${n.b}px}`;
            document.head.appendChild(st);
          });
        }, NOTCH);
      }
      // Gerçek akış: başlangıç ekranı → Yeni Macera → tanıtım
      await page.goto(new URL("./?nosw=1", testInfo.project.use.baseURL).href);
      await page.locator("#startButton").tap();
      await page.locator("#levelIntro").tap();
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
      const sprite = await game(page, spriteRectInPage);
      const stick = await page.locator(".joystick-base").boundingBox();
      const jump = await page.locator('[data-action="jump"]').boundingBox();
      const hud = await page.locator(".hud").boundingBox();
      expect(sprite.cameraX).toBe(0);
      const gap = sprite.x - (stick.x + stick.width);
      expect(gap, `sprite ile joystick arası ${gap.toFixed(1)} px`).toBeGreaterThanOrEqual(MIN_GAP);
      // Tamamen görünür: ekran içinde, HUD ve zıplama düğmesiyle çakışmaz
      expect(sprite.x).toBeGreaterThanOrEqual(0);
      expect(sprite.y).toBeGreaterThanOrEqual(0);
      expect(sprite.y + sprite.height).toBeLessThanOrEqual(h);
      const over = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(over(sprite, jump)).toBe(false);
      expect(over(sprite, hud)).toBe(false);
      // Kontrollerin boyutu küçültülmedi
      expect(stick.width).toBeGreaterThanOrEqual(92);
      expect(jump.width).toBeGreaterThanOrEqual(76);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
});

test.describe("Başlangıç güvenliği (dört seviye)", () => {
  for (const level of [1, 2, 3, 4]) {
    test(`Seviye ${level}: başlangıç güvenli zeminde; coin, kutu ve düşmanla çakışmaz; hareketsiz beklemede skor 0`, async ({ page, consoleErrors }, testInfo) => {
      desktopOnly(testInfo);
      await page.goto(`./?nosw=1&autostart=1&level=${level}`);
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
      const info = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const p = g.player;
        const s = g.levelData.start;
        const lead = { x: p.x - 60, y: p.y, w: p.w + 120, h: p.h };
        const standing = g.platforms.find((q) => q.y === p.y + p.h && p.x >= q.x && p.x + p.w <= q.x + q.w);
        return {
          start: s,
          x: p.x,
          foot: p.y + p.h,
          standing: Boolean(standing),
          standingType: standing && standing.type,
          lastSafe: { ...g.state.lastSafe },
          coinHit: g.coins.filter((c) => g.test.rectsOverlap(lead, c)).length,
          boxHit: g.boxes.filter((b) => g.test.rectsOverlap(p, b)).length,
          enemyNear: g.enemies.filter((e) => e.minX < p.x + p.w + 200).length
        };
      });
      expect(info.x).toBe(info.start.x);
      expect(info.foot).toBe(info.start.footY);
      expect(info.standing).toBe(true);
      expect(info.standingType).toBe("ground");
      expect(info.lastSafe).toEqual({ x: info.start.x, footY: info.start.footY });
      expect(info.coinHit, "başlangıçta coin 60 px'den yakın olmamalı").toBe(0);
      expect(info.boxHit).toBe(0);
      expect(info.enemyNear).toBe(0);
      // Hareketsiz 3 saniye: hiçbir şey toplanmaz
      await page.waitForTimeout(3000);
      const after = await game(page, () => ({ score: window.__MAVI_GAME__.state.score, stats: { ...window.__MAVI_GAME__.state.levelStats }, x: window.__MAVI_GAME__.player.x, question: Boolean(window.__MAVI_GAME__.state.currentQuestion) }));
      expect(after.score).toBe(0);
      expect(after.stats).toMatchObject({ coins: 0, questions: 0, correct: 0 });
      expect(after.question).toBe(false);
      expect(after.x).toBe(info.start.x);
    });
  }
});

test.describe("Başlangıç noktası bütün akışlarda aynı", () => {
  test("Bölümü Yeniden Başlat ve Devam Et başlangıç noktasına döner", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.evaluate(() => localStorage.setItem("mavi-matematik-save", JSON.stringify({ version: 1, level: 2, score: 120, totalStats: { coins: 4, questions: 1, correct: 1 } })));
    await page.reload();
    await page.locator("#continueButton").click();
    await page.locator("#levelIntro").click();
    const start = await game(page, () => window.__MAVI_GAME__.levelData.start);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    expect(await game(page, () => [window.__MAVI_GAME__.player.x, window.__MAVI_GAME__.player.y + window.__MAVI_GAME__.player.h])).toEqual([start.x, start.footY]);
    // Yürü, sonra bölümü yeniden başlat
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyD");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(start.x + 50);
    await page.locator("#pauseButton").click();
    await page.locator("#restartLevelButton").click();
    await page.locator("#confirmRestartButton").click();
    const after = await game(page, () => ({ x: window.__MAVI_GAME__.player.x, foot: window.__MAVI_GAME__.player.y + window.__MAVI_GAME__.player.h, safe: { ...window.__MAVI_GAME__.state.lastSafe }, cam: window.__MAVI_GAME__.state.cameraX }));
    expect(after).toEqual({ x: start.x, foot: start.footY, safe: { x: start.x, footY: start.footY }, cam: 0 });
  });

  test("çukura düşünce başlangıç checkpoint'ine aynı koordinatla dönülür", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    // Seviye 4: başlangıç zemini 0–600, hemen ardından çukur
    await page.goto("./?nosw=1&autostart=1&level=4");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    const start = await game(page, () => window.__MAVI_GAME__.levelData.start);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.x = 680; // 600–760 arası çukur
      g.player.y = 500;
      g.player.vy = 0;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.lives)).toBe(2);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    const p = await game(page, () => ({ x: window.__MAVI_GAME__.player.x, foot: window.__MAVI_GAME__.player.y + window.__MAVI_GAME__.player.h }));
    expect(p).toEqual({ x: start.x, foot: start.footY });
  });

  test("game.js başlangıç koordinatının kopyasını tutmaz", async ({ request }, testInfo) => {
    desktopOnly(testInfo);
    const src = await (await request.get("./game.js")).text();
    expect(src).not.toMatch(/\bx:\s*90\b/);
    expect(src).not.toMatch(/lastSafe:\s*\{\s*x:\s*\d/);
    expect(src).toContain("LEVEL_DATA.start.x");
  });
});
