import { test as base, expect } from "@playwright/test";

// Her testte konsol hatası ve yakalanmamış istisna toplanır; test sonunda boş olmalı.
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

async function openGame(page, query = "") {
  await page.goto(`./?nosw=1${query}`);
  await expect(page.locator("#startDialog")).toBeVisible();
}

async function startGame(page) {
  await page.locator("#startButton").click();
  await expect(page.locator("#startDialog")).toBeHidden();
  // Seviye tanıtımı: kullanıcı gibi dokunarak geç
  await expect(page.locator("#levelIntro")).toBeVisible();
  await page.locator("#levelIntro").click();
  await expect(page.locator("#levelIntro")).toBeHidden();
  await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.grounded)).toBe(true);
}

// Dokunmatik projelerde cevap ekran tuş takımıyla, masaüstünde input'a yazılarak girilir.
async function pressKey(page, selector, testInfo) {
  if (isTouchProject(testInfo)) await page.locator(selector).tap();
  else await page.locator(selector).click();
}

async function typeWithKeypad(page, value, testInfo) {
  for (const digit of String(value)) await pressKey(page, `[data-digit="${digit}"]`, testInfo);
}

async function enterAnswer(page, value, testInfo) {
  if (isTouchProject(testInfo)) await typeWithKeypad(page, value, testInfo);
  else await page.locator("#answerInput").fill(String(value));
}

async function openQuestion(page, index = 0) {
  await game(page, (i) => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[i]), index);
  await expect(page.locator("#questionDialog")).toBeVisible();
  return game(page, () => window.__MAVI_GAME__.state.currentQuestion.answer);
}

// Joystick'i gerçek dokunma olaylarıyla (CDP) sürükler. Konumlar yarıçap oranı olarak verilir:
// fx = 1 tam sağ, -1 tam sol, 0 merkez. "others" aynı anda basılı diğer parmaklardır.
async function joystickDriver(page) {
  const g = await game(page, () => window.__MAVI_GAME__.test.joystickGeometry());
  const cdp = await page.context().newCDPSession(page);
  const finger = (fx, fy = 0) => ({ x: Math.round(g.cx + g.radius * fx), y: Math.round(g.cy + g.radius * fy), id: 1 });
  const send = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  return {
    geometry: g,
    cdp,
    press: (fx = 0, fy = 0, others = []) => send("touchStart", [finger(fx, fy), ...others]),
    drag: (fx, fy = 0, others = []) => send("touchMove", [finger(fx, fy), ...others]),
    release: () => send("touchEnd", []),
    cancel: () => send("touchCancel", [])
  };
}

const vx = (page) => game(page, () => window.__MAVI_GAME__.player.vx);
const axis = (page) => game(page, () => window.__MAVI_GAME__.touchInput.axis);

function center(b) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe("Başlangıç ve yerleşim", () => {
  test("başlangıç ekranı açılır, oyun Başla'ya kadar beklemede kalır", async ({ page, consoleErrors }) => {
    await openGame(page);
    await expect(page.locator("#startTitle")).toBeVisible();
    await expect(page.locator("#startButton")).toBeFocused();
    const before = await game(page, () => ({ ...window.__MAVI_GAME__.player, started: window.__MAVI_GAME__.state.started }));
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    const after = await game(page, () => window.__MAVI_GAME__.player.x);
    expect(before.started).toBe(false);
    expect(after).toBe(before.x);
    await startGame(page);
    expect(await game(page, () => window.__MAVI_GAME__.state.lives)).toBe(3);
  });

  test("oyun alanı taşmadan ekrana sığar ve 16:9 oranını korur", async ({ page, consoleErrors }) => {
    await openGame(page);
    await startGame(page);
    const vp = page.viewportSize();
    const box = await page.locator("#gameShell").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(scroll[0]).toBeLessThanOrEqual(vp.width);
    expect(scroll[1]).toBeLessThanOrEqual(vp.height);
    // Fizik koordinatları CSS ölçeğinden bağımsız: mantıksal dünya 1280x720 kalır.
    const canvas = await page.evaluate(() => {
      const c = document.getElementById("game");
      return { w: c.width, h: c.height, scale: window.__MAVI_GAME__.state.renderScale };
    });
    expect(Math.round(canvas.w / canvas.scale)).toBe(1280);
    expect(Math.round(canvas.h / canvas.scale)).toBe(720);
  });

  test("HUD görünür, boss çubuğu ve kontrollerle çakışmaz", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page, "&boss=1&level=1");
    await startGame(page);
    const shell = await page.locator("#gameShell").boundingBox();
    const scale = shell.width / 1280;
    // Boss can çubuğu canvas'ta (500, 18, 380x48) mantıksal koordinatta çizilir.
    const bossBar = { x: shell.x + 500 * scale, y: shell.y + 18 * scale, width: 380 * scale, height: 48 * scale };
    const hud = await page.locator(".hud").boundingBox();
    for (const id of ["#score", "#lives", "#shieldTimer", "#levelText"]) {
      await expect(page.locator(id)).toBeVisible();
    }
    expect(overlaps(hud, bossBar), "HUD boss çubuğunu kapatmamalı").toBe(false);
    expect(hud.x).toBeGreaterThanOrEqual(shell.x);
    expect(hud.y + hud.height).toBeLessThan(shell.y + shell.height * 0.3);
    const sound = await page.locator("#soundToggleGame").boundingBox();
    expect(overlaps(hud, sound)).toBe(false);
    if (isTouchProject(testInfo)) {
      await expect(page.locator("#touchControls")).toBeVisible();
      await expect(page.locator(".keyboard-help")).toBeHidden();
      for (const sel of [".joystick-base", '[data-action="jump"]']) {
        const b = await page.locator(sel).boundingBox();
        expect(b.width).toBeGreaterThanOrEqual(56);
        expect(b.height).toBeGreaterThanOrEqual(56);
        expect(overlaps(hud, b)).toBe(false);
      }
    } else {
      await expect(page.locator("#touchControls")).toBeHidden();
      await expect(page.locator(".keyboard-help")).toBeVisible();
    }
  });
});

test.describe("Kontroller", () => {
  test("klavye ile yürüme ve zıplama", async ({ page, consoleErrors }) => {
    await openGame(page);
    await startGame(page);
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyD");
    const x1 = await game(page, () => window.__MAVI_GAME__.player.x);
    expect(x1).toBeGreaterThan(x0 + 40);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(200);
    await page.keyboard.up("ArrowLeft");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeLessThan(x1);
    await page.keyboard.down("Space");
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.vy)).toBeLessThan(0);
    await page.keyboard.up("Space");
  });

  test("masaüstünde joystick gizli, klavye yardımı görünür; eski sol/sağ düğmeleri yok", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    await expect(page.locator('[data-action="left"], [data-action="right"], #dpad, .dpad')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sola git|Sağa git/ })).toHaveCount(0);
    if (isTouchProject(testInfo)) {
      await expect(page.locator(".joystick-base")).toBeVisible();
      await expect(page.getByRole("group", { name: "Hareket çubuğu" })).toBeVisible();
      await expect(page.locator("#joystick")).toHaveAttribute("aria-describedby", "joystickHint");
      await expect(page.locator("#joystickHint")).toHaveText("Hareket çubuğu: sola veya sağa sürükle");
    } else {
      await expect(page.locator(".joystick-base")).toBeHidden();
      await expect(page.locator(".keyboard-help")).toBeVisible();
    }
  });
});

test.describe("Analog joystick", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!isTouchProject(testInfo), "Dokunmatik cihaz projelerinde çalışır");
    await openGame(page);
    await startGame(page);
  });

  test("yarım sağa sürükleme yavaş, tam sağa sürükleme en yüksek hız", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    const max = await game(page, () => window.__MAVI_GAME__.test.moveSpeed);
    await js.press(0, 0);
    await js.drag(0.5, 0);
    await expect.poll(() => vx(page)).toBeGreaterThan(0);
    const half = await vx(page);
    expect(half).toBeGreaterThan(max * 0.2);
    expect(half).toBeLessThan(max * 0.6);
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await page.waitForTimeout(200);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(x0 + 10);
    // Parmak dairenin dışına taşsa da hız MOVE_SPEED'de sınırlanır
    await js.drag(1.8, 0);
    await expect.poll(() => vx(page)).toBeCloseTo(max, 3);
    expect(await axis(page)).toBe(1);
    await js.release();
  });

  test("sola sürüklenince karakter sola gider", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    await game(page, () => {
      window.__MAVI_GAME__.player.x = 600;
    });
    await js.press(0, 0);
    await js.drag(-1, 0);
    await expect.poll(() => vx(page)).toBeLessThan(0);
    await page.waitForTimeout(200);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeLessThan(600 - 20);
    expect(await game(page, () => window.__MAVI_GAME__.player.facing)).toBe(-1);
    await js.release();
  });

  test("ölü bölge içinde hareket yok; dikey sürükleme zıplatmaz", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    const dz = await game(page, () => window.__MAVI_GAME__.test.joystickDeadZone);
    expect(dz).toBeGreaterThanOrEqual(0.15);
    expect(dz).toBeLessThanOrEqual(0.2);
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await js.press(0, 0);
    await js.drag(0.1, 0);
    await page.waitForTimeout(250);
    expect(await axis(page)).toBe(0);
    expect(await vx(page)).toBe(0);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);
    // Topuz yine de parmağı izler (görsel geri bildirim)
    await expect(page.locator("#joystick")).toHaveClass(/is-active/);
    // Tam yukarı sürükleme: topuz oynar ama karakter zıplamaz ve yürümez
    await js.drag(0, -1);
    await page.waitForTimeout(250);
    expect(await game(page, () => window.__MAVI_GAME__.player.vy)).toBe(0);
    expect(await vx(page)).toBe(0);
    await js.release();
  });

  test("bırakınca karakter durur ve topuz merkeze döner", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    await js.press(0, 0);
    await js.drag(1, 0.5);
    await expect.poll(() => vx(page)).toBeGreaterThan(0);
    const knobMoved = center(await page.locator(".joystick-knob").boundingBox());
    expect(knobMoved.x).toBeGreaterThan(js.geometry.cx + js.geometry.radius * 0.5);
    await js.release();
    await expect.poll(() => axis(page)).toBe(0);
    await expect.poll(() => vx(page)).toBe(0);
    await expect(page.locator("#joystick")).not.toHaveClass(/is-active/);
    await expect
      .poll(async () => {
        const c = center(await page.locator(".joystick-knob").boundingBox());
        return Math.hypot(c.x - js.geometry.cx, c.y - js.geometry.cy);
      })
      .toBeLessThan(1);
  });

  test("pointercancel ve lostpointercapture hareketi sıfırlar", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await js.cancel();
    await expect.poll(() => axis(page)).toBe(0);
    await expect.poll(() => vx(page)).toBe(0);

    await page.evaluate(() => {
      document.getElementById("joystick").addEventListener("pointerdown", (e) => {
        window.__joystickPointerId = e.pointerId;
      });
    });
    await js.press(0, 0);
    await js.drag(-1, 0);
    await expect.poll(() => axis(page)).toBe(-1);
    // Yakalamanın kaybedilmesi (ör. sistem hareketi) gerçek lostpointercapture olayını tetikler
    const hadCapture = await page.evaluate(() => {
      const el = document.getElementById("joystick");
      const id = window.__joystickPointerId;
      const captured = el.hasPointerCapture(id);
      el.releasePointerCapture(id);
      return captured;
    });
    expect(hadCapture, "joystick pointer capture kullanmalı").toBe(true);
    // Tarayıcı lostpointercapture'ı bir sonraki pointer olayından önce gönderir (Pointer Events standardı).
    // Joystick sıfırlanmalı ve yakalaması kaybolmuş parmağın hareketini yok saymalı.
    // (Aynı koordinata "hareket" pointermove üretmez; parmak gerçekten kaydırılır.)
    await js.drag(-0.8, 0.1);
    await expect.poll(() => axis(page)).toBe(0);
    await expect.poll(() => vx(page)).toBe(0);
    await js.release();
    // Sonrasında joystick tekrar kullanılabilir
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await js.release();
  });

  test("pencere odağı kaybı ve sekme gizlenmesi joystick'i takılı bırakmaz", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect(await axis(page)).toBe(0);
    await expect.poll(() => vx(page)).toBe(0);
    await js.release();

    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(await axis(page)).toBe(0);
    await js.release();
  });

  test("joystick + zıplama iki parmakla aynı anda çalışır", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    const jump = center(await page.locator('[data-action="jump"]').boundingBox());
    const jumpFinger = { x: Math.round(jump.x), y: Math.round(jump.y), id: 2 };
    const max = await game(page, () => window.__MAVI_GAME__.test.moveSpeed);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => vx(page)).toBeCloseTo(max, 3);
    await js.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: Math.round(js.geometry.cx + js.geometry.radius), y: Math.round(js.geometry.cy), id: 1 }, jumpFinger]
    });
    await expect.poll(() => game(page, () => ({ ...window.__MAVI_GAME__.touchInput }))).toEqual({ axis: 1, jump: true });
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.player.vy)).toBeLessThan(0);
    expect(await vx(page)).toBeCloseTo(max, 3);
    await expect(page.locator('[data-action="jump"]')).toHaveClass(/is-pressed/);
    // Parmağı sola kaydırırken zıplama basılı kalır
    await js.drag(-1, 0, [jumpFinger]);
    await expect.poll(() => game(page, () => ({ ...window.__MAVI_GAME__.touchInput }))).toEqual({ axis: -1, jump: true });
    await js.release();
    await expect.poll(() => game(page, () => ({ ...window.__MAVI_GAME__.touchInput }))).toEqual({ axis: 0, jump: false });
  });

  test("soru açılınca joystick sıfırlanır; soru kapanınca yeniden kullanılır", async ({ page, consoleErrors }, testInfo) => {
    const js = await joystickDriver(page);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    const answer = await openQuestion(page);
    expect(await axis(page)).toBe(0);
    await expect(page.locator("#joystick")).not.toHaveClass(/is-active/);
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await js.drag(1, 0);
    await page.waitForTimeout(250);
    expect(await axis(page)).toBe(0);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);
    await js.release();

    await typeWithKeypad(page, answer, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionDialog")).toBeHidden();
    await expect(page.locator("#touchControls")).not.toHaveClass(/is-disabled/);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await page.waitForTimeout(250);
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(x0 + 20);
    await js.release();
  });

  test("oyun sonunda joystick sıfırlanır ve devre dışı kalır", async ({ page, consoleErrors }) => {
    const js = await joystickDriver(page);
    await js.press(0, 0);
    await js.drag(1, 0);
    await expect.poll(() => axis(page)).toBe(1);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.state.lives = 1;
      g.player.invuln = 0;
      g.test.hurtPlayer(false);
    });
    await expect(page.locator("#gameOverDialog")).toBeVisible();
    expect(await axis(page)).toBe(0);
    await expect(page.locator("#touchControls")).toHaveClass(/is-disabled/);
    await js.release();
  });

  test("joystick, zıplama, HUD ve soru penceresi çakışmaz", async ({ page, consoleErrors }) => {
    const vp = page.viewportSize();
    const base = await page.locator(".joystick-base").boundingBox();
    const jump = await page.locator('[data-action="jump"]').boundingBox();
    const hud = await page.locator(".hud").boundingBox();
    // Ekran içinde ve güvenli alan payıyla
    for (const b of [base, jump]) {
      expect(b.x).toBeGreaterThanOrEqual(8);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width - 8);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height - 8);
    }
    expect(base.width).toBeGreaterThanOrEqual(92);
    expect(base.width).toBeLessThanOrEqual(128);
    expect(overlaps(base, jump)).toBe(false);
    expect(overlaps(base, hud)).toBe(false);
    expect(overlaps(jump, hud)).toBe(false);
    await openQuestion(page);
    const dlg = await page.locator("#questionDialog").boundingBox();
    expect(overlaps(dlg, base), "soru penceresi joystick'in üstüne binmemeli").toBe(false);
    expect(overlaps(dlg, jump), "soru penceresi zıplama düğmesinin üstüne binmemeli").toBe(false);
  });
});

test.describe("Matematik soruları", () => {
  test("soru açılınca hareket durur, doğru cevap puan ve kalkan verir", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    const dlg = page.locator("#questionDialog");
    await expect(dlg).toBeVisible();
    const input = page.locator("#answerInput");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("pattern", "[0-9]*");
    await expect(input).toHaveAttribute("enterkeyhint", "done");
    await expect(page.locator("#answerButton")).toBeInViewport({ ratio: 1 });
    const inputBox = await input.boundingBox();
    expect(inputBox.height).toBeGreaterThanOrEqual(44);
    expect(await game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(false);
    if (isTouchProject(testInfo)) await expect(page.locator("#touchControls")).toHaveClass(/is-disabled/);

    // Soru açıkken klavye hareketi etkisiz
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowRight");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);

    // Esc (veya Android geri) soruyu kapatıp oyunu kilitlemez
    await page.keyboard.press("Escape");
    await expect(dlg).toBeVisible();

    const answer = await game(page, () => window.__MAVI_GAME__.state.currentQuestion.answer);
    await enterAnswer(page, answer, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionFeedback")).toHaveText("Doğru!");
    await expect(dlg).toBeHidden();
    const s = await game(page, () => ({ score: window.__MAVI_GAME__.state.score, shield: window.__MAVI_GAME__.player.shield, paused: window.__MAVI_GAME__.state.paused }));
    expect(s.score).toBe(50);
    expect(s.shield).toBeGreaterThan(10);
    expect(s.paused).toBe(false);
    await expect(page.locator("#shieldPill")).toHaveClass(/active/);
    expect(await game(page, () => window.__MAVI_GAME__.test.isGameInteractive())).toBe(true);
    await expect(page.locator("#game")).toBeFocused();
  });

  test("yanlış cevap puan vermez, oyun devam eder", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    await game(page, () => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[1]));
    const answer = await game(page, () => window.__MAVI_GAME__.state.currentQuestion.answer);
    if (isTouchProject(testInfo)) {
      await typeWithKeypad(page, answer + 1, testInfo);
      await pressKey(page, "#answerButton", testInfo);
    } else {
      await page.locator("#answerInput").fill(String(answer + 1));
      await page.locator("#answerInput").press("Enter");
    }
    await expect(page.locator("#questionFeedback")).toContainText("Yanlış cevap");
    await expect(page.locator("#questionDialog")).toBeHidden();
    expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(0);
    expect(await game(page, () => window.__MAVI_GAME__.boxes[1].state)).toBe("used");
  });
});

test.describe("Ekran sayı tuş takımı", () => {
  test("iki basamaklı cevap, silme ve temizleme", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    await openQuestion(page);
    const input = page.locator("#answerInput");
    await typeWithKeypad(page, "47", testInfo);
    await expect(input).toHaveValue("47");
    await pressKey(page, '[data-numpad="delete"]', testInfo);
    await expect(input).toHaveValue("4");
    await typeWithKeypad(page, "25", testInfo);
    await expect(input).toHaveValue("425");
    await pressKey(page, '[data-numpad="clear"]', testInfo);
    await expect(input).toHaveValue("");
    // En fazla 4 basamak
    await typeWithKeypad(page, "123456", testInfo);
    await expect(input).toHaveValue("1234");
    // Boş gönderim aynı doğrulamadan geçer; soru kapanmaz, puan değişmez
    await pressKey(page, '[data-numpad="clear"]', testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionFeedback")).toHaveText("Önce cevabını yaz.");
    await expect(page.locator("#questionDialog")).toBeVisible();
    expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(0);
  });

  test("tuş takımıyla doğru cevap puan ve kalkan verir", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    const answer = await openQuestion(page);
    await typeWithKeypad(page, answer, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionFeedback")).toHaveText("Doğru!");
    await expect(page.locator(".numpad-key").first()).toBeDisabled();
    await expect(page.locator("#questionDialog")).toBeHidden();
    expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(50);
    expect(await game(page, () => window.__MAVI_GAME__.player.shield)).toBeGreaterThan(10);
  });

  test("tuş takımıyla yanlış cevap puan vermez", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    const answer = await openQuestion(page, 2);
    await typeWithKeypad(page, answer + 1, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionFeedback")).toContainText("Yanlış cevap");
    await expect(page.locator("#questionDialog")).toBeHidden();
    expect(await game(page, () => window.__MAVI_GAME__.state.score)).toBe(0);
    expect(await game(page, () => window.__MAVI_GAME__.player.shield)).toBe(0);
  });

  test("tuş takımı ve Kontrol Et düğmesi ekrana tamamen sığar, tuşlar en az 48x48", async ({ page, consoleErrors }) => {
    await openGame(page);
    await startGame(page);
    await openQuestion(page);
    const vp = page.viewportSize();
    const dlg = await page.locator("#questionDialog").boundingBox();
    expect(dlg.y).toBeGreaterThanOrEqual(0);
    expect(dlg.y + dlg.height).toBeLessThanOrEqual(vp.height);
    expect(dlg.x).toBeGreaterThanOrEqual(0);
    expect(dlg.x + dlg.width).toBeLessThanOrEqual(vp.width);
    const keys = page.locator(".numpad-key");
    await expect(keys).toHaveCount(12);
    for (let i = 0; i < 12; i += 1) {
      const key = keys.nth(i);
      await expect(key).toBeInViewport({ ratio: 1 });
      const b = await key.boundingBox();
      expect(b.width).toBeGreaterThanOrEqual(48);
      expect(b.height).toBeGreaterThanOrEqual(48);
    }
    await expect(page.locator("#answerButton")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#answerButton")).toHaveText("Cevabı Kontrol Et");
    // İçerik pencere içinde kaydırma gerektirmeden görünür
    expect(await page.locator("#questionDialog").evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await expect(page.locator('[data-numpad="delete"]')).toHaveAttribute("aria-label", "Son rakamı sil");
    await expect(page.locator('[data-numpad="clear"]')).toHaveAttribute("aria-label", "Cevabı temizle");
  });

  test("dokunmatikte sistem klavyesi açılmaz (salt okunur), masaüstünde input yazılabilir", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page);
    await startGame(page);
    const answer = await openQuestion(page);
    const input = page.locator("#answerInput");
    await expect(input).toBeFocused();
    if (isTouchProject(testInfo)) {
      await expect(input).toHaveJSProperty("readOnly", true);
    } else {
      await expect(input).toHaveJSProperty("readOnly", false);
      await page.keyboard.type(String(answer));
      await expect(input).toHaveValue(String(answer));
      await page.keyboard.press("Enter");
      await expect(page.locator("#questionFeedback")).toHaveText("Doğru!");
    }
  });

  test("klavye ile tuş takımı: Tab ile tuşa gelip Enter, odak tuştayken rakam ve Backspace", async ({ page, consoleErrors }, testInfo) => {
    test.skip(isTouchProject(testInfo), "Fiziksel klavye senaryosu masaüstünde");
    await openGame(page);
    await startGame(page);
    await openQuestion(page);
    await expect(page.locator("#answerInput")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-digit="1"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.locator("#answerInput")).toHaveValue("11");
    await page.keyboard.press("7");
    await expect(page.locator("#answerInput")).toHaveValue("117");
    await page.keyboard.press("Backspace");
    await expect(page.locator("#answerInput")).toHaveValue("11");
    // Soru açıkken oyun hareket etmez
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyD");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBe(x0);
  });

  test("soru kapandıktan sonra dokunmatik hareket yeniden çalışır", async ({ page, consoleErrors }, testInfo) => {
    test.skip(!isTouchProject(testInfo), "Dokunmatik cihaz projelerinde çalışır");
    await openGame(page);
    await startGame(page);
    const answer = await openQuestion(page);
    await expect(page.locator("#touchControls")).toHaveClass(/is-disabled/);
    await typeWithKeypad(page, answer, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect(page.locator("#questionDialog")).toBeHidden();
    await expect(page.locator("#touchControls")).not.toHaveClass(/is-disabled/);
    const js = await joystickDriver(page);
    const x0 = await game(page, () => window.__MAVI_GAME__.player.x);
    await js.press(0, 0);
    await js.drag(1, 0);
    await page.waitForTimeout(300);
    await js.release();
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(x0 + 40);
  });
});

test.describe("Oyun sonu, skor ve boss", () => {
  test("oyun sonu: isim (A/D/W/boşluk dahil) yazılır, skor kaydedilir, yeniden başlar", async ({ page, consoleErrors }) => {
    await openGame(page);
    await startGame(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.state.score = 120;
      g.state.lives = 1;
      g.player.invuln = 0;
      g.test.hurtPlayer(false);
    });
    const dlg = page.locator("#gameOverDialog");
    await expect(dlg).toBeVisible();
    await expect(page.locator("#finalScore")).toHaveText("120");
    await page.keyboard.press("Escape");
    await expect(dlg).toBeVisible();
    const name = page.locator("#playerNameInput");
    await name.fill("");
    await name.pressSequentially("Ada Wd");
    await expect(name).toHaveValue("Ada Wd");
    await page.locator("#restartButton").click();
    await expect(dlg).toBeHidden();
    const st = await game(page, () => ({ ...window.__MAVI_GAME__.state, boss: null, particles: null }));
    expect(st.score).toBe(0);
    expect(st.lives).toBe(3);
    expect(st.level).toBe(1);
    expect(st.gameOver).toBe(false);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mavi-matematik-high-scores")));
    expect(saved[0]).toMatchObject({ name: "Ada Wd", score: 120, level: 1 });

    await page.reload();
    await expect(page.locator("#bestScore")).toBeVisible();
    await expect(page.locator("#bestScoreValue")).toContainText("120");
  });

  test("boss arenası: boss sorusu doğru cevaplanınca roket fırlar", async ({ page, consoleErrors }, testInfo) => {
    await openGame(page, "&boss=1&level=2");
    await startGame(page);
    expect(await game(page, () => window.__MAVI_GAME__.state.boss.active)).toBe(true);
    expect(await game(page, () => window.__MAVI_GAME__.state.level)).toBe(2);
    await game(page, () => {
      const box = window.__MAVI_GAME__.state.boss;
      box.fallingBoxes.push({ kind: "bossBox", x: 6600, y: 300, w: 54, h: 54, vy: 0, state: "closed", question: null, bump: 0, caught: false });
      window.__MAVI_GAME__.test.activateBox(box.fallingBoxes[box.fallingBoxes.length - 1]);
    });
    const answer = await game(page, () => window.__MAVI_GAME__.state.currentQuestion.answer);
    await enterAnswer(page, answer, testInfo);
    await pressKey(page, "#answerButton", testInfo);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.rockets.length)).toBeGreaterThan(0);
    await expect.poll(() => game(page, () => window.__MAVI_GAME__.state.boss.health), { timeout: 8000 }).toBe(5);
  });
});

test.describe("Ayarlar ve sağlamlık", () => {
  test("ses aç/kapat çalışır ve hatırlanır", async ({ page, consoleErrors }) => {
    await openGame(page);
    // Ses ayarı başlangıç ekranındaki Ayarlar panelinde
    await page.locator("#settingsButton").click();
    const toggle = page.locator("#soundToggleSettings");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toContainText("Ses: Kapalı");
    await page.reload();
    await page.locator("#settingsButton").click();
    await expect(page.locator("#soundToggleSettings")).toHaveAttribute("aria-pressed", "false");
    await page.locator('[data-panel="settings"] [data-panel-back]').click();
    await expect(page.locator("#menuDialog")).toBeHidden();
    await startGame(page);
    await expect(page.locator("#soundToggleGame")).toHaveAttribute("aria-label", /Ses kapalı/);
  });

  test("localStorage kullanılamazsa oyun çökmez", async ({ page, consoleErrors }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("engellendi", "SecurityError");
        }
      });
    });
    await openGame(page);
    await startGame(page);
    await game(page, () => {
      const g = window.__MAVI_GAME__;
      g.state.lives = 1;
      g.player.invuln = 0;
      g.test.hurtPlayer(false);
    });
    await page.locator("#restartButton").click();
    await expect(page.locator("#gameOverDialog")).toBeHidden();
    expect(await game(page, () => window.__MAVI_GAME__.state.lives)).toBe(3);
  });

  test("görseller yüklenemese de oyun çalışır", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.route("**/assets/img/**", (route) => route.abort());
    await openGame(page);
    await startGame(page);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });
});

test.describe("PWA", () => {
  test("manifest geçerli ve ikonlar erişilebilir", async ({ page, request, consoleErrors }) => {
    await page.goto("./?nosw=1");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get(href);
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest).toMatchObject({
      name: "Mavi’nin Matematik Macerası",
      short_name: "Mavi Matematik",
      display: "standalone",
      orientation: "landscape",
      start_url: "./",
      lang: "tr"
    });
    const sizes = manifest.icons.map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const icon of manifest.icons) {
      const r = await request.get(icon.src);
      expect(r.ok()).toBe(true);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", /#/);
    // Kurulum istemi olmadan "Uygulamayı Yükle" düğmesi gizli kalır (kırık düğme yok).
    await expect(page.locator("#installButton")).toBeHidden();
  });

  test("beforeinstallprompt gelince Yükle düğmesi görünür ve istemi açar", async ({ page, consoleErrors }) => {
    await openGame(page);
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = () => {
        window.__promptCalled = true;
        return Promise.resolve();
      };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
    const btn = page.locator("#installButton");
    await expect(btn).toBeVisible();
    await btn.click();
    expect(await page.evaluate(() => window.__promptCalled)).toBe(true);
    await expect(btn).toBeHidden();
  });

  test("service worker kaydolur ve oyun çevrimdışı açılır", async ({ page, context, consoleErrors }) => {
    test.slow();
    await page.goto("./");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names.find((n) => n.startsWith("mavi-matematik-")));
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    expect(cached).toEqual(expect.arrayContaining(["/index.html", "/game.js", "/assets/img/enemy_boss_4_clean.png"]));

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#startDialog")).toBeVisible();
    await startGame(page);
    const imagesOk = await page.evaluate(() =>
      Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
    );
    expect(imagesOk).toBe(true);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    expect(await game(page, () => window.__MAVI_GAME__.player.x)).toBeGreaterThan(100);
    await context.setOffline(false);
  });
});
