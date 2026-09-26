// Sprint 3C.1: geniş telefonlarda gerçek tam ekran, esnemeyen uyarlanabilir görünüm, safe-area ve kamera.
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

const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== "masaustu-1440x900", "Kendi ekran boyutlarını açar; tek projede yeterli");
const game = (page, fn, arg) => page.evaluate(fn, arg);

// Chromium'da env(safe-area-inset-*) emülasyonu yok: yatay çentikli iPhone değerleri CSS değişkenleriyle verilir.
const NOTCH = { l: 59, r: 59, t: 0, b: 21 };

async function openAt(browser, testInfo, viewport, { notch = false, query = "&autostart=1", dpr = 2 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  if (notch) {
    await page.addInitScript((n) => {
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = `:root{--safe-l:${n.l}px;--safe-r:${n.r}px;--safe-t:${n.t}px;--safe-b:${n.b}px}`;
        document.head.appendChild(st);
      });
    }, NOTCH);
  }
  await page.goto(new URL(`./?nosw=1${query}`, testInfo.project.use.baseURL).href);
  await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.state.started)).toBe(true);
  await page.waitForTimeout(200);
  return { ctx, page, errors };
}

const box = (page, sel) => page.locator(sel).boundingBox();
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function canvasMetrics(page) {
  return page.evaluate(() => {
    const r = document.getElementById("game").getBoundingClientRect();
    const v = window.__MAVI_GAME__.view;
    return { left: r.left, right: innerWidth - r.right, top: r.top, bottom: innerHeight - r.bottom, sx: r.width / v.w, sy: r.height / v.h, viewW: v.w };
  });
}

test.describe("Uyarlanabilir tam ekran görünüm", () => {
  for (const [w, h, label] of [
    [844, 390, "telefon 844x390"],
    [915, 412, "Android 915x412"],
    [2556, 1179, "iPhone ekran görüntüsü oranı 2556x1179"],
    [852, 393, "iPhone 15 Pro 852x393"]
  ]) {
    test(`${label}: oyun alanı ekranın tamamını kaplar, esnemez`, async ({ browser }, testInfo) => {
      desktopOnly(testInfo);
      const { ctx, page, errors } = await openAt(browser, testInfo, { width: w, height: h }, { dpr: w > 2000 ? 1 : 3 });
      const m = await canvasMetrics(page);
      expect(m.left, "sol boşluk").toBeLessThanOrEqual(1);
      expect(m.right, "sağ boşluk").toBeLessThanOrEqual(1);
      expect(m.top, "üst boşluk").toBeLessThanOrEqual(1);
      expect(m.bottom, "alt boşluk").toBeLessThanOrEqual(1);
      expect(Math.abs(m.sx - m.sy), "X ve Y ölçeği eşit").toBeLessThan(0.001);
      expect(m.viewW).toBe(Math.round((720 * w) / h));
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }

  test("16:9 ve daha dar ekranlar esnemez; boş alan sahne rengiyle birleşir", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    for (const [w, h] of [[1280, 720], [1024, 768], [1440, 900]]) {
      const { ctx, page } = await openAt(browser, testInfo, { width: w, height: h });
      const m = await canvasMetrics(page);
      expect(m.viewW).toBe(1280);
      expect(Math.abs(m.sx - m.sy)).toBeLessThan(0.001);
      expect(m.left).toBeLessThanOrEqual(1);
      expect(m.right).toBeLessThanOrEqual(1);
      expect(Math.abs(m.top - m.bottom)).toBeLessThanOrEqual(1);
      // Üst/alt boşluk seviyenin gökyüzü ve toprak rengiyle dolu
      const colors = await page.evaluate(() => {
        const st = getComputedStyle(document.querySelector(".stage"));
        return { top: st.getPropertyValue("--scene-top").trim(), bottom: st.getPropertyValue("--scene-bottom").trim(), theme: window.__MAVI_GAME__.levelData.levels[0].theme };
      });
      expect(colors.top).toBe(colors.theme.skyTop);
      expect(colors.bottom).toBe(colors.theme.dirtBottom);
      await ctx.close();
    }
  });

  test("21:9'dan geniş ekranda görünüm sınırlanır, kenarlar eşit ve esneme yok", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    const { ctx, page } = await openAt(browser, testInfo, { width: 2560, height: 1000 });
    const m = await canvasMetrics(page);
    expect(m.viewW).toBe(1680);
    expect(Math.abs(m.sx - m.sy)).toBeLessThan(0.001);
    expect(m.top).toBeLessThanOrEqual(1);
    expect(Math.abs(m.left - m.right)).toBeLessThanOrEqual(1);
    await ctx.close();
  });

  test("ekran boyutu değişince görünüm ve kamera yeniden hesaplanır", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    const { ctx, page } = await openAt(browser, testInfo, { width: 844, height: 390 });
    expect((await canvasMetrics(page)).viewW).toBe(1558);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(async () => (await canvasMetrics(page)).viewW).toBe(1280);
    await page.setViewportSize({ width: 915, height: 412 });
    await expect.poll(async () => (await canvasMetrics(page)).viewW).toBe(1599);
    const m = await canvasMetrics(page);
    expect(m.left).toBeLessThanOrEqual(1);
    expect(m.right).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});

test.describe("Safe-area ve kontroller", () => {
  test("çentikli iPhone: HUD, ses ve duraklat safe-area içinde; joystick ve zıpla ekran kenarlarında", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    const { ctx, page, errors } = await openAt(browser, testInfo, { width: 852, height: 393 }, { notch: true, dpr: 3 });
    const W = 852;
    const H = 393;
    const hud = await box(page, ".hud");
    const pause = await box(page, "#pauseButton");
    const sound = await box(page, "#soundToggleGame");
    const stick = await box(page, ".joystick-base");
    const jump = await box(page, '[data-action="jump"]');
    // Oyun görseli çentik bölgesi dahil kenara kadar uzanır
    const m = await canvasMetrics(page);
    expect(m.left).toBeLessThanOrEqual(1);
    expect(m.right).toBeLessThanOrEqual(1);
    // Etkileşimli öğeler safe-area içinde
    expect(hud.x).toBeGreaterThanOrEqual(NOTCH.l);
    expect(sound.x).toBeGreaterThanOrEqual(NOTCH.l);
    expect(pause.x + pause.width).toBeLessThanOrEqual(W - NOTCH.r);
    expect(stick.x).toBeGreaterThanOrEqual(NOTCH.l);
    expect(jump.x + jump.width).toBeLessThanOrEqual(W - NOTCH.r);
    expect(stick.y + stick.height).toBeLessThanOrEqual(H - NOTCH.b);
    expect(jump.y + jump.height).toBeLessThanOrEqual(H - NOTCH.b);
    // Fazladan büyük kenar boşluğu yok: safe-area'ya yakın
    expect(hud.x - NOTCH.l).toBeLessThanOrEqual(24);
    expect(W - NOTCH.r - (pause.x + pause.width)).toBeLessThanOrEqual(24);
    expect(stick.x - NOTCH.l).toBeLessThanOrEqual(24);
    expect(W - NOTCH.r - (jump.x + jump.width)).toBeLessThanOrEqual(24);
    expect(H - NOTCH.b - (stick.y + stick.height)).toBeLessThanOrEqual(24);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  for (const [w, h] of [[844, 390], [915, 412]]) {
    test(`${w}x${h}: joystick ve zıpla gerçek ekran kenarında; HUD, kontroller ve soru penceresi çakışmaz`, async ({ browser }, testInfo) => {
      desktopOnly(testInfo);
      const { ctx, page } = await openAt(browser, testInfo, { width: w, height: h }, { dpr: 3 });
      const stick = await box(page, ".joystick-base");
      const jump = await box(page, '[data-action="jump"]');
      const hud = await box(page, ".hud");
      const corner = await box(page, ".corner-actions");
      // Kenarlara göre konum (eski 16:9 çerçevenin 75–91 px içinde değil)
      expect(stick.x).toBeLessThanOrEqual(24);
      expect(w - (jump.x + jump.width)).toBeLessThanOrEqual(24);
      expect(h - (stick.y + stick.height)).toBeLessThanOrEqual(24);
      expect(h - (jump.y + jump.height)).toBeLessThanOrEqual(24);
      for (const [a, b, n] of [[stick, jump, "joystick/zıpla"], [stick, hud, "joystick/HUD"], [jump, corner, "zıpla/köşe"], [hud, corner, "HUD/köşe"]]) {
        expect(overlap(a, b), n).toBe(false);
      }
      await page.evaluate(() => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
      const dlg = await box(page, "#questionDialog");
      expect(overlap(dlg, stick), "soru/joystick").toBe(false);
      expect(overlap(dlg, jump), "soru/zıpla").toBe(false);
      expect(dlg.y + dlg.height).toBeLessThanOrEqual(h);
      await ctx.close();
    });
  }
});

test.describe("Kamera ve çizim (geniş görünüm)", () => {
  for (const level of [1, 2, 3, 4]) {
    test(`Seviye ${level}: başlangıç, çukurlar ve boss arenası geniş görünümün tamamında çizilir; kamera dünya dışını göstermez`, async ({ browser }, testInfo) => {
      desktopOnly(testInfo);
      const { ctx, page, errors } = await openAt(browser, testInfo, { width: 852, height: 393 }, { query: `&autostart=1&level=${level}`, dpr: 1 });
      // Görünümdeki her piksel boyanmış olmalı (boyanmamış alan CSS arka planı olarak görünürdü)
      const unpainted = () =>
        page.evaluate(() => {
          const c = document.getElementById("game");
          const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 255) n += 1;
          return n;
        });
      const cam0 = await game(page, () => ({ cam: window.__MAVI_GAME__.state.cameraX, w: window.__MAVI_GAME__.view.w }));
      expect(cam0.cam).toBe(0);
      expect(await unpainted(), "başlangıç").toBe(0);
      // Çukurların bulunduğu orta bölüm
      await game(page, () => {
        const g = window.__MAVI_GAME__;
        g.player.invuln = 999;
        const route = g.levelData.levels[g.state.level - 1].route;
        const mid = g.platforms[route[Math.floor(route.length / 2)]];
        g.player.x = mid.x + 10;
        g.player.y = mid.y - g.player.h;
      });
      await page.waitForTimeout(1500);
      expect(await unpainted(), "orta bölüm").toBe(0);
      // Boss arenası: kamera sağ sınırda, dünya dışı görünmez
      await game(page, () => {
        const g = window.__MAVI_GAME__;
        g.player.x = 6480;
        g.player.y = 625 - g.player.h;
      });
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
      await page.waitForTimeout(1800);
      const cam = await game(page, () => ({ cam: window.__MAVI_GAME__.state.cameraX, w: window.__MAVI_GAME__.view.w, boss: window.__MAVI_GAME__.state.boss.x }));
      expect(cam.cam).toBeGreaterThanOrEqual(0);
      expect(cam.cam + cam.w).toBeLessThanOrEqual(7500 + 0.5);
      expect(cam.boss).toBeGreaterThan(cam.cam);
      expect(cam.boss + 146).toBeLessThan(cam.cam + cam.w);
      expect(await unpainted(), "boss arenası").toBe(0);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
});
