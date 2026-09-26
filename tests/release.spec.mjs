// RC1: tam macera uçtan uca testi.
// Yeni Macera → dört seviye (soru, coin, düşman, boss, özet) → Macera Tamamlandı → top-10 → Yeniden Oyna.
// Deterministik: Math.random ve soru üreticisi tohumlanır, fizik test.step ile 60 FPS adımlarla ilerler.
// Kısayol olarak yalnızca oyuncunun bölüm içinde ışınlanması (koşu rotası levels.spec'te ayrıca sınanır)
// ve boss sırasında hasar almaması kullanılır; puan, soru, roket ve boss hasarı gerçek oyun kodundan gelir.
import { test as base, expect } from "@playwright/test";

const SAVE_KEY = "mavi-matematik-save";
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

const game = (page, fn, arg) => page.evaluate(fn, arg);
const isTouch = (testInfo) => Boolean(testInfo.project.use.hasTouch);
const press = (page, selector, testInfo) => (isTouch(testInfo) ? page.locator(selector).tap() : page.locator(selector).click());
const readStore = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), key);

// Math.random'ı tohumlu üreteçle değiştirir (boss ateşi, kutu konumu, efektler tekrarlanabilir olur)
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Soru metni seviyenin mathProfile sınırları içinde mi?
function fitsProfile(text, answer, profile) {
  const m = /^(\d+) ([+\-×]) (\d+)$/.exec(text);
  if (!m) return `biçim: ${text}`;
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (m[2] === "+") {
    const p = profile.add;
    if (!p || a < p.min || b < p.min || a + b > p.maxResult || answer !== a + b) return `toplama sınır dışı: ${text}`;
  } else if (m[2] === "-") {
    const p = profile.sub;
    if (!p || a < p.minA || a > p.max || b < p.minB || a - b < 0 || answer !== a - b) return `çıkarma sınır dışı: ${text}`;
  } else {
    const p = profile.mul;
    const ok = p && ((p.factors.includes(a) && b >= p.min && b <= p.max) || (p.factors.includes(b) && a >= p.min && a <= p.max));
    if (!ok || answer !== a * b) return `çarpma sınır dışı: ${text}`;
  }
  return null;
}

async function answerQuestion(page, testInfo, value) {
  await expect(page.locator("#questionDialog")).toBeVisible();
  if (isTouch(testInfo)) {
    for (const d of String(value)) await press(page, `#questionDialog [data-digit="${d}"]`, testInfo);
    await press(page, "#answerButton", testInfo);
  } else {
    await expect(page.locator("#answerInput")).toBeFocused();
    await page.keyboard.type(String(value));
    await page.keyboard.press("Enter");
  }
}

// Soruyu okur, profile uygunluğunu denetler, cevaplar; pencere kapanana kadar bekler.
async function solve(page, testInfo, profile, correct) {
  const q = await game(page, () => ({ ...window.__MAVI_GAME__.state.currentQuestion }));
  expect(fitsProfile(q.text, q.answer, profile)).toBeNull();
  await expect(page.locator("#questionText")).toHaveText(q.text);
  await answerQuestion(page, testInfo, correct ? q.answer : q.answer + 1);
  const feedback = page.locator("#questionFeedback");
  if (correct) await expect(feedback).toHaveText("Doğru!");
  else await expect(feedback).toHaveText(`Bu sefer olmadı. Doğrusu ${q.answer}. Sıradakini yaparsın!`);
  await expect(page.locator("#questionDialog")).toBeHidden();
  return q;
}

test.describe("Tam macera (uçtan uca)", () => {
  test("Yeni Macera → dört seviye ve boss → Macera Tamamlandı → top-10 → Yeniden Oyna", async ({ page, consoleErrors }, testInfo) => {
    test.skip(!["masaustu-1440x900", "telefon-844x390"].includes(testInfo.project.name), "Masaüstü ve yatay telefonda koşar");
    test.setTimeout(240000);
    const origin = new URL(testInfo.project.use.baseURL).origin;
    const requests = [];
    page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
    await page.addInitScript(seedRandom, 20260926);

    // Önceden kayıtlı bir top-10 listesi; biri HTML gibi görünen bir ad (metin olarak gösterilmeli)
    await page.goto("./?nosw=1");
    await page.evaluate((k) => {
      localStorage.clear();
      localStorage.setItem(k, JSON.stringify([
        { name: "<img src=x onerror=alert(1)>", score: 5, level: 1, date: "2026-09-01T10:00:00Z" },
        { name: "Deniz", score: 3000, level: 4, date: "2026-09-02T10:00:00Z" }
      ]));
    }, SCORES_KEY);
    await page.reload();
    await expect(page.locator("#continueButton")).toBeHidden();
    await expect(page.locator("#startButton")).toHaveText("Yeni Macera");
    await press(page, "#startButton", testInfo);

    const data = await game(page, () => window.__MAVI_GAME__.levelData);
    let expectedScore = 0;
    const total = { coins: 0, questions: 0, correct: 0 };

    for (let level = 1; level <= 4; level += 1) {
      const def = data.levels[level - 1];
      const profile = def.mathProfile;
      const levelScoreStart = expectedScore;

      // Tanıtım: başlık ve seviyenin matematik odağı
      await expect(page.locator("#levelIntro")).toBeVisible();
      await expect(page.locator("#levelIntroTitle")).toHaveText(`Seviye ${level} — ${def.name}`);
      await expect(page.locator("#levelIntroFocus")).toHaveText(profile.focus);
      await press(page, "#levelIntro", testInfo);
      await expect(page.locator("#levelIntro")).toBeHidden();
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);

      // Bölüm başı kaydı ve başlangıç durumu
      expect(await readStore(page, SAVE_KEY)).toMatchObject({ version: 1, level, score: expectedScore, totalStats: total });
      const start = await game(page, () => {
        const g = window.__MAVI_GAME__;
        g.test.setManualStep(true);
        return { level: g.state.level, score: g.state.score, lives: g.state.lives, x: g.player.x, bossActive: g.state.boss.active, profile: g.levelData.levels[g.state.level - 1].mathProfile.focus };
      });
      expect(start).toEqual({ level, score: expectedScore, lives: 3, x: data.start.x, bossActive: false, profile: profile.focus });
      await game(page, (seed) => window.__MAVI_GAME__.test.setQuestionSeed(seed), 1000 + level);

      // Coin: başlangıç zemininin sonuna kadar gerçek fizikle koş, kenarda zıpla, sonraki zemine in
      const run = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const p = g.player;
        const groundEnd = g.platforms[0].x + g.platforms[0].w;
        g.touchInput.axis = 1;
        let jumped = false;
        let frames = 0;
        for (; frames < 600; frames += 1) {
          if (!jumped && p.grounded && p.x + p.w >= groundEnd - 24) {
            g.touchInput.jump = true;
            jumped = true;
          } else {
            g.touchInput.jump = false;
          }
          g.test.step(1);
          if (jumped && p.grounded && p.x > groundEnd) break;
        }
        g.touchInput.axis = 0;
        g.touchInput.jump = false;
        g.test.step(10);
        const collected = g.coins.filter((c) => c.collected).length;
        return { frames, collected, stats: g.state.levelStats.coins, score: g.state.score, lives: g.state.lives, landedOn: p.x > groundEnd };
      });
      expect(run.landedOn, "kenardan zıplayıp sonraki zemine inmeli").toBe(true);
      expect(run.lives).toBe(3);
      expect(run.collected).toBeGreaterThanOrEqual(3);
      expect(run.stats).toBe(run.collected);
      expectedScore += run.collected * 10;
      total.coins += run.collected;
      expect(run.score).toBe(expectedScore);

      // Düşman: ilk düşmanın üstüne düşerek gerçek çiğneme çarpışmasıyla yen
      const stomp = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const e = g.enemies[0];
        const p = g.player;
        p.x = e.x + e.w / 2 - p.w / 2;
        p.y = e.y - p.h - 70;
        p.vy = 0;
        p.grounded = false;
        let frames = 0;
        while (!e.defeated && frames < 90) {
          g.test.step(1);
          frames += 1;
        }
        g.test.step(40);
        return { defeated: e.defeated, lives: g.state.lives, score: g.state.score, collected: g.coins.filter((c) => c.collected).length };
      });
      // Sekerken yakındaki coin'ler de toplanabilir: her biri tek kez sayılır
      expectedScore += (stomp.collected - run.collected) * 10;
      total.coins += stomp.collected - run.collected;
      expect(stomp).toEqual({ defeated: true, lives: 3, score: expectedScore, collected: stomp.collected });

      // Soru kutuları: iki soru; Seviye 2'de ikinci soru bilerek yanlış cevaplanır
      for (const correct of [true, level !== 2]) {
        await game(page, (i) => {
          const g = window.__MAVI_GAME__;
          g.test.activateBox(g.boxes.find((b) => b.state === "closed"));
        });
        await solve(page, testInfo, profile, correct);
        total.questions += 1;
        if (correct) {
          total.correct += 1;
          expectedScore += 50;
        }
        expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(expectedScore);
      }

      // Boss: arenaya geç; düşen kutuların altına joystick ekseniyle yürü, soruyu çöz, roket boss'u vursun
      await game(page, () => {
        const g = window.__MAVI_GAME__;
        g.player.x = 6480;
        g.player.y = 625 - g.player.h;
        g.player.vy = 0;
        g.player.invuln = 999; // boss ateşi bu senaryoda can düşürmesin (hasar ayrı testlerde)
        for (let i = 0; i < 20 && !g.state.boss.active; i += 1) g.test.step(1);
      });
      expect(await game(page, () => ({ active: window.__MAVI_GAME__.state.boss.active, health: window.__MAVI_GAME__.state.boss.health }))).toEqual({ active: true, health: 6 });
      for (let hit = 1; hit <= 6; hit += 1) {
        const caught = await game(page, () => {
          const g = window.__MAVI_GAME__;
          const p = g.player;
          for (let f = 0; f < 60 * 30; f += 1) {
            if (g.state.currentQuestion) break;
            const box = g.state.boss.fallingBoxes.find((b) => b.state === "closed" && !b.caught);
            const dx = box ? box.x + box.w / 2 - (p.x + p.w / 2) : 0;
            g.touchInput.axis = Math.abs(dx) < 8 ? 0 : Math.sign(dx);
            p.invuln = 999;
            g.test.step(1);
          }
          g.touchInput.axis = 0;
          return Boolean(g.state.currentQuestion && g.state.activeBox && g.state.activeBox.kind === "bossBox");
        });
        expect(caught, `boss kutusu ${hit} yakalanmalı`).toBe(true);
        await solve(page, testInfo, profile, true);
        total.questions += 1;
        total.correct += 1;
        expectedScore += 50;
        const health = await game(page, () => {
          const g = window.__MAVI_GAME__;
          const before = g.state.boss.health;
          for (let f = 0; f < 240 && g.state.boss.health === before; f += 1) g.test.step(1);
          return g.state.boss.health;
        });
        expect(health).toBe(6 - hit);
      }
      expectedScore += 200;

      // Kutlama 3,2 sn; sonra özet (son seviyede Macera Tamamlandı)
      const after = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const peak = { fireworks: 0, particles: 0 };
        for (let f = 0; f < 260 && g.state.bossCelebration !== undefined; f += 1) {
          g.test.step(1);
          peak.fireworks = Math.max(peak.fireworks, g.state.fireworks.length);
          peak.particles = Math.max(peak.particles, g.particleCount);
          if (!g.state.bossCelebration && (g.state.summaryOpen || g.state.gameOver)) break;
        }
        const collected = g.coins.filter((c) => c.collected).length;
        return { score: g.state.score, collected, statCoins: g.state.levelStats.coins, defeated: g.state.boss.defeated, fireworks: g.state.fireworks.length, peak, fwCap: g.visual.fireworkCap(), pCap: g.visual.particleCap() };
      });
      expect(after.defeated).toBe(true);
      // Boss arenasında yürürken arena coin'leri de gerçekten toplanır: her coin tek kez sayılır
      expect(after.statCoins).toBe(after.collected);
      expectedScore += (after.collected - stomp.collected) * 10;
      total.coins += after.collected - stomp.collected;
      expect(after.score, "puan iki kez sayılmamalı").toBe(expectedScore);
      expect(after.fireworks).toBe(0);
      expect(after.peak.fireworks).toBeLessThanOrEqual(after.fwCap);
      expect(after.peak.particles).toBeLessThanOrEqual(after.pCap);

      if (level < 4) {
        await expect(page.locator("#levelSummaryDialog")).toBeVisible();
        await expect(page.locator("#summaryTitle")).toHaveText(`Seviye ${level} — ${def.name}`);
        await expect(page.locator("#summaryScore")).toHaveText(String(expectedScore - levelScoreStart));
        const coinTotal = await game(page, () => window.__MAVI_GAME__.coins.length);
        const levelQuestions = 8;
        const levelCorrect = level === 2 ? 7 : 8;
        await expect(page.locator("#summaryCoins")).toHaveText(`${after.collected} / ${coinTotal}`);
        await expect(page.locator("#summaryAnswers")).toHaveText(`${levelCorrect} / ${levelQuestions}`);
        await expect(page.locator("#summaryAccuracy")).toHaveText(`%${Math.round((levelCorrect / levelQuestions) * 100)}`);
        // Özet açıkken kayıt sonraki bölüme işaret eder (yeniden yükleme ilerlemeyi kaybettirmez)
        expect(await readStore(page, SAVE_KEY)).toMatchObject({ level: level + 1, score: expectedScore, totalStats: total });
        await game(page, () => window.__MAVI_GAME__.test.setManualStep(false));
        await press(page, "#nextLevelButton", testInfo);
        await expect(page.locator("#levelSummaryDialog")).toBeHidden();
      }
    }

    // Final
    const result = page.locator("#gameOverDialog");
    await expect(result).toBeVisible();
    await expect(page.locator("#resultKicker")).toHaveText("Tebrikler");
    await expect(page.locator("#resultTitle")).toHaveText("Macera Tamamlandı");
    await expect(page.locator("#finalScore")).toHaveText(String(expectedScore));
    const accuracy = Math.round((total.correct / total.questions) * 100);
    await expect(page.locator("#resultStats")).toHaveText(`Genel doğruluk: %${accuracy} (${total.correct}/${total.questions}) · Coin: ${total.coins}`);
    await expect(page.locator("#restartButton")).toHaveText("Yeniden Oyna");
    testInfo.annotations.push({ type: "sonuç", description: `skor ${expectedScore}, doğruluk %${accuracy} (${total.correct}/${total.questions}), coin ${total.coins}` });
    expect(await game(page, (k) => localStorage.getItem(k), SAVE_KEY), "final: devam kaydı silinmeli").toBeNull();
    // HTML gibi görünen ad metin olarak gösterilir
    await expect(page.locator("#highScoresList img")).toHaveCount(0);
    await expect(page.locator("#highScoresList")).toContainText("<img src=x onerror=alert(1)> (S1)");

    await page.locator("#playerNameInput").fill("Ada <b>");
    await game(page, () => window.__MAVI_GAME__.test.setManualStep(false));
    await press(page, "#restartButton", testInfo);
    await expect(result).toBeHidden();

    const scores = await readStore(page, SCORES_KEY);
    expect(scores.map((s) => [s.name, s.score, s.level])).toEqual(
      [["Deniz", 3000, 4], ["Ada <b>", expectedScore, 4], ["<img src=x onerror=alert(1)>", 5, 1]].sort((a, b) => b[1] - a[1])
    );

    // Yeniden oynama: Seviye 1, skor 0, yeni bölüm kaydı
    await expect(page.locator("#levelIntroTitle")).toHaveText(`Seviye 1 — ${data.levels[0].name}`);
    const replay = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { level: g.state.level, score: g.state.score, lives: g.state.lives, total: { ...g.state.totalStats }, x: g.player.x, gameOver: g.state.gameOver };
    });
    expect(replay).toEqual({ level: 1, score: 0, lives: 3, total: { coins: 0, questions: 0, correct: 0 }, x: data.start.x, gameOver: false });
    expect(await readStore(page, SAVE_KEY)).toMatchObject({ level: 1, score: 0, totalStats: { coins: 0, questions: 0, correct: 0 } });
    await press(page, "#levelIntro", testInfo);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);

    // Bütün istekler aynı kaynaktan ve yalnızca GET (ad veya skor hiçbir yere gönderilmez)
    const foreign = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith("data:"));
    expect(foreign, "dış kaynağa istek olmamalı").toEqual([]);
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
    expect(requests.some((r) => r.url.includes("Ada"))).toBe(false);
  });
});

/* ---------- Kesinti dayanıklılığı ---------- */

const SETTINGS_KEY = "mavi-matematik-settings";
const SOUND_KEY = "mavi-matematik-sound";
const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== "masaustu-1440x900", "Tek projede yeterli");

// Chromium'da sekme gizleme gerçek olarak tetiklenemez; document.hidden ve visibilitychange taklit edilir.
async function setHidden(page, hidden) {
  await page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    if (h) window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function dismissIntro(page) {
  await expect(page.locator("#levelIntro")).toBeVisible();
  await page.locator("#levelIntro").click();
  await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
}

async function continueFromStart(page) {
  await expect(page.locator("#continueButton")).toBeVisible();
  await page.locator("#continueButton").click();
  await dismissIntro(page);
}

async function answerOpenQuestion(page, correct = true) {
  const answer = await game(page, () => window.__MAVI_GAME__.state.currentQuestion.answer);
  await page.locator("#answerInput").fill(String(correct ? answer : answer + 1));
  await page.locator("#answerInput").press("Enter");
  await expect(page.locator("#questionDialog")).toBeHidden();
}

// Bölümü kısayolla bitirir (boss 6 vuruş) ve kutlamayı adımlar.
async function finishLevelQuick(page) {
  await game(page, () => {
    const g = window.__MAVI_GAME__;
    g.player.invuln = 999;
    g.player.x = 6480;
    g.player.y = 625 - g.player.h;
    g.test.setManualStep(true);
    g.test.step(5);
    for (let i = 0; i < 6; i += 1) g.test.damageBoss();
    g.test.step(260);
    g.test.setManualStep(false);
  });
}

// Oyuncu hiçbir şeye dokunmadan beklerken puan ve coin değişmemeli
async function expectIdleStable(page, ms = 1500) {
  const before = await game(page, () => ({ score: window.__MAVI_GAME__.state.score, coins: window.__MAVI_GAME__.coins.filter((c) => c.collected).length, x: window.__MAVI_GAME__.player.x }));
  await page.waitForTimeout(ms);
  const after = await game(page, () => ({ score: window.__MAVI_GAME__.state.score, coins: window.__MAVI_GAME__.coins.filter((c) => c.collected).length, x: window.__MAVI_GAME__.player.x }));
  expect(after).toEqual(before);
}

test.describe("Kesinti dayanıklılığı", () => {
  test("bölüm ortasında yenileme: Devam Et bölüm başına döner, puan iki kez sayılmaz, coin kendiliğinden toplanmaz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, level: 2, score: 270, totalStats: { coins: 2, questions: 2, correct: 1 }, savedAt: "2026-09-20T10:00:00Z" })), SAVE_KEY);
    await page.reload();
    await continueFromStart(page);
    // Bölüm ortası ilerleme: coin + doğru cevap
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.test.setManualStep(true);
      g.touchInput.axis = 1;
      g.test.step(50);
      g.touchInput.axis = 0;
      g.test.step(5);
      g.test.setManualStep(false);
    });
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await answerOpenQuestion(page);
    const mid = await game(page, () => window.__MAVI_GAME__.state.score);
    expect(mid).toBeGreaterThan(270 + 50);
    expect(await readStore(page, SAVE_KEY)).toMatchObject({ level: 2, score: 270, totalStats: { coins: 2, questions: 2, correct: 1 } });

    await page.reload();
    await expect(page.locator("#saveInfoLevel")).toContainText("Seviye 2");
    await continueFromStart(page);
    const st = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { level: g.state.level, score: g.state.score, total: { ...g.state.totalStats }, collected: g.coins.filter((c) => c.collected).length, used: g.boxes.filter((b) => b.state !== "closed").length, x: g.player.x };
    });
    expect(st).toEqual({ level: 2, score: 270, total: { coins: 2, questions: 2, correct: 1 }, collected: 0, used: 0, x: await game(page, () => window.__MAVI_GAME__.levelData.start.x) });
    await expectIdleStable(page);
  });

  test("soru açıkken arka plana alma: soru ve süre korunur, cevap tek kez sayılır, giriş takılmaz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1&autostart=1");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    await page.keyboard.down("KeyD");
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await expect(page.locator("#questionDialog")).toBeVisible();
    await setHidden(page, true);
    const t0 = await game(page, () => window.__MAVI_GAME__.state.questionTimer);
    await page.waitForTimeout(1200);
    const t1 = await game(page, () => window.__MAVI_GAME__.state.questionTimer);
    expect(t0 - t1, "arka planda soru süresi akmamalı").toBeLessThan(0.05);
    // Soru açıkken duraklatma menüsü üstüne binmez; soru olduğu gibi kalır
    await expect(page.locator("#menuDialog")).toBeHidden();
    await setHidden(page, false);
    await expect(page.locator("#questionDialog")).toBeVisible();
    await answerOpenQuestion(page);
    await page.keyboard.up("KeyD");
    expect(await game(page, () => ({ score: window.__MAVI_GAME__.state.score, stats: { ...window.__MAVI_GAME__.state.levelStats } }))).toMatchObject({ score: 50, stats: { questions: 1, correct: 1 } });
    // KeyD soru sırasında bırakıldı: oyuncu kendi kendine yürümez
    await expectIdleStable(page, 800);
  });

  test("arka plandan dönüşte büyük zaman sıçraması olmaz (tek karede en fazla 1/30 sn)", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1&autostart=1");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    const moved = await game(page, async () => {
      const g = window.__MAVI_GAME__;
      g.touchInput.axis = 1;
      await new Promise((r) => requestAnimationFrame(r));
      const x0 = g.player.x;
      g.state.lastTime = performance.now() - 30000; // 30 sn arka planda kalmış gibi
      await new Promise((r) => requestAnimationFrame(r));
      const x1 = g.player.x;
      g.touchInput.axis = 0;
      return { dx: x1 - x0, max: g.test.moveSpeed / 30 };
    });
    expect(moved.dx).toBeGreaterThanOrEqual(0);
    expect(moved.dx).toBeLessThanOrEqual(moved.max + 0.5);
  });

  test("duraklatılmışken kapatıp açma: kayıt ve ayarlar korunur, oyun bölüm başından sürer", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    await dismissIntro(page);
    await page.locator("#pauseButton").click();
    await page.locator('[data-panel="pause"] [data-open-panel="settings"]').click();
    await page.locator('[data-motion="reduced"]').click();
    await page.keyboard.press("Escape");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.currentPanel())).toBe("pause");
    await page.reload();
    expect(await readStore(page, SETTINGS_KEY)).toMatchObject({ version: 1, motion: "reduced" });
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    await continueFromStart(page);
    expect(await game(page, () => ({ paused: window.__MAVI_GAME__.state.menuPaused, level: window.__MAVI_GAME__.state.level, score: window.__MAVI_GAME__.state.score }))).toEqual({ paused: false, level: 1, score: 0 });
  });

  test("boss sırasında arka plana alma: oyun duraklar, boss donar, can kaybı olmaz; Devam ile sürer", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1&autostart=1&level=2");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.x = 6480;
      g.player.y = 625 - g.player.h;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
    await page.waitForTimeout(600);
    await setHidden(page, true);
    await expect(page.locator("#menuDialog")).toBeVisible();
    const snap = () => game(page, () => {
      const g = window.__MAVI_GAME__;
      return { lives: g.state.lives, health: g.state.boss.health, fires: g.state.boss.fires.map((f) => Math.round(f.x)), boxes: g.state.boss.fallingBoxes.map((b) => Math.round(b.y)), px: g.player.x };
    });
    const s0 = await snap();
    await setHidden(page, false);
    await page.waitForTimeout(1000);
    // Dönüşte oyun kendiliğinden başlamaz: çocuk Devam'a basana kadar her şey donuk
    expect(await snap()).toEqual(s0);
    expect(await game(page, () => window.__MAVI_GAME__.test.currentPanel())).toBe("pause");
    await page.locator("#resumeButton").click();
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
    expect(await game(page, () => ({ keys: window.__MAVI_GAME__.touchInput.axis, lives: window.__MAVI_GAME__.state.lives, active: window.__MAVI_GAME__.state.boss.active }))).toEqual({ keys: 0, lives: s0.lives, active: true });
  });

  test("özet açıkken yeniden yükleme: tamamlanan bölüm kaybolmaz, puan iki kez sayılmaz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    await dismissIntro(page);
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await answerOpenQuestion(page);
    await finishLevelQuick(page);
    await expect(page.locator("#levelSummaryDialog")).toBeVisible();
    const done = await game(page, () => ({ score: window.__MAVI_GAME__.state.score, total: { ...window.__MAVI_GAME__.state.totalStats } }));
    expect(done.score).toBe(250);
    await page.reload();
    await expect(page.locator("#saveInfoLevel")).toContainText("Seviye 2");
    await continueFromStart(page);
    const st = await game(page, () => ({ level: window.__MAVI_GAME__.state.level, score: window.__MAVI_GAME__.state.score, total: { ...window.__MAVI_GAME__.state.totalStats } }));
    expect(st).toEqual({ level: 2, score: done.score, total: done.total });
    // Özet yeniden açılmaz, Seviye 2'nin sonunda puan bir kez eklenir
    await finishLevelQuick(page);
    await expect(page.locator("#summaryScore")).toHaveText("200");
    expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(done.score + 200);
  });

  for (const [mode, label] of [["disabled", "kapalı (erişim hatası)"], ["full", "dolu (kota hatası)"]]) {
    test(`localStorage ${label}: oyun açılır, oynanır, skor kaydı nazikçe başarısız olur`, async ({ page, consoleErrors }, testInfo) => {
      desktopOnly(testInfo);
      await page.addInitScript((m) => {
        if (m === "disabled") {
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
              throw new DOMException("Depolama kapalı", "SecurityError");
            }
          });
        } else {
          Storage.prototype.setItem = function () {
            throw new DOMException("Kota doldu", "QuotaExceededError");
          };
        }
      }, mode);
      await page.goto("./?nosw=1");
      await expect(page.locator("#continueButton")).toBeHidden();
      await page.locator("#startButton").click();
      await dismissIntro(page);
      // Ayar değişikliği bu oturumda uygulanır
      await page.locator("#pauseButton").click();
      await page.locator('[data-panel="pause"] [data-open-panel="settings"]').click();
      await page.locator('[data-motion="reduced"]').click();
      await expect(page.locator("html")).toHaveClass(/reduce-motion/);
      await page.keyboard.press("Escape");
      await page.locator("#resumeButton").click();
      await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
      await answerOpenQuestion(page);
      await game(page, () => {
        const g = window.__MAVI_GAME__;
        for (let i = 0; i < 3; i += 1) {
          g.player.invuln = 0;
          g.test.hurtPlayer(false);
        }
      });
      await expect(page.locator("#gameOverDialog")).toBeVisible();
      await expect(page.locator("#highScoresList")).toHaveText("Henüz skor yok");
      await page.locator("#gameOverMenuButton").click();
      await expect(page.locator("#savedScoreStatus")).toHaveText("Skor kaydedilemedi.");
      await expect(page.locator("#startDialog")).toBeVisible();
      await expect(page.locator("#continueButton")).toBeHidden();
    });
  }

  test("bozuk top-10, ayar ve kayıt verisi: oyun çökmez, geçerli veriyle üzerine yazılır", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.evaluate((k) => {
      localStorage.setItem(k.scores, "{bozuk");
      localStorage.setItem(k.settings, "[]");
      localStorage.setItem(k.save, "null");
    }, { scores: SCORES_KEY, settings: SETTINGS_KEY, save: SAVE_KEY });
    await page.reload();
    await expect(page.locator("#continueButton")).toBeHidden();
    await page.locator("#startButton").click();
    await dismissIntro(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      for (let i = 0; i < 3; i += 1) {
        g.player.invuln = 0;
        g.test.hurtPlayer(false);
      }
    });
    await expect(page.locator("#highScoresList")).toHaveText("Henüz skor yok");
    await page.locator("#playerNameInput").fill("Ece");
    await page.locator("#restartButton").click();
    const scores = await readStore(page, SCORES_KEY);
    expect(scores).toHaveLength(1);
    expect(scores[0]).toMatchObject({ name: "Ece", score: 0, level: 1 });
  });

  test("1.2.x kayıt, ayar ve top-10 verisi 1.3 sürümünde aynen okunur", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    // 1.2.2'nin yazdığı biçim; top-10'da tarih ve seviye alanı olmayan daha eski kayıt da var
    await page.evaluate((k) => {
      localStorage.setItem(k.save, JSON.stringify({ version: 1, level: 3, score: 900, totalStats: { coins: 40, questions: 14, correct: 12 }, savedAt: "2026-09-25T10:00:00.000Z" }));
      localStorage.setItem(k.settings, JSON.stringify({ version: 1, sound: false, motion: "reduced" }));
      localStorage.setItem(k.sound, "off");
      localStorage.setItem(k.scores, JSON.stringify([{ name: "Eski", score: 400 }, { name: "Ayşe", score: 1200, level: 4, date: "2026-09-10T10:00:00.000Z" }]));
    }, { save: SAVE_KEY, settings: SETTINGS_KEY, sound: SOUND_KEY, scores: SCORES_KEY });
    const stored = await page.evaluate(() => ({ ...localStorage }));
    await page.reload();
    await expect(page.locator("#saveInfoLevel")).toHaveText("Seviye 3 — Gün Batımı Kanyonu");
    await expect(page.locator("html")).toHaveClass(/sound-muted/);
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    // Açılış hiçbir veriyi değiştirmez
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(stored);
    await continueFromStart(page);
    expect(await game(page, () => ({ level: window.__MAVI_GAME__.state.level, score: window.__MAVI_GAME__.state.score }))).toEqual({ level: 3, score: 900 });
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      for (let i = 0; i < 3; i += 1) {
        g.player.invuln = 0;
        g.test.hurtPlayer(false);
      }
    });
    await expect(page.locator("#highScoresList li")).toHaveText(["Ayşe (S4)1200", "Eski (S1)400"]);
  });
});

/* ---------- Erişilebilirlik ve çocuk kullanımı ---------- */

// Görünür etkileşimli öğeler: erişilebilir ad, en az 48x48 hedef
function auditControls(scopeSelector) {
  const scope = document.querySelector(scopeSelector) || document;
  const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && !el.closest("[hidden]"); };
  const nameOf = (el) => {
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    const by = el.getAttribute("aria-labelledby");
    if (by) return by.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || "").join(" ").trim();
    if (el.labels && el.labels.length) return el.labels[0].textContent.trim();
    return el.textContent.trim();
  };
  return [...scope.querySelectorAll("button, input, [role=radio]")].filter(visible).map((el) => {
    const b = el.getBoundingClientRect();
    return { id: el.id || el.className, name: nameOf(el), w: Math.round(b.width), h: Math.round(b.height) };
  });
}

test.describe("Erişilebilirlik ve çocuk kullanımı", () => {
  test("başlangıç, oyun, soru, duraklatma, ayarlar ve final: her kontrolün adı var ve en az 48x48", async ({ page, consoleErrors }, testInfo) => {
    test.skip(!["masaustu-1440x900", "telefon-844x390"].includes(testInfo.project.name), "Masaüstü ve yatay telefon");
    const tap = (sel) => press(page, sel, testInfo);
    const check = async (scope, label) => {
      const list = await page.evaluate(auditControls, scope);
      expect(list.length, `${label}: kontrol bulunmalı`).toBeGreaterThan(0);
      for (const c of list) {
        expect(c.name, `${label}: ${c.id} adı`).not.toBe("");
        expect(Math.min(c.w, c.h), `${label}: ${c.name} ${c.w}x${c.h}`).toBeGreaterThanOrEqual(48);
      }
    };
    await page.goto("./?nosw=1");
    await check("#startDialog", "başlangıç");
    await tap("#startButton");
    await tap("#levelIntro");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
    await check(".game-shell", "oyun");
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await check("#questionDialog", "soru");
    expect(await game(page, () => document.querySelector(".stage").inert)).toBe(true);
    await game(page, () => window.__MAVI_GAME__.test.dismissQuestion());
    await tap("#pauseButton");
    await check("#menuDialog", "duraklatma");
    await tap('[data-panel="pause"] [data-open-panel="settings"]');
    await check("#menuDialog", "ayarlar");
    await page.keyboard.press("Escape");
    await tap("#resumeButton");
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      for (let i = 0; i < 3; i += 1) {
        g.player.invuln = 0;
        g.test.hurtPlayer(false);
      }
    });
    await check("#gameOverDialog", "oyun sonu");
  });

  test("klavye odağı her kontrolde görünür", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    const seen = new Set();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return { id: el.id || el.textContent.trim(), ring: (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none" };
      });
      seen.add(f.id);
      expect(f.ring, `${f.id} odak halkası`).toBe(true);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test("ses kapalıyken bilgi kaybolmaz: yanlış cevap, hasar ve boss yazıyla da gösterilir", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.goto("./?nosw=1");
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, sound: false, motion: null })), SETTINGS_KEY);
    await page.goto("./?nosw=1&autostart=1&level=2");
    await expect(page.locator("html")).toHaveClass(/sound-muted/);
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await answerOpenQuestion(page, false);
    await expect(page.locator("#questionFeedback")).toContainText("Bu sefer olmadı");
    await game(page, () => window.__MAVI_GAME__.test.hurtPlayer(false));
    await expect(page.locator("#toast")).toHaveText("Dikkat!");
    await expect(page.locator("#lives")).toHaveAttribute("aria-label", "2 kalp");
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.invuln = 999;
      g.player.x = 6480;
      g.player.y = 625 - g.player.h;
    });
    await expect(page.locator("#toast")).toHaveText("Büyük canavar!");
    expect(await game(page, () => window.__MAVI_GAME__.test.audioContextCreated())).toBe(false);
  });

  test("Türkçe geri bildirim metinleri kısa ve suçlayıcı değil", async ({ request }, testInfo) => {
    desktopOnly(testInfo);
    const src = await (await request.get("./game.js")).text();
    for (const harsh of ["Yanlış cevap", "Puan yok", "Başarısız", "Kaybettin"]) expect(src).not.toContain(harsh);
    expect(src).toContain("Sıradakini yaparsın!");
  });
});
