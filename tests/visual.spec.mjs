// Görsel katman testleri: animasyon durum makinesi, ayak sabitliği, efekt sınırları, parallax.
// Piksel karşılaştırması yerine durum ve sınır doğrulaması yapılır.
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

const isTouchProject = (testInfo) => Boolean(testInfo.project.use.hasTouch);
const game = (page, fn, arg) => page.evaluate(fn, arg);
const anim = (page) => game(page, () => window.__MAVI_GAME__.currentAnimation);

async function startAt(page, query = "") {
  await page.goto(`./?nosw=1&autostart=1${query}`);
  await expect.poll(() => game(page, () => window.__MAVI_GAME__ && window.__MAVI_GAME__.player.grounded)).toBe(true);
}

// Üstü açık bir zemin noktasına taşır: seviye verisinden, sağında ~530 px boyunca aynı
// platformun sürdüğü ve 440 px yukarısına kadar hiçbir platform/kutu olmayan ilk nokta bulunur
// (koşarken zıplama tavana çarpmasın).
async function moveToOpenGround(page) {
  const spot = await game(page, () => {
    const g = window.__MAVI_GAME__;
    const solids = [...g.platforms, ...g.boxes];
    for (const p of g.platforms) {
      for (let x = p.x + 30; x + 530 + g.player.w <= p.x + p.w; x += 20) {
        const blocked = solids.some((s) => s !== p && s.x < x + 530 + g.player.w && s.x + s.w > x && s.y < p.y && s.y + s.h > p.y - 440);
        if (!blocked) return { x, y: p.y };
      }
    }
    return null;
  });
  expect(spot, "seviyede üstü açık zemin bulunmalı").not.toBeNull();
  await game(page, (s) => {
    const g = window.__MAVI_GAME__;
    g.player.x = s.x;
    g.player.y = s.y - g.player.h;
    g.player.vx = 0;
    g.player.vy = 0;
  }, spot);
  await expect.poll(() => anim(page)).toBe("idle");
}

// Her karede animasyon adını kaydeder (yalnızca değiştiğinde).
async function recordAnimations(page) {
  await game(page, () => {
    window.__animLog = [];
    const tick = () => {
      const name = window.__MAVI_GAME__.currentAnimation;
      if (window.__animLog[window.__animLog.length - 1] !== name) window.__animLog.push(name);
      window.__animRaf = requestAnimationFrame(tick);
    };
    tick();
  });
  return () =>
    game(page, () => {
      cancelAnimationFrame(window.__animRaf);
      return window.__animLog;
    });
}

function inOrder(log, expected) {
  let i = 0;
  for (const name of log) if (name === expected[i]) i += 1;
  return i === expected.length;
}

test.describe("Mavi animasyon durum makinesi", () => {
  test("boşta → yürüme → koşu → boşta (analog giriş)", async ({ page, consoleErrors }) => {
    await startAt(page);
    await expect.poll(() => anim(page)).toBe("idle");
    // Joystick ile aynı yol: touchInput.axis
    await game(page, () => {
      window.__MAVI_GAME__.touchInput.axis = 0.35;
    });
    await expect.poll(() => anim(page)).toBe("walk");
    await game(page, () => {
      window.__MAVI_GAME__.touchInput.axis = 1;
    });
    await expect.poll(() => anim(page)).toBe("run");
    await game(page, () => {
      window.__MAVI_GAME__.touchInput.axis = 0;
    });
    await expect.poll(() => anim(page)).toBe("idle");
  });

  test("klavye tam hızda koşu animasyonu; kareler hıza bağlı ilerler", async ({ page, consoleErrors }) => {
    await startAt(page);
    await page.keyboard.down("KeyD");
    await expect.poll(() => anim(page)).toBe("run");
    const frames = new Set();
    for (let i = 0; i < 12; i += 1) {
      frames.add(await game(page, () => window.__MAVI_GAME__.currentFrame));
      await page.waitForTimeout(40);
    }
    await page.keyboard.up("KeyD");
    expect(frames.size, "koşu döngüsünde birden fazla kare").toBeGreaterThanOrEqual(3);
    for (const f of frames) expect(f).toMatch(/^run-\d$/);
  });

  test("koşu → zıplama başlangıcı → yükselme → tepe → düşüş → iniş → boşta", async ({ page, consoleErrors }) => {
    await startAt(page);
    await moveToOpenGround(page);
    const stop = await recordAnimations(page);
    await page.keyboard.down("KeyD");
    await expect.poll(() => anim(page)).toBe("run");
    await page.keyboard.down("Space");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.vy)).toBeLessThan(0);
    await page.keyboard.up("Space");
    await page.keyboard.up("KeyD");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded), { timeout: 4000 }).toBe(true);
    await expect.poll(() => anim(page)).toBe("idle");
    const log = await stop();
    expect(inOrder(log, ["run", "jump-start", "jump-up", "apex", "fall", "land", "idle"]), `sıra: ${log.join(" → ")}`).toBe(true);
  });

  test("ayak noktası kare değişiminde sabit; çarpışma kutusu değişmez", async ({ page, consoleErrors }) => {
    await startAt(page);
    await moveToOpenGround(page);
    const before = await game(page, () => ({ w: window.__MAVI_GAME__.player.w, h: window.__MAVI_GAME__.player.h }));
    await page.keyboard.down("KeyD");
    const samples = await game(page, async () => {
      const g = window.__MAVI_GAME__;
      const out = [];
      for (let i = 0; i < 40; i += 1) {
        await new Promise((r) => requestAnimationFrame(r));
        const v = g.visual.playerVisualState();
        out.push({
          frame: v.frameName,
          grounded: g.player.grounded,
          footX: v.footX,
          boxCenter: g.player.x + g.player.w / 2,
          bottomDelta: v.spriteBottom - v.footY,
          footY: v.footY,
          boxBottom: g.player.y + g.player.h
        });
      }
      return out;
    });
    await page.keyboard.up("KeyD");
    const frames = new Set(samples.map((s) => s.frame));
    expect(frames.size).toBeGreaterThanOrEqual(3);
    for (const s of samples) {
      expect(Math.abs(s.bottomDelta), `kare ${s.frame}: görüntü tabanı ayak noktasında`).toBeLessThan(0.001);
      expect(s.footX).toBeCloseTo(s.boxCenter, 6);
      expect(s.footY).toBeCloseTo(s.boxBottom, 6);
    }
    // Yerdeyken ayak çizgisi platform üstünde sabit (635), kareler arasında oynamaz
    const groundFeet = new Set(samples.filter((s) => s.grounded).map((s) => Math.round(s.footY * 100)));
    expect(groundFeet.size).toBe(1);
    // Tüm animasyon karelerinde taban = ayak (ay = sh)
    const allFrames = await game(page, () => window.__MAVI_GAME__.visual.PLAYER_FRAMES);
    for (const [name, f] of Object.entries(allFrames)) expect(f.ay, name).toBe(f.sh);
    const after = await game(page, () => ({ w: window.__MAVI_GAME__.player.w, h: window.__MAVI_GAME__.player.h }));
    expect(after).toEqual(before);
    expect(after).toEqual({ w: 46, h: 104 });
  });

  test("sola bakınca sprite ayak noktası etrafında yatay çevrilir", async ({ page, consoleErrors }) => {
    await startAt(page);
    await game(page, () => {
      window.__MAVI_GAME__.player.x = 600;
    });
    // Gerçek girişle sola dön: yön klavyeden gelir
    await page.keyboard.down("KeyA");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.facing)).toBe(-1);
    await page.keyboard.up("KeyA");
    await expect.poll(() => anim(page)).toBe("idle");
    // İki yön aynı karede, aynı animasyon zamanında ölçülür (nefes alma ölçeği değişmesin)
    const { right, left } = await game(page, () => {
      const g = window.__MAVI_GAME__;
      const measure = () => {
        const v = g.visual.playerVisualState();
        return { facing: v.facing, frame: v.frameName, left: v.footX - v.spriteLeft, right: v.spriteRight - v.footX };
      };
      const leftSide = measure();
      g.player.facing = 1;
      const rightSide = measure();
      g.player.facing = -1;
      return { right: rightSide, left: leftSide };
    });
    expect(right.facing).toBe(1);
    expect(left.facing).toBe(-1);
    expect(left.frame).toBe(right.frame);
    // Ayna görüntü: sağa bakarken soldaki genişlik, sola bakarken sağdaki genişliğe eşit
    expect(left.right).toBeCloseTo(right.left, 3);
    expect(left.left).toBeCloseTo(right.right, 3);
  });

  test("hasar animasyonu oynar ve normale döner; yanıp sönme korunur", async ({ page, consoleErrors }) => {
    await startAt(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.invuln = 0;
      g.test.hurtPlayer(false);
    });
    await expect.poll(() => anim(page)).toBe("hurt");
    expect(await game(page, () => window.__MAVI_GAME__.state.lives)).toBe(2);
    expect(await game(page, () => window.__MAVI_GAME__.player.invuln)).toBeGreaterThan(1);
    await expect.poll(() => anim(page), { timeout: 3000 }).not.toBe("hurt");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
    await expect.poll(() => anim(page)).toBe("idle");
  });
});

test.describe("Joystick ile animasyon", () => {
  test("az sürüklemede yürüme, tam sürüklemede koşu", async ({ page, consoleErrors }, testInfo) => {
    test.skip(!isTouchProject(testInfo), "Dokunmatik cihaz projelerinde çalışır");
    await startAt(page);
    const g = await game(page, () => window.__MAVI_GAME__.test.joystickGeometry());
    const cdp = await page.context().newCDPSession(page);
    const at = (fx) => ({ x: Math.round(g.cx + g.radius * fx), y: Math.round(g.cy), id: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(0.45)] });
    await expect.poll(() => anim(page)).toBe("walk");
    expect(await game(page, () => window.__MAVI_GAME__.currentFrame)).toMatch(/^walk-\d$/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(1)] });
    await expect.poll(() => anim(page)).toBe("run");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => anim(page)).toBe("idle");
  });
});

test.describe("Düşman görseli", () => {
  test("üzerine basılınca sıkışır ve kaybolur; gerçek konum değişmez", async ({ page, consoleErrors }) => {
    await startAt(page);
    // Konum yenilme anında okunur (düşman canlıyken yürümeye devam eder)
    const before = await game(page, () => {
      const e = window.__MAVI_GAME__.enemies[0];
      window.__MAVI_GAME__.test.defeatEnemy(e);
      return { x: e.x, y: e.y, w: e.w, h: e.h };
    });
    const samples = await game(page, async () => {
      const g = window.__MAVI_GAME__;
      const e = g.enemies[0];
      const out = [];
      for (let i = 0; i < 40; i += 1) {
        out.push(g.visual.enemyVisualState(e));
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { out, x: e.x, y: e.y, w: e.w, h: e.h };
    });
    expect({ x: samples.x, y: samples.y, w: samples.w, h: samples.h }).toEqual(before);
    const first = samples.out[1];
    const later = samples.out.find((v) => v.sy < 0.5);
    expect(first.visible).toBe(true);
    expect(later, "sıkışma olmalı").toBeTruthy();
    expect(later.sx).toBeGreaterThan(1);
    expect(samples.out[samples.out.length - 1].visible).toBe(false);
  });

  test("yürürken salınım ve adım ritmi; oyuncu yaklaşınca hafif tepki", async ({ page, consoleErrors }) => {
    await startAt(page);
    const e0 = await game(page, () => {
      const g = window.__MAVI_GAME__;
      const e = g.enemies[0];
      g.player.x = e.x - 600;
      return { x: e.x };
    });
    await page.waitForTimeout(300);
    const far = await game(page, () => window.__MAVI_GAME__.enemies[0].alert);
    const tilts = await game(page, async () => {
      const out = [];
      for (let i = 0; i < 20; i += 1) {
        out.push(window.__MAVI_GAME__.visual.enemyVisualState(window.__MAVI_GAME__.enemies[0]).tilt);
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    });
    expect(Math.max(...tilts) - Math.min(...tilts)).toBeGreaterThan(0.01);
    expect(Math.max(...tilts.map(Math.abs))).toBeLessThan(0.15);
    expect(far).toBeLessThan(0.2);
    await game(page, (x) => {
      const g = window.__MAVI_GAME__;
      const e = g.enemies[0];
      g.player.x = e.x - 150;
      g.player.invuln = 5;
      return x;
    }, e0.x);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.enemies[0].alert)).toBeGreaterThan(0.5);
  });
});

test.describe("Efektler ve performans sınırları", () => {
  test("parçacık üst sınırı aşılmaz", async ({ page, consoleErrors }) => {
    await startAt(page);
    const result = await game(page, () => {
      const g = window.__MAVI_GAME__;
      for (let i = 0; i < 200; i += 1) g.visual.spawnCoinSparkle(600, 400);
      return { count: g.particleCount, cap: g.visual.particleCap() };
    });
    expect(result.cap).toBe(180);
    expect(result.count).toBeLessThanOrEqual(result.cap);
    expect(result.count).toBeGreaterThan(50);
  });

  test("coin toplanınca parıltı parçacıkları oluşur", async ({ page, consoleErrors }) => {
    await startAt(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      const c = g.coins.find((coin) => !coin.collected);
      g.player.x = c.x - 8;
      g.player.y = c.y - 20;
      g.player.vy = 0;
    });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.score)).toBeGreaterThanOrEqual(10);
    expect(await game(page, () => window.__MAVI_GAME__.particleCount)).toBeGreaterThan(0);
  });

  test("boss darbesi: kısa parlama, şok dalgası ve en fazla birkaç piksel sallama", async ({ page, consoleErrors }) => {
    await startAt(page, "&boss=1&level=1");
    await game(page, () => window.__MAVI_GAME__.test.damageBoss());
    const fx = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { flash: g.state.boss.hitFlash, rings: g.visual.fx.rings.length, shake: g.visual.fx.shakeStrength, shakeTime: g.visual.fx.shakeTime, max: g.visual.maxShakePx, health: g.state.boss.health };
    });
    expect(fx.health).toBe(5);
    expect(fx.flash).toBeGreaterThan(0);
    expect(fx.rings).toBeGreaterThan(0);
    expect(fx.shake).toBeLessThanOrEqual(fx.max);
    expect(fx.max).toBeLessThanOrEqual(4);
    expect(fx.shakeTime).toBeGreaterThan(0);
    expect(fx.shakeTime).toBeLessThanOrEqual(0.25);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.visual.fx.shakeTime)).toBe(0);
  });

  test("hareket azaltma: sallama, şok dalgası ve kamera ileri bakışı kapalı; efektler seyrek", async ({ page, consoleErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startAt(page, "&boss=1&level=1");
    expect(await game(page, () => window.__MAVI_GAME__.reducedMotion)).toBe(true);
    await game(page, () => window.__MAVI_GAME__.test.damageBoss());
    const fx = await game(page, () => {
      const g = window.__MAVI_GAME__;
      return { shakeTime: g.visual.fx.shakeTime, rings: g.visual.fx.rings.length, cap: g.visual.particleCap(), fireworkCap: g.visual.fireworkCap() };
    });
    expect(fx.shakeTime).toBe(0);
    expect(fx.rings).toBe(0);
    expect(fx.cap).toBe(60);
    expect(fx.fireworkCap).toBe(90);
    const count = await game(page, () => {
      const g = window.__MAVI_GAME__;
      for (let i = 0; i < 200; i += 1) g.visual.spawnCoinSparkle(600, 400);
      return g.particleCount;
    });
    expect(count).toBeLessThanOrEqual(60);
    // Kamera: ileri bakış yok
    await startAt(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    expect(await game(page, () => window.__MAVI_GAME__.state.cameraLook)).toBe(0);
    await page.keyboard.up("KeyD");
  });

  test("kamera sınırları korunur; ileri bakış küçük", async ({ page, consoleErrors }) => {
    await startAt(page);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(900);
    const look = await game(page, () => window.__MAVI_GAME__.state.cameraLook);
    await page.keyboard.up("KeyD");
    expect(look).toBeGreaterThan(0);
    expect(look).toBeLessThanOrEqual(70);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.player.x = 7400;
    });
    await page.waitForTimeout(1500);
    const cam = await game(page, () => window.__MAVI_GAME__.state.cameraX);
    expect(cam).toBeLessThanOrEqual(7500 - 1280 + 0.001);
    expect(cam).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Parallax ve seviye atmosferleri", () => {
  test("dört seviyede farklı atmosfer, en az üç parallax katmanı", async ({ page, consoleErrors }) => {
    await startAt(page);
    const infos = await game(page, () => [1, 2, 3, 4].map((level) => window.__MAVI_GAME__.visual.parallaxInfo(level)));
    const names = new Set(infos.map((i) => i.atmosphere));
    const skies = new Set(infos.map((i) => i.sky));
    expect(names.size).toBe(4);
    expect(skies.size).toBe(4);
    for (const info of infos) {
      expect(info.layers.length).toBeGreaterThanOrEqual(3);
      const factors = info.layers.map((l) => l.factor);
      for (const f of factors) {
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThan(1);
      }
      expect([...factors].sort((a, b) => a - b)).toEqual(factors);
      expect(factors[0]).toBeLessThanOrEqual(0.1);
      expect(factors.some((f) => f >= 0.15 && f <= 0.25)).toBe(true);
      expect(factors.some((f) => f >= 0.35 && f <= 0.5)).toBe(true);
    }
  });
});

test.describe("Boss ve roket (eski mekanik)", () => {
  test("boss sorusu doğru: üç roket, yalnızca biri hasar verir, roket görseli kullanılır", async ({ page, consoleErrors }) => {
    await startAt(page, "&boss=1&level=3");
    await game(page, () => window.__MAVI_GAME__.test.launchRocket());
    const rockets = await game(page, () => window.__MAVI_GAME__.state.boss.rockets.map((r) => ({ damages: r.damagesBoss, sprite: r.sprite })));
    expect(rockets.length).toBe(3);
    expect(rockets.filter((r) => r.damages).length).toBe(1);
    expect(rockets.map((r) => r.sprite)).toEqual([0, 1, 2]);
    const img = await game(page, () => {
      const i = new Image();
      i.src = "assets/img/rockets.png";
      return i.decode().then(() => [i.naturalWidth, i.naturalHeight]);
    });
    expect(img).toEqual([256, 216]);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.health), { timeout: 6000 }).toBe(5);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.rockets.length)).toBe(0);
  });
});
