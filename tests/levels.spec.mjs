// Sprint 3B: seviye verisi, rota erişilebilirliği, matematik profilleri, seviye akışı ve sesler.
import { test as base, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadLevelData, validateLevels, geometrySignature } from "../tools/level-validator.mjs";
import { runRouteInPage, runBoxesInPage } from "./route-runner.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = loadLevelData(join(ROOT, "level-data.js"));
const NAMES = ["Matematik Bahçesi", "Sisli Vadi", "Gün Batımı Kanyonu", "Ayışığı Zirvesi"];

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
const desktopOnly = (testInfo) => test.skip(testInfo.project.name !== "masaustu-1440x900", "Veri/motor testi tek projede çalışır");
const game = (page, fn, arg) => page.evaluate(fn, arg);

async function openLevel(page, level, extra = "") {
  await page.goto(`./?nosw=1&autostart=1&level=${level}${extra}`);
  await expect.poll(() => game(page, () => window.__MAVI_GAME__ && window.__MAVI_GAME__.player.grounded)).toBe(true);
}

// Boss'u gerçek mekanikle yener ve kutlamayı elle adımlayarak hızlandırır.
async function beatBossAndFinishCelebration(page) {
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

test.describe("Seviye verisi (statik doğrulama)", () => {
  test("şema, dünya sınırları, yerleşimler ve ana rota tahmini geçerli", ({}, testInfo) => {
    desktopOnly(testInfo);
    const { errors, stats } = validateLevels(DATA);
    expect(errors).toEqual([]);
    expect(stats.map((s) => s.name)).toEqual(NAMES);
  });

  test("dört seviyenin geometrisi gerçekten farklı", ({}, testInfo) => {
    desktopOnly(testInfo);
    const sigs = DATA.levels.map(geometrySignature);
    expect(new Set(sigs).size).toBe(4);
    for (let a = 0; a < 4; a += 1) {
      for (let b = a + 1; b < 4; b += 1) {
        const A = new Set(DATA.levels[a].platforms.map((p) => p.join(",")));
        const shared = DATA.levels[b].platforms.filter((p) => A.has(p.join(","))).length;
        expect(shared, `seviye ${a + 1} ve ${b + 1} ortak platform`).toBeLessThanOrEqual(1);
        expect(JSON.stringify(DATA.levels[a].coins)).not.toBe(JSON.stringify(DATA.levels[b].coins));
        expect(JSON.stringify(DATA.levels[a].boxes)).not.toBe(JSON.stringify(DATA.levels[b].boxes));
        expect(JSON.stringify(DATA.levels[a].enemies)).not.toBe(JSON.stringify(DATA.levels[b].enemies));
      }
    }
  });

  test("doğrulayıcı hatalı veriyi yakalar (negatif kontrol)", ({}, testInfo) => {
    desktopOnly(testInfo);
    const broken = structuredClone(DATA);
    broken.levels[0].platforms[1][0] += 900; // ana rotada kapatılamayacak boşluk
    broken.levels[1].boxes[0][1] = 590; // kutu platformun içine
    broken.levels[2].enemies[0][2] = 100; // düşman başlangıç bölgesinde
    const { errors } = validateLevels(broken);
    expect(errors.some((e) => e.startsWith("Seviye 1") && e.includes("rota"))).toBe(true);
    expect(errors.some((e) => e.startsWith("Seviye 2") && e.includes("kutu"))).toBe(true);
    expect(errors.some((e) => e.startsWith("Seviye 3") && e.includes("düşman"))).toBe(true);
  });
});

test.describe("Seviyeler oyunda", () => {
  for (const level of [1, 2, 3, 4]) {
    test(`Seviye ${level}: veri yüklenir, başlangıç güvenli, boss arenası aynı ve boş`, async ({ page, consoleErrors }, testInfo) => {
      desktopOnly(testInfo);
      await openLevel(page, level);
      const info = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const arena = g.platforms[g.platforms.length - 1];
        const foot = g.player.y + g.player.h;
        return {
          level: g.state.level,
          platforms: g.platforms.length,
          coins: g.coins.length,
          boxes: g.boxes.length,
          enemies: g.enemies.length,
          arena: [arena.x, arena.y, arena.w, arena.h],
          startFoot: foot,
          startX: g.player.x,
          arenaEnemies: g.enemies.filter((e) => e.maxX > 6420).length,
          arenaBoxes: g.boxes.filter((b) => b.x + b.w > 6420).length,
          nearbyEnemy: g.enemies.some((e) => e.minX < 700)
        };
      });
      const def = DATA.levels[level - 1];
      expect(info.level).toBe(level);
      expect(info.platforms).toBe(def.platforms.length + 1);
      expect(info.boxes).toBe(def.boxes.length);
      expect(info.enemies).toBe(def.enemies.length);
      expect(info.arena).toEqual([6420, 625, 1080, 95]);
      expect(info.startFoot).toBe(635);
      expect(info.startX).toBe(90);
      expect(info.arenaEnemies).toBe(0);
      expect(info.arenaBoxes).toBe(0);
      expect(info.nearbyEnemy).toBe(false);
      // Boss debug URL'si bu seviyede çalışır
      await page.goto(`./?nosw=1&autostart=1&boss=1&level=${level}`);
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
      expect(await game(page, () => window.__MAVI_GAME__.state.level)).toBe(level);
    });

    test(`Seviye ${level}: ana rota oyunun gerçek fiziğiyle baştan boss arenasına tamamlanır`, async ({ page, consoleErrors }, testInfo) => {
      desktopOnly(testInfo);
      await openLevel(page, level);
      const results = await page.evaluate(runRouteInPage, level);
      expect(results.length).toBe(DATA.levels[level - 1].route.length - 1);
      const failed = results.filter((r) => !r.ok).map((r) => `${r.from}→${r.to}`);
      expect(failed, "başarısız rota adımları").toEqual([]);
    });

    test(`Seviye ${level}: bütün soru kutuları altından zıplanarak açılabilir`, async ({ page, consoleErrors }, testInfo) => {
      desktopOnly(testInfo);
      await openLevel(page, level);
      const results = await page.evaluate(runBoxesInPage);
      expect(results.filter((r) => !r.hit).map((r) => r.box)).toEqual([]);
    });
  }

  test("rota koşucusu imkânsız adımı yakalar (negatif kontrol)", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await openLevel(page, 1);
    const results = await page.evaluate(() => {
      // Platform 1'i 700 px uzağa taşı: 0→1 adımı imkânsız olmalı
      window.__MAVI_GAME__.platforms[1].x += 700;
      return null;
    });
    expect(results).toBeNull();
    const r = await page.evaluate(runRouteInPage, 1);
    expect(r[0]).toMatchObject({ from: 0, to: 1, ok: false });
  });
});

test.describe("Matematik profilleri", () => {
  // Seviye başına 3000 deterministik soru
  async function sample(page, level, n = 3000) {
    return game(
      page,
      ({ level, n }) => {
        const T = window.__MAVI_GAME__.test;
        T.setQuestionSeed(1234 + level);
        const out = [];
        for (let i = 0; i < n; i += 1) out.push(T.generateQuestion(level));
        T.setQuestionSeed(null);
        return out;
      },
      { level, n }
    );
  }

  const parse = (q) => {
    const m = q.text.match(/^(\d+) ([+\-×]) (\d+)$/);
    return { a: Number(m[1]), op: m[2], b: Number(m[3]) };
  };

  test("seviyeye göre işlem, sınır ve çarpma oranı; negatif sonuç ve art arda tekrar yok", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await openLevel(page, 1);
    const expectations = {
      1: { mulRatio: [0, 0], maxAdd: 20, maxSub: 20, factors: [] },
      2: { mulRatio: [0.07, 0.17], maxAdd: 100, maxSub: 100, factors: [2, 5] },
      3: { mulRatio: [0.3, 0.4], maxAdd: 100, maxSub: 100, factors: [2, 3, 4, 5, 6, 7, 8, 9] },
      4: { mulRatio: [0.4, 0.5], maxAdd: 100, maxSub: 100, factors: [2, 3, 4, 5, 6, 7, 8, 9] }
    };
    for (const level of [1, 2, 3, 4]) {
      const qs = await sample(page, level);
      const exp = expectations[level];
      // Kurallar tek geçişte toplanır; ihlaller listelenir (binlerce ayrı expect yavaş olur)
      let mul = 0;
      const violations = [];
      for (let i = 0; i < qs.length; i += 1) {
        const q = qs[i];
        const { a, op, b } = parse(q);
        if (q.answer < 0) violations.push(`negatif: ${q.text}`);
        if (String(q.answer).length > 4) violations.push(`4 basamaktan uzun: ${q.text}`);
        if (op === "+") {
          if (q.answer !== a + b) violations.push(`yanlış cevap: ${q.text}`);
          if (q.answer > exp.maxAdd) violations.push(`toplam sınırı aşıldı: ${q.text}`);
        } else if (op === "-") {
          if (q.answer !== a - b) violations.push(`yanlış cevap: ${q.text}`);
          if (a > exp.maxSub) violations.push(`çıkarma sınırı: ${q.text}`);
          if (q.answer <= 0) violations.push(`sıfır/negatif fark: ${q.text}`);
        } else {
          mul += 1;
          if (q.answer !== a * b) violations.push(`yanlış cevap: ${q.text}`);
          if (!(exp.factors.includes(a) || exp.factors.includes(b))) violations.push(`çarpan profilde yok: ${q.text}`);
          if (Math.max(a, b) > 10) violations.push(`çarpan büyük: ${q.text}`);
        }
        if (i > 0 && q.text === qs[i - 1].text) violations.push(`art arda tekrar: ${q.text}`);
      }
      expect(violations.slice(0, 10), `seviye ${level} ihlaller`).toEqual([]);
      const ratio = mul / qs.length;
      expect(ratio, `seviye ${level} çarpma oranı`).toBeGreaterThanOrEqual(exp.mulRatio[0]);
      expect(ratio, `seviye ${level} çarpma oranı`).toBeLessThanOrEqual(exp.mulRatio[1]);
    }
  });

  test("tohumlu üretim deterministik", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await openLevel(page, 3);
    const a = await sample(page, 3, 50);
    const b = await sample(page, 3, 50);
    expect(a).toEqual(b);
  });

  test("boss soruları o seviyenin profilini kullanır", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    for (const level of [1, 2]) {
      await page.goto(`./?nosw=1&autostart=1&boss=1&level=${level}`);
      await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
      const qs = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const out = [];
        for (let i = 0; i < 40; i += 1) {
          const box = { kind: "bossBox", x: 6600, y: 300, w: 54, h: 54, vy: 0, state: "closed", question: null, bump: 0, caught: false };
          g.state.boss.fallingBoxes.push(box);
          g.test.activateBox(box);
          out.push({ ...g.state.currentQuestion });
          g.test.dismissQuestion();
        }
        return out;
      });
      for (const q of qs) {
        if (level === 1) {
          expect(q.text).not.toContain("×");
          expect(q.answer).toBeLessThanOrEqual(20);
        } else {
          const m = q.text.match(/^(\d+) × (\d+)$/);
          if (m) expect([Number(m[1]), Number(m[2])].some((f) => f === 2 || f === 5)).toBe(true);
          expect(q.answer).toBeLessThanOrEqual(100);
        }
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe("Seviye tanıtımı", () => {
  test("başlık ve matematik odağı; girdiler temizlenir, oyun beklemede kalır", async ({ page, consoleErrors }, testInfo) => {
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    const intro = page.locator("#levelIntro");
    await expect(intro).toBeVisible();
    await expect(page.locator("#levelIntroTitle")).toHaveText("Seviye 1 — Matematik Bahçesi");
    await expect(page.locator("#levelIntroFocus")).toHaveText("Toplama ve çıkarma · Sonuçlar 20’ye kadar");
    expect(await game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(false);
    if (isTouchProject(testInfo)) await expect(page.locator("#touchControls")).toHaveClass(/is-disabled/);
    // Tanıtım sırasında basılan hareket tuşu sonrasına taşınmaz
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(300);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);
    // Kendiliğinden kapanır (en fazla ~2 sn)
    await expect(intro).toBeHidden({ timeout: 2600 });
    await page.waitForTimeout(250);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);
    await page.keyboard.up("KeyD");
    expect(await game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
  });

  test("dokunarak veya Enter ile geçilir; mobil kontrollerle çakışmaz", async ({ page, consoleErrors }, testInfo) => {
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    const card = await page.locator(".level-intro-card").boundingBox();
    if (isTouchProject(testInfo)) {
      for (const sel of [".joystick-base", '[data-action="jump"]']) {
        const b = await page.locator(sel).boundingBox();
        const overlap = card.x < b.x + b.width && card.x + card.width > b.x && card.y < b.y + b.height && card.y + card.height > b.y;
        expect(overlap, `tanıtım kartı ${sel} ile çakışmamalı`).toBe(false);
      }
      await page.locator("#levelIntro").tap();
    } else {
      await page.keyboard.press("Enter");
    }
    await expect(page.locator("#levelIntro")).toBeHidden();
    expect(await game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
  });

  test("hareket azaltma açıkken animasyonsuz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    const duration = await page.locator(".level-intro-card").evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(duration).toBeLessThan(0.01);
  });
});

test.describe("İstatistikler, özet ve final", () => {
  test("seviye istatistikleri, özet ekranı ve sonraki seviyeye geçiş", async ({ page, consoleErrors }, testInfo) => {
    await openLevel(page, 1);
    // İki coin topla
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.coins[0].x = g.player.x;
      g.coins[0].y = g.player.y + 20;
      g.coins[1].x = g.player.x + 10;
      g.coins[1].y = g.player.y + 40;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.levelStats.coins)).toBe(2);
    // Bir doğru, bir yanlış cevap
    for (const correct of [true, false]) {
      const answer = await game(page, () => {
        const g = window.__MAVI_GAME__;
        const box = g.boxes.find((b) => b.state === "closed");
        g.test.activateBox(box);
        return g.state.currentQuestion.answer;
      });
      await game(page, (v) => {
        const input = document.getElementById("answerInput");
        input.readOnly = false;
        input.value = String(v);
      }, correct ? answer : answer + 1);
      await page.locator("#answerButton").click();
      await expect(page.locator("#questionDialog")).toBeHidden();
    }
    const stats = await game(page, () => ({ ...window.__MAVI_GAME__.state.levelStats }));
    expect(stats).toMatchObject({ coins: 2, questions: 2, correct: 1, scoreStart: 0 });

    await beatBossAndFinishCelebration(page);
    const summary = page.locator("#levelSummaryDialog");
    await expect(summary).toBeVisible();
    await expect(page.locator("#summaryTitle")).toHaveText("Seviye 1 — Matematik Bahçesi");
    // 2 coin (20) + 1 doğru cevap (50) + boss (200)
    await expect(page.locator("#summaryScore")).toHaveText("270");
    await expect(page.locator("#summaryCoins")).toHaveText(/^2 \/ \d+$/);
    await expect(page.locator("#summaryAnswers")).toHaveText("1 / 2");
    await expect(page.locator("#summaryAccuracy")).toHaveText("%50");
    await expect(page.locator("#nextLevelButton")).toBeInViewport({ ratio: 1 });
    // Esc özeti kapatmaz
    await page.keyboard.press("Escape");
    await expect(summary).toBeVisible();

    await page.locator("#nextLevelButton").click();
    await expect(summary).toBeHidden();
    await expect(page.locator("#levelIntroTitle")).toHaveText("Seviye 2 — Sisli Vadi");
    await expect(page.locator("#levelIntroFocus")).toHaveText("100’e kadar toplama ve çıkarma · 2 ve 5 ile çarpma");
    const next = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { level: g.state.level, lives: g.state.lives, stats: { ...g.state.levelStats }, first: [g.platforms[1].x, g.platforms[1].y], score: g.state.score };
    });
    expect(next.level).toBe(2);
    expect(next.lives).toBe(3);
    expect(next.first).toEqual([DATA.levels[1].platforms[1][0], DATA.levels[1].platforms[1][1]]);
    expect(next.stats).toMatchObject({ coins: 0, questions: 0, correct: 0, scoreStart: 270 });
    expect(next.score).toBe(270);
  });

  test("son seviye: Macera Tamamlandı, toplam skor ve genel doğruluk; skor kaydı ve yeniden oynama", async ({ page, consoleErrors }) => {
    await openLevel(page, 4);
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
    await beatBossAndFinishCelebration(page);
    const dlg = page.locator("#gameOverDialog");
    await expect(dlg).toBeVisible();
    await expect(page.locator("#resultTitle")).toHaveText("Macera Tamamlandı");
    await expect(page.locator("#finalScore")).toHaveText("250");
    await expect(page.locator("#resultStats")).toContainText("Genel doğruluk: %100 (1/1)");
    await expect(page.locator("#restartButton")).toHaveText("Yeniden Oyna");
    await expect(page.locator("#levelSummaryDialog")).toBeHidden();
    await page.locator("#restartButton").click();
    await expect(dlg).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mavi-matematik-high-scores")));
    expect(saved[0]).toMatchObject({ score: 250, level: 4 });
    await expect(page.locator("#levelIntroTitle")).toHaveText("Seviye 1 — Matematik Bahçesi");
    const st = await game(page, () => ({ level: window.__MAVI_GAME__.state.level, score: window.__MAVI_GAME__.state.score, total: { ...window.__MAVI_GAME__.state.totalStats } }));
    expect(st).toEqual({ level: 1, score: 0, total: { coins: 0, questions: 0, correct: 0 } });
  });
});

test.describe("Güvenlik ve ses", () => {
  test("çukura düşünce can gider ve son güvenli zemine dönülür", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await openLevel(page, 4);
    // Başlangıç zemininde yürü (güvenli nokta kaydedilir), sonra çukurun üstüne taşı
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyD");
    const safe = await game(page, () => ({ ...window.__MAVI_GAME__.state.lastSafe }));
    expect(safe.footY).toBe(635);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.x = 680; // 600–760 arası çukur
      g.player.y = 500;
      g.player.vy = 0;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.lives)).toBe(2);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    const after = await game(page, () => ({ x: window.__MAVI_GAME__.player.x, foot: window.__MAVI_GAME__.player.y + window.__MAVI_GAME__.player.h }));
    expect(after.foot).toBe(635);
    expect(after.x).toBeCloseTo(safe.x, 0);
  });

  test("12 olay için ayrı, kısa sesler; kullanıcı etkileşimi olmadan ses başlamaz", async ({ page, consoleErrors }, testInfo) => {
    desktopOnly(testInfo);
    await openLevel(page, 1);
    const info = await game(page, () => {
      const T = window.__MAVI_GAME__.test;
      return { names: T.soundNames, defs: T.soundDefs, unlocked: T.audioUnlocked(), ctx: T.audioContextCreated() };
    });
    const required = ["jump", "land", "coin", "box", "correct", "wrong", "shieldOn", "stomp", "hurt", "rocket", "bossHit", "levelComplete"];
    for (const name of required) expect(info.names).toContain(name);
    const signatures = required.map((n) => JSON.stringify(info.defs[n]));
    expect(new Set(signatures).size).toBe(required.length);
    for (const n of info.names) {
      for (const note of info.defs[n]) {
        expect(note.dur, n).toBeLessThanOrEqual(0.45);
        expect(note.gain, n).toBeLessThanOrEqual(0.08);
      }
    }
    // autostart (etkileşimsiz) açılış: coin toplansa da ses bağlamı oluşmaz
    expect(info.unlocked).toBe(false);
    expect(info.ctx).toBe(false);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.coins[0].x = g.player.x;
      g.coins[0].y = g.player.y + 20;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.score)).toBe(10);
    expect(await game(page, () => window.__MAVI_GAME__.test.audioContextCreated())).toBe(false);
    // Kullanıcı etkileşimi sonrası açılır
    await page.goto("./?nosw=1");
    await page.locator("#startButton").click();
    expect(await game(page, () => window.__MAVI_GAME__.test.audioUnlocked())).toBe(true);
  });
});
