// Sprint 3C: kampanya kaydı, duraklatma, menüler, ayarlar, kurulum arayüzü, klavye/odak ve mobil yerleşim.
import { test as base, expect } from "@playwright/test";

const SAVE_KEY = "mavi-matematik-save";
const SETTINGS_KEY = "mavi-matematik-settings";
const SCORES_KEY = "mavi-matematik-high-scores";

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

const isTouchProject = (testInfo) => Boolean(testInfo.project.use.hasTouch);
const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== "masaustu-1440x900", "Tek projede yeterli");
const game = (page, fn, arg) => page.evaluate(fn, arg);
const readSave = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), SAVE_KEY);

async function skipIntro(page) {
  await expect(page.locator("#levelIntro")).toBeVisible();
  await page.locator("#levelIntro").click();
  await expect(page.locator("#levelIntro")).toBeHidden();
  await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
}

async function newGame(page) {
  await page.goto("./?nosw=1");
  await expect(page.locator("#startDialog")).toBeVisible();
  await page.locator("#startButton").click();
  await skipIntro(page);
}

async function finishLevel(page) {
  await game(page, () => {
    const g = window.__MAVI_GAME__;
    g.player.invuln = 999;
    g.player.x = 6480;
    g.player.y = 625 - g.player.h;
  });
  await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
  await game(page, () => {
    const g = window.__MAVI_GAME__;
    for (let i = 0; i < 6; i += 1) g.test.damageBoss();
    g.test.setManualStep(true);
    g.test.step(260);
    g.test.setManualStep(false);
  });
}

function inside(box, vp) {
  return box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5;
}

test.describe("Kampanya kaydı ve Devam Et", () => {
  test("kayıt yokken Devam Et görünmez", async ({ page, consoleErrors }) => {
    await page.goto("./?nosw=1");
    await expect(page.locator("#startButton")).toHaveText("Yeni Macera");
    await expect(page.locator("#continueButton")).toBeHidden();
    await expect(page.locator("#saveInfo")).toBeHidden();
    await expect(page.locator("#howToButton")).toBeVisible();
    await expect(page.locator("#settingsButton")).toBeVisible();
    expect(await readSave(page)).toBeNull();
  });

  test("bölüm başlangıcı kaydı: bölüm ortası kaydedilmez, yeni bölüm yeni kayıt yazar", async ({ page, consoleErrors }) => {
    await newGame(page);
    expect(await readSave(page)).toMatchObject({ version: 1, level: 1, score: 0, totalStats: { coins: 0, questions: 0, correct: 0 } });
    // Bölüm ortasında coin ve doğru cevap: kayıt değişmez
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.coins[0].x = g.player.x;
      g.coins[0].y = g.player.y + 20;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.score)).toBe(10);
    const answer = await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.test.activateBox(g.boxes[0]);
      return g.state.currentQuestion.answer;
    });
    await game(page, (v) => {
      const input = document.getElementById("answerInput");
      input.readOnly = false;
      input.value = String(v);
    }, answer);
    await page.locator("#answerButton").click();
    await expect(page.locator("#questionDialog")).toBeHidden();
    expect(await readSave(page)).toMatchObject({ level: 1, score: 0 });
    // Bölüm bitince sonraki bölüm başında yeni kayıt: skor ve genel istatistikler o anki haliyle
    await finishLevel(page);
    await page.locator("#nextLevelButton").click();
    const save = await readSave(page);
    expect(save).toMatchObject({ version: 1, level: 2, score: 260, totalStats: { coins: 1, questions: 1, correct: 1 } });
    expect(Object.keys(save).sort()).toEqual(["level", "savedAt", "score", "totalStats", "version"]);
  });

  test("yenileme sonrası aynı bölümün başından devam: can 3, kalkan pasif, bölüm istatistikleri sıfır", async ({ page, consoleErrors }) => {
    await page.goto("./?nosw=1");
    await page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({ version: 1, level: 3, score: 480, totalStats: { coins: 30, questions: 6, correct: 5 }, savedAt: "2026-09-26T10:00:00Z" }));
    }, SAVE_KEY);
    await page.reload();
    await expect(page.locator("#continueButton")).toBeVisible();
    await expect(page.locator("#continueButton")).toBeFocused();
    await expect(page.locator("#saveInfoLevel")).toHaveText("Seviye 3 — Gün Batımı Kanyonu");
    await page.locator("#continueButton").click();
    await expect(page.locator("#levelIntroTitle")).toHaveText("Seviye 3 — Gün Batımı Kanyonu");
    const st = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { level: g.state.level, score: g.state.score, lives: g.state.lives, shield: g.player.shield, stats: { ...g.state.levelStats }, total: { ...g.state.totalStats }, x: g.player.x, p1: [g.platforms[1].x, g.platforms[1].y] };
    });
    expect(st).toMatchObject({ level: 3, score: 480, lives: 3, shield: 0, x: 90, p1: [830, 600] });
    expect(st.stats).toMatchObject({ coins: 0, questions: 0, correct: 0, scoreStart: 480 });
    expect(st.total).toEqual({ coins: 30, questions: 6, correct: 5 });
  });

  test("bozuk, eski veya eksik kayıt ve ayar verisi oyunu çökertmez", async ({ page, consoleErrors }) => {
    const bad = [
      "{bozuk json",
      JSON.stringify({ version: 0, level: 2, score: 10, totalStats: { coins: 0, questions: 0, correct: 0 } }),
      JSON.stringify({ version: 1, level: 9, score: 10, totalStats: { coins: 0, questions: 0, correct: 0 } }),
      JSON.stringify({ version: 1, level: 2, score: -5, totalStats: { coins: 0, questions: 0, correct: 0 } }),
      JSON.stringify({ version: 1, level: 2, score: 10 }),
      JSON.stringify({ version: 1, level: 2, score: 10, totalStats: { coins: 1, questions: 1, correct: 3 } }),
      "null",
      "42"
    ];
    await page.goto("./?nosw=1");
    for (const raw of bad) {
      await page.evaluate(
        ({ raw, k, sk }) => {
          localStorage.setItem(k, raw);
          localStorage.setItem(sk, "{çöp");
        },
        { raw, k: SAVE_KEY, sk: SETTINGS_KEY }
      );
      await page.reload();
      await expect(page.locator("#startDialog")).toBeVisible();
      await expect(page.locator("#continueButton"), raw).toBeHidden();
    }
    await page.locator("#startButton").click();
    await skipIntro(page);
    expect(await game(page, () => window.__MAVI_GAME__.state.level)).toBe(1);
  });

  test("Yeni Macera onay ister; yalnızca kaydı temizler, top-10 ve ayarlar kalır", async ({ page, consoleErrors }) => {
    const scores = [{ name: "Ada", score: 900, level: 4, date: "2026-09-01T00:00:00Z" }];
    const settings = { version: 1, sound: false, motion: "reduced" };
    await page.goto("./?nosw=1");
    await page.evaluate(
      ({ scores, settings, keys }) => {
        localStorage.setItem(keys.scores, JSON.stringify(scores));
        localStorage.setItem(keys.settings, JSON.stringify(settings));
        localStorage.setItem(keys.save, JSON.stringify({ version: 1, level: 2, score: 300, totalStats: { coins: 9, questions: 2, correct: 2 } }));
      },
      { scores, settings, keys: { scores: SCORES_KEY, settings: SETTINGS_KEY, save: SAVE_KEY } }
    );
    await page.reload();
    await page.locator("#startButton").click();
    const panel = page.locator('[data-panel="confirm-new"]');
    await expect(panel).toBeVisible();
    await expect(page.locator("#confirmNewLevel")).toHaveText("Seviye 2 — Sisli Vadi");
    await expect(panel.locator("[data-panel-back]")).toBeFocused();
    // Vazgeç: hiçbir şey değişmez
    await panel.locator("[data-panel-back]").click();
    await expect(page.locator("#menuDialog")).toBeHidden();
    await expect(page.locator("#startButton")).toBeFocused();
    expect(await readSave(page)).toMatchObject({ level: 2, score: 300 });
    // Evet: yeni macera
    await page.locator("#startButton").click();
    await page.locator("#confirmNewButton").click();
    await skipIntro(page);
    expect(await readSave(page)).toMatchObject({ level: 1, score: 0, totalStats: { coins: 0, questions: 0, correct: 0 } });
    const kept = await page.evaluate((keys) => [JSON.parse(localStorage.getItem(keys.scores)), JSON.parse(localStorage.getItem(keys.settings))], { scores: SCORES_KEY, settings: SETTINGS_KEY });
    expect(kept[0]).toEqual(scores);
    expect(kept[1]).toMatchObject({ sound: false, motion: "reduced" });
    expect(await game(page, () => ({ sound: window.__MAVI_GAME__.state.soundEnabled, reduced: window.__MAVI_GAME__.reducedMotion }))).toEqual({ sound: false, reduced: true });
  });

  test("macera tamamlanınca devam kaydı kapanır; top-10 kaydı çalışır", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1&autostart=1&level=4");
    await expect.poll(() => readSave(page)).toMatchObject({ level: 4 });
    await finishLevel(page);
    await expect(page.locator("#resultTitle")).toHaveText("Macera Tamamlandı");
    expect(await readSave(page)).toBeNull();
    await page.locator("#gameOverMenuButton").click();
    await expect(page.locator("#startDialog")).toBeVisible();
    await expect(page.locator("#continueButton")).toBeHidden();
    const scores = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SCORES_KEY);
    expect(scores[0]).toMatchObject({ score: 200, level: 4 });
  });
});

test.describe("Duraklatma", () => {
  test("duraklatınca oyuncu, düşman, süreler, boss ve istatistikler donar; devamda ani hareket yok", async ({ page, consoleErrors }) => {
    await page.goto("./?nosw=1&autostart=1&boss=1&level=2");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.shield = 10;
    });
    const snap = () =>
      game(page, () => {
        const g = window.__MAVI_GAME__;
        return {
          x: g.player.x,
          y: g.player.y,
          shield: g.player.shield,
          enemies: g.enemies.map((e) => e.x),
          fireTimer: g.state.boss.fireTimer,
          fires: g.state.boss.fires.map((f) => f.x),
          stats: { ...g.state.levelStats },
          score: g.state.score,
          fxTime: g.visual.fx.time,
          anim: g.player.anim.time
        };
      });
    await page.locator("#pauseButton").click();
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    const a = await snap();
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyD");
    expect(await snap()).toEqual(a);
    expect(await game(page, () => window.__MAVI_GAME__.state.menuPaused)).toBe(true);
    // Devam: tuş basılı kalmaz, oyuncu kendiliğinden hareket etmez veya zıplamaz
    await page.locator("#resumeButton").click();
    await expect(page.locator("#menuDialog")).toBeHidden();
    await page.waitForTimeout(150);
    const b = await game(page, () => ({ vx: window.__MAVI_GAME__.player.vx, vy: window.__MAVI_GAME__.player.vy, grounded: window.__MAVI_GAME__.player.grounded }));
    expect(b.vx).toBe(0);
    expect(b.vy).toBeGreaterThanOrEqual(0);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.visual.fx.time)).toBeGreaterThan(a.fxTime);
  });

  test("uygulama arka plana gidince otomatik duraklar", async ({ page, consoleErrors }) => {
    await newGame(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    });
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    expect(await game(page, () => window.__MAVI_GAME__.state.menuPaused)).toBe(true);
    expect(await game(page, () => document.querySelector(".stage").inert)).toBe(true);
  });

  test("joystick duraklatmada sıfırlanır ve menü açıkken çalışmaz", async ({ page, consoleErrors }, testInfo) => {
    test.skip(!isTouchProject(testInfo), "Dokunmatik cihaz projelerinde çalışır");
    await newGame(page);
    const g0 = await game(page, () => window.__MAVI_GAME__.test.joystickGeometry());
    const cdp = await page.context().newCDPSession(page);
    const at = (fx) => ({ x: Math.round(g0.cx + g0.radius * fx), y: Math.round(g0.cy), id: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(1)] });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.touchInput.axis)).toBe(1);
    await game(page, () => window.__MAVI_GAME__.test.openPause());
    expect(await game(page, () => ({ ...window.__MAVI_GAME__.touchInput }))).toEqual({ axis: 0, jump: false });
    await expect(page.locator("#joystick")).not.toHaveClass(/is-active/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Menü açıkken yeni dokunuş joystick'i çalıştırmaz
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(1)] });
    await page.waitForTimeout(100);
    expect(await game(page, () => window.__MAVI_GAME__.touchInput.axis)).toBe(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Devamdan sonra joystick yeniden çalışır
    await page.locator("#resumeButton").tap();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(1)] });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.touchInput.axis)).toBe(1);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  });

  test("soru, tanıtım, özet ve final açıkken duraklatma penceresi üst üste açılmaz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    const tryPause = async () => {
      await page.keyboard.press("KeyP");
      await page.keyboard.press("Escape");
      await game(page, () => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      });
      expect(await game(page, () => window.__MAVI_GAME__.test.openPause())).toBe(false);
      await expect(page.locator("#menuDialog")).toBeHidden();
    };
    // Tanıtım
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    await expect(page.locator("#levelIntro")).toBeVisible();
    await page.keyboard.press("KeyP");
    await expect(page.locator("#menuDialog")).toBeHidden();
    await expect(page.locator("#pauseButton")).toBeDisabled();
    await page.locator("#levelIntro").click();
    // Soru
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await expect(page.locator("#questionDialog")).toBeVisible();
    await tryPause();
    await expect(page.locator("#questionDialog")).toBeVisible();
    await game(page, () => window.__MAVI_GAME__.test.dismissQuestion());
    // Özet
    await finishLevel(page);
    await expect(page.locator("#levelSummaryDialog")).toBeVisible();
    await tryPause();
    // Final
    await page.goto("./?nosw=1&autostart=1&level=4");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    await finishLevel(page);
    await expect(page.locator("#gameOverDialog")).toBeVisible();
    await page.locator("#resultTitle").click();
    await tryPause();
  });

  test("Bölümü Yeniden Başlat onayla bölüm başına döner; Ana Menü kaydı korur", async ({ page, consoleErrors }) => {
    await page.goto("./?nosw=1");
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, level: 2, score: 300, totalStats: { coins: 9, questions: 2, correct: 2 } })), SAVE_KEY);
    await page.reload();
    await page.locator("#continueButton").click();
    await skipIntro(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.coins[0].x = g.player.x;
      g.coins[0].y = g.player.y + 20;
      g.player.x = 400;
      g.state.lives = 2;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.score)).toBe(310);
    await page.locator("#pauseButton").click();
    await page.locator("#restartLevelButton").click();
    const confirm = page.locator('[data-panel="confirm-restart"]');
    await expect(confirm).toBeVisible();
    await expect(confirm.locator("[data-panel-back]")).toBeFocused();
    // Vazgeç duraklatma paneline döner
    await confirm.locator("[data-panel-back]").click();
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    await page.locator("#restartLevelButton").click();
    await page.locator("#confirmRestartButton").click();
    await expect(page.locator("#menuDialog")).toBeHidden();
    await expect(page.locator("#levelIntroTitle")).toHaveText("Seviye 2 — Sisli Vadi");
    const st = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { score: g.state.score, lives: g.state.lives, x: g.player.x, coin0: g.coins[0].collected, stats: { ...g.state.levelStats }, total: { ...g.state.totalStats } };
    });
    expect(st).toMatchObject({ score: 300, lives: 3, x: 90, coin0: false, total: { coins: 9, questions: 2, correct: 2 } });
    expect(st.stats).toMatchObject({ coins: 0, questions: 0, correct: 0 });
    // Ana Menü: kayıt korunur, Devam Et görünür
    await skipIntro(page);
    await page.locator("#pauseButton").click();
    await page.locator("#mainMenuButton").click();
    await expect(page.locator("#startDialog")).toBeVisible();
    await expect(page.locator("#continueButton")).toBeVisible();
    expect(await readSave(page)).toMatchObject({ level: 2, score: 300 });
  });
});

test.describe("Klavye ve odak", () => {
  test("P ve Escape ile duraklat/devam; odak menüde kalır ve kapanınca oyuna döner", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await newGame(page);
    await page.keyboard.press("KeyP");
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    await expect(page.locator("#resumeButton")).toBeFocused();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.getElementById("menuDialog").contains(document.activeElement)), "odak menüde kalmalı").toBe(true);
    }
    // Görünür odak stili
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Escape");
    await expect(page.locator("#menuDialog")).toBeHidden();
    await expect(page.locator("#game")).toBeFocused();
    expect(await game(page, () => window.__MAVI_GAME__.state.menuPaused)).toBe(false);
    // Alt panelde Escape bir üst panele döner
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    await page.locator('[data-panel="pause"] [data-open-panel="settings"]').click();
    await expect(page.locator('[data-panel="settings"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    await page.keyboard.press("KeyP");
    await expect(page.locator("#menuDialog")).toBeHidden();
  });

  test("başlangıç ekranından açılan panel Escape ile kapanır, odak açan düğmeye döner", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.locator("#howToButton").click();
    await expect(page.locator('[data-panel="howto"]')).toBeVisible();
    await expect(page.locator("#menuDialog")).toHaveAttribute("aria-labelledby", "menuTitleHowto");
    await page.keyboard.press("Escape");
    await expect(page.locator("#menuDialog")).toBeHidden();
    await expect(page.locator("#howToButton")).toBeFocused();
    await expect(page.locator("#startDialog")).toBeVisible();
    expect(await game(page, () => window.__MAVI_GAME__.state.started)).toBe(false);
  });
});

test.describe("Ayarlar ve hareket efektleri", () => {
  test("ayarlar kalıcıdır; kullanıcı seçimi sistem ayarının önüne geçer", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./?nosw=1");
    // İlk varsayılan sistemden gelir
    expect(await game(page, () => window.__MAVI_GAME__.reducedMotion)).toBe(true);
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    await page.locator("#settingsButton").click();
    await expect(page.locator('[data-motion="reduced"]')).toHaveAttribute("aria-checked", "true");
    await page.locator('[data-motion="normal"]').click();
    await page.locator("#soundToggleSettings").click();
    expect(await game(page, () => window.__MAVI_GAME__.reducedMotion)).toBe(false);
    await expect(page.locator("html")).not.toHaveClass(/reduce-motion/);
    await page.reload();
    expect(await game(page, () => ({ reduced: window.__MAVI_GAME__.reducedMotion, sound: window.__MAVI_GAME__.state.soundEnabled }))).toEqual({ reduced: false, sound: false });
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY)).toEqual({ version: 1, sound: false, motion: "normal" });
    await page.locator("#settingsButton").click();
    await expect(page.locator('[data-motion="normal"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#soundToggleSettings")).toHaveAttribute("aria-pressed", "false");
  });

  test("Azaltılmış seçimi: sarsıntı ve şok dalgası yok, parçacık az, geçiş animasyonları kısa", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.locator("#settingsButton").click();
    await page.locator('[data-motion="reduced"]').click();
    await page.keyboard.press("Escape");
    await page.goto("./?nosw=1&autostart=1&boss=1&level=1");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
    await game(page, () => window.__MAVI_GAME__.test.damageBoss());
    const fx = await game(page, () => ({ shake: window.__MAVI_GAME__.visual.fx.shakeTime, rings: window.__MAVI_GAME__.visual.fx.rings.length, cap: window.__MAVI_GAME__.visual.particleCap() }));
    expect(fx).toEqual({ shake: 0, rings: 0, cap: 60 });
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    const d = await page.locator(".level-intro-card").evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(d).toBeLessThan(0.01);
  });
});

test.describe("Kurulum arayüzü", () => {
  test("istem yokken yalnızca Kurulum Yardımı; istem gelince Uygulamayı Yükle", async ({ page, consoleErrors }) => {
    await page.goto("./?nosw=1");
    await expect(page.locator("#installButton")).toBeHidden();
    await expect(page.locator("#installHelpButton")).toBeVisible();
    await page.locator("#installHelpButton").click();
    const panel = page.locator('[data-panel="install"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Uygulamayı yükle");
    await expect(panel).toContainText("Ana Ekrana Ekle");
    await expect(page.locator("#installStepAndroid")).toHaveClass(/is-current/);
    await panel.locator("[data-panel-back]").click();
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
    await expect(page.locator("#installButton")).toBeVisible();
    await expect(page.locator("#installHelpButton")).toBeHidden();
  });

  test("kurulu (standalone) çalışırken yükleme ve yardım düğmeleri gizli", async ({ page, consoleErrors }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q.includes("display-mode: standalone") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : original(q));
    });
    await page.goto("./?nosw=1");
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
    await expect(page.locator("#installButton")).toBeHidden();
    await expect(page.locator("#installHelpButton")).toBeHidden();
  });

  test("iPhone/iPad'de Safari adımı vurgulanır", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      hasTouch: true,
      isMobile: true
    });
    const page = await ctx.newPage();
    await page.goto(new URL("./?nosw=1", testInfo.project.use.baseURL).href);
    await page.locator("#installHelpButton").tap();
    await expect(page.locator("#installStepIos")).toHaveClass(/is-current/);
    await expect(page.locator("#installStepAndroid")).not.toHaveClass(/is-current/);
    await ctx.close();
  });
});

test.describe("Mobil yerleşim", () => {
  test("başlangıç, menü panelleri ve özet ekrana sığar; düğmeler en az 48x48", async ({ page, consoleErrors }) => {
    const vp = page.viewportSize();
    const checkDialog = async (selector, label) => {
      const dlg = page.locator(selector);
      const box = await dlg.boundingBox();
      expect(inside(box, vp), `${label} ekrana sığmalı`).toBe(true);
      expect(await dlg.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), `${label} kaydırmasız sığmalı`).toBe(true);
      const buttons = await dlg.locator("button:visible").all();
      for (const b of buttons) {
        const bb = await b.boundingBox();
        const name = (await b.textContent()).trim();
        expect(bb.height, `${label}: "${name}" yüksekliği`).toBeGreaterThanOrEqual(48);
        expect(bb.width, `${label}: "${name}" genişliği`).toBeGreaterThanOrEqual(48);
        expect(inside(bb, vp), `${label}: "${name}" ekranda`).toBe(true);
        expect(await b.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${label}: "${name}" metni taşmamalı`).toBe(true);
      }
    };
    // Kayıtlı durumda başlangıç ekranı (en kalabalık hali)
    await page.goto("./?nosw=1");
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, level: 4, score: 900, totalStats: { coins: 90, questions: 20, correct: 18 } })), SAVE_KEY);
    await page.reload();
    await checkDialog("#startDialog .start-card", "başlangıç");
    for (const panel of ["howto", "settings", "install"]) {
      await page.locator(`#startDialog [data-open-panel="${panel}"]`).click();
      await checkDialog("#menuDialog", panel);
      await page.locator(`[data-panel="${panel}"] [data-panel-back]`).click();
    }
    await page.locator("#continueButton").click();
    await skipIntro(page);
    // HUD düğmeleri
    for (const sel of ["#pauseButton", "#soundToggleGame"]) {
      const bb = await page.locator(sel).boundingBox();
      expect(bb.width).toBeGreaterThanOrEqual(48);
      expect(bb.height).toBeGreaterThanOrEqual(48);
      expect(inside(bb, vp)).toBe(true);
    }
    await page.locator("#pauseButton").click();
    await checkDialog("#menuDialog", "duraklatma");
    await page.locator("#restartLevelButton").click();
    await checkDialog("#menuDialog", "bölüm onayı");
    await page.locator('[data-panel="confirm-restart"] [data-panel-back]').click();
    await page.locator('[data-panel="pause"] [data-open-panel="howto"]').click();
    await checkDialog("#menuDialog", "duraklatma > nasıl oynanır");
    await page.keyboard.press("Escape");
    await page.locator("#resumeButton").click();
    await finishLevel(page);
    await expect(page.locator("#gameOverDialog")).toBeVisible();
    await checkDialog("#gameOverDialog", "final");
  });
});

test.describe("Dikey ekran", () => {
  test("dikeyde yalnızca dostça uyarı; yatay çevirince oyun kaldığı yerden sürer", async ({ browser }, testInfo) => {
    desktopOnly(testInfo);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("./?nosw=1&autostart=1", testInfo.project.use.baseURL).href);
    const rotate = page.locator("#rotateDialog");
    await expect(rotate).toBeVisible();
    await expect(rotate).toContainText("Cihazını yan çevir");
    expect(await page.evaluate(() => window.__MAVI_GAME__.test.openPause())).toBe(false);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(rotate).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
    expect(await page.evaluate(() => window.__MAVI_GAME__.test.openPause())).toBe(true);
    await expect(page.locator('[data-panel="pause"]')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
