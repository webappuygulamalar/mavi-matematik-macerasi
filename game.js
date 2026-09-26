(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const shieldPill = document.getElementById("shieldPill");
  const shieldTimerEl = document.getElementById("shieldTimer");
  const levelText = document.getElementById("levelText");
  const dialog = document.getElementById("questionDialog");
  const questionForm = document.getElementById("questionForm");
  const questionText = document.getElementById("questionText");
  const questionTimerFill = document.getElementById("questionTimerFill");
  const questionTimerText = document.getElementById("questionTimerText");
  const answerInput = document.getElementById("answerInput");
  const questionFeedback = document.getElementById("questionFeedback");
  const gameOverDialog = document.getElementById("gameOverDialog");
  const gameOverForm = document.getElementById("gameOverForm");
  const resultKicker = document.getElementById("resultKicker");
  const resultTitle = document.getElementById("resultTitle");
  const finalScore = document.getElementById("finalScore");
  const playerNameInput = document.getElementById("playerNameInput");
  const savedScoreStatus = document.getElementById("savedScoreStatus");
  const highScoresList = document.getElementById("highScoresList");
  const toast = document.getElementById("toast");
  const questionTimerBar = dialog.querySelector(".question-timer");
  const answerButton = document.getElementById("answerButton");
  const numpad = document.getElementById("numpad");
  const numpadKeys = Array.from(numpad.querySelectorAll("button"));
  const startDialog = document.getElementById("startDialog");
  const startButton = document.getElementById("startButton");
  const bestScoreEl = document.getElementById("bestScore");
  const bestScoreValue = document.getElementById("bestScoreValue");
  const rotateDialog = document.getElementById("rotateDialog");
  const touchControls = document.getElementById("touchControls");
  const joystick = document.getElementById("joystick");
  const joystickBase = joystick.querySelector(".joystick-base");
  const joystickKnob = joystick.querySelector(".joystick-knob");
  const jumpButton = touchControls.querySelector('[data-action="jump"]');
  const soundToggles = Array.from(document.querySelectorAll(".sound-toggle"));
  const levelIntro = document.getElementById("levelIntro");
  const levelIntroTitle = document.getElementById("levelIntroTitle");
  const levelIntroFocus = document.getElementById("levelIntroFocus");
  const summaryDialog = document.getElementById("levelSummaryDialog");
  const summaryTitle = document.getElementById("summaryTitle");
  const summaryScore = document.getElementById("summaryScore");
  const summaryCoins = document.getElementById("summaryCoins");
  const summaryAnswers = document.getElementById("summaryAnswers");
  const summaryAccuracy = document.getElementById("summaryAccuracy");
  const nextLevelButton = document.getElementById("nextLevelButton");
  const resultStats = document.getElementById("resultStats");
  const restartButton = document.getElementById("restartButton");

  const VIEW = { w: 1280, h: 720 };
  const WORLD = { w: 7500, h: 720 };
  const BOSS_ARENA = { start: 6420, end: 7480, bossX: 7060, floorY: 625 };
  const FINISH = { x: 7360, w: 70 };
  const GRAVITY = 1900;
  const MOVE_SPEED = 325;
  // Joystick merkezindeki ölü bölge: bu oranın altındaki sürükleme hareket üretmez.
  const JOYSTICK_DEAD_ZONE = 0.18;
  // Tam hıza yarıçapın bu oranında ulaşılır; parmağı tam kenara getirmek gerekmez.
  const JOYSTICK_FULL_AT = 0.95;
  const JUMP_SPEED = 1100;
  const MAX_FALL = 1150;
  const COIN_GAP = 10;
  const SHIELD_SECONDS = 15;
  const BOSS_SHIELD_SECONDS = 10;
  const MAX_SHIELD_HITS = 3;
  const QUESTION_SECONDS = 30;
  const MAX_ANSWER_DIGITS = 4;
  const BOSS_MAX_HEALTH = 6;
  const BOSS_BOX_SIZE = 54;
  const BOSS_BOX_BOSS_GAP = 280;
  const ROCKET_SALVO_COUNT = 3;
  const ROCKET_FLIGHT_SECONDS = 3;
  const HIGH_SCORE_KEY = "mavi-matematik-high-scores";
  const SOUND_KEY = "mavi-matematik-sound";
  // Kaynak sprite sheet 1664px genişliğinde ölçüldü; küçültülmüş kopyada kareler orantılı ölçeklenir.
  const SPRITE_SHEET_SOURCE_WIDTH = 1664;
  const MAX_RENDER_SCALE = 2;
  // Seviye tanımları level-data.js dosyasından gelir (platform, coin, kutu, düşman, tema, matematik profili).
  const LEVEL_DATA = window.MAVI_LEVEL_DATA;
  if (!LEVEL_DATA || !Array.isArray(LEVEL_DATA.levels)) {
    throw new Error("Seviye verisi (level-data.js) yüklenemedi.");
  }
  const LEVELS = LEVEL_DATA.levels;

  const keys = new Set();
  const assets = {
    player: loadImage("assets/img/player.png"),
    playerSheet: loadImage("assets/img/player_spritesheet_clean.png"),
    enemy: loadImage("assets/img/enemy.png"),
    // Kırmızı, mavi, yeşil roket gövdeleri (tools/prepare-rocket-sprites.mjs ile üretildi)
    rockets: loadImage("assets/img/rockets.png"),
    bosses: [
      loadImage("assets/img/enemy_boss_clean.png"),
      loadImage("assets/img/enemy_boss_2_clean.png"),
      loadImage("assets/img/enemy_boss_3_clean.png"),
      loadImage("assets/img/enemy_boss_4_clean.png")
    ]
  };

  // axis: joystick'in yatay ekseni (-1 sol … +1 sağ, ölü bölge uygulanmış). jump: zıplama düğmesi.
  const touchInput = { axis: 0, jump: false };
  const jumpPointers = new Set();
  const stick = { pointerId: null, cx: 0, cy: 0, radius: 1, x: 0, y: 0 };
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const portraitQuery = window.matchMedia("(orientation: portrait) and (hover: none) and (pointer: coarse)");
  /* Kısa, yumuşak, çocuk dostu WebAudio sesleri. Her olayın kendine özgü imzası vardır.
   * Her not: dalga tipi, başlangıç/bitiş frekansı (kayma), süre, ses düzeyi, başlama gecikmesi. */
  const SOUND_DEFS = {
    jump: [{ type: "sine", f0: 380, f1: 660, dur: 0.12, gain: 0.05 }],
    land: [{ type: "triangle", f0: 150, f1: 90, dur: 0.09, gain: 0.045 }],
    coin: [
      { type: "triangle", f0: 988, dur: 0.06, gain: 0.06 },
      { type: "triangle", f0: 1319, dur: 0.1, gain: 0.06, at: 0.05 }
    ],
    box: [{ type: "triangle", f0: 300, f1: 470, dur: 0.11, gain: 0.06 }],
    correct: [
      { type: "sine", f0: 660, dur: 0.09, gain: 0.07 },
      { type: "sine", f0: 880, dur: 0.14, gain: 0.07, at: 0.08 }
    ],
    wrong: [{ type: "triangle", f0: 260, f1: 170, dur: 0.24, gain: 0.05 }],
    shieldOn: [{ type: "sine", f0: 520, f1: 940, dur: 0.26, gain: 0.05 }],
    shieldOff: [{ type: "triangle", f0: 300, f1: 200, dur: 0.18, gain: 0.04 }],
    shieldBlock: [{ type: "sine", f0: 760, f1: 520, dur: 0.12, gain: 0.05 }],
    stomp: [{ type: "sine", f0: 520, f1: 200, dur: 0.14, gain: 0.07 }],
    hurt: [{ type: "triangle", f0: 330, f1: 140, dur: 0.28, gain: 0.06 }],
    rocket: [{ type: "sawtooth", f0: 160, f1: 560, dur: 0.4, gain: 0.022 }],
    bossHit: [
      { type: "square", f0: 120, f1: 70, dur: 0.2, gain: 0.03 },
      { type: "sine", f0: 240, f1: 160, dur: 0.2, gain: 0.05 }
    ],
    bossFire: [{ type: "sine", f0: 210, f1: 150, dur: 0.08, gain: 0.02 }],
    bossAppear: [
      { type: "triangle", f0: 196, dur: 0.16, gain: 0.05 },
      { type: "triangle", f0: 165, dur: 0.22, gain: 0.05, at: 0.14 }
    ],
    levelComplete: [523, 659, 784, 1047].map((f0, i) => ({ type: "triangle", f0, dur: 0.14, gain: 0.06, at: i * 0.1 }))
  };

  const sounds = createSoundBoard();
  const state = {
    started: false,
    orientationBlocked: false,
    soundEnabled: readStorage(SOUND_KEY) !== "off",
    renderScale: 1,
    score: 0,
    lives: 3,
    level: 1,
    cameraX: 0,
    paused: false,
    activeBox: null,
    currentQuestion: null,
    questionTimer: 0,
    boss: createBossState(),
    gameOver: false,
    resultSaved: false,
    particles: [],
    fireworks: [],
    bossCelebration: null,
    footstepTimer: 0,
    toastTimer: 0,
    lastTime: performance.now(),
    debug: new URLSearchParams(window.location.search).get("debug") === "1",
    // Yalnızca görsel: kamera ileri bakış ofseti, efekt zamanlayıcıları, FPS ölçümü
    cameraLook: 0,
    victoryPose: false,
    // Seviye akışı ve istatistikler
    introActive: false,
    introTimer: 0,
    summaryOpen: false,
    manualStep: false,
    geometryLevel: 0,
    lastSafe: { x: 90, footY: 635 },
    levelStats: { coins: 0, questions: 0, correct: 0, scoreStart: 0 },
    totalStats: { coins: 0, questions: 0, correct: 0 },
    pendingAnswerFx: null,
    fps: 60,
    fx: { shakeTime: 0, shakeDuration: 0, shakeStrength: 0, rings: [], successGlow: 0, wrongPulse: 0, time: 0 }
  };

  // Aktif seviyenin geometrisi. Diziler yerinde doldurulur (dış referanslar geçerli kalır).
  const platforms = [];
  const boxes = [];
  const coins = [];
  const enemies = [];

  const player = {
    kind: "player",
    x: 90,
    y: 420,
    prevY: 420,
    w: 46,
    h: 104,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    invuln: 0,
    shield: 0,
    shieldHits: 0,
    animTime: 0,
    // Animasyon durum makinesi (yalnızca görsel; fizik değerlerini okumakla yetinir)
    anim: createPlayerAnimState(),
    sprite: {
      image: assets.player,
      sheet: assets.playerSheet,
      drawW: 84,
      drawH: 128,
      footOffsetX: 0,
      footOffsetY: 0
    }
  };

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function platform(x, y, w, h, type) {
    return { x, y, w, h, type };
  }

  function questionBox(x, y) {
    return {
      kind: "box",
      x,
      y,
      w: 54,
      h: 54,
      state: "closed",
      question: null,
      bump: 0
    };
  }

  function coin(x, surfaceY) {
    const size = 30;
    return {
      kind: "coin",
      x,
      y: surfaceY - COIN_GAP - size,
      w: size,
      h: size,
      collected: false,
      spin: Math.random() * Math.PI * 2
    };
  }

  function coinLine(startX, surfaceY, count, gap) {
    return Array.from({ length: count }, (_, i) => coin(startX + i * gap, surfaceY));
  }

  // Zıplama yayını gösteren coin dizisi: (x0,y0)→(x1,y1) merkez noktaları, ortası "lift" kadar yukarıda.
  function coinArc(x0, y0, x1, y1, lift, count) {
    const size = 30;
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t - lift * 4 * t * (1 - t);
      const c = coin(0, 0);
      c.x = Math.round(cx - size / 2);
      c.y = Math.round(cy - size / 2);
      return c;
    });
  }

  function expandCoinDefs(defs) {
    const out = [];
    for (const d of defs) {
      if (d[0] === "line") out.push(...coinLine(d[1], d[2], d[3], d[4]));
      else if (d[0] === "arc") out.push(...coinArc(d[1], d[2], d[3], d[4], d[5], d[6]));
      else if (d[0] === "coin") out.push(coin(d[1], d[2]));
    }
    return out;
  }

  // Seviye geometrisini veriden kurar. Boss arenası tüm seviyelerde aynıdır ve sona eklenir.
  function loadLevelGeometry(level) {
    const def = LEVELS[level - 1] || LEVELS[0];
    platforms.length = 0;
    for (const [x, y, w, h, type] of def.platforms) platforms.push(platform(x, y, w, h, type));
    const [ax, ay, aw, ah, atype] = LEVEL_DATA.arena.platform;
    platforms.push(platform(ax, ay, aw, ah, atype));
    boxes.length = 0;
    for (const [x, y] of def.boxes) boxes.push(questionBox(x, y));
    coins.length = 0;
    coins.push(...expandCoinDefs(def.coins), ...expandCoinDefs(LEVEL_DATA.arenaCoins));
    enemies.length = 0;
    for (const [x, surfaceY, minX, maxX, speed] of def.enemies) enemies.push(enemy(x, surfaceY, minX, maxX, speed));
    state.geometryLevel = level;
    state.lastSafe = { x: LEVEL_DATA.start.x, footY: LEVEL_DATA.start.footY };
  }

  function enemy(x, surfaceY, minX, maxX, speed = 85) {
    return {
      kind: "enemy",
      spawnX: x,
      spawnY: surfaceY - 68,
      x,
      y: surfaceY - 68,
      w: 62,
      h: 68,
      baseVx: -speed,
      vx: -speed,
      vy: 0,
      defeated: false,
      defeatTimer: 0,
      minX,
      maxX,
      facing: -1,
      animTime: 0,
      idlePulse: 0,
      // Görsel: adım fazı ve oyuncu yaklaşınca tepki (0–1)
      stepPhase: x * 0.013,
      alert: 0,
      sprite: {
        image: assets.enemy,
        drawW: 88,
        drawH: 92,
        footOffsetX: 0,
        footOffsetY: 0
      }
    };
  }

  function createBossState() {
    return {
      active: false,
      defeated: false,
      health: BOSS_MAX_HEALTH,
      x: BOSS_ARENA.bossX,
      y: BOSS_ARENA.floorY - 168,
      w: 146,
      h: 168,
      fireTimer: 1.1,
      boxTimer: 0.9,
      fires: [],
      fallingBoxes: [],
      rockets: [],
      rocketSalvoId: 0,
      shake: 0
    };
  }

  function createBossBox(x) {
    return {
      kind: "bossBox",
      x,
      y: 130,
      w: BOSS_BOX_SIZE,
      h: BOSS_BOX_SIZE,
      vy: 0,
      state: "closed",
      question: null,
      bump: 0,
      caught: false
    };
  }

  function topAt(x) {
    let best = platforms[0].y;
    for (const p of platforms) {
      if (x >= p.x && x <= p.x + p.w && p.y <= best) {
        best = p.y;
      }
    }
    return best;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function allSolids() {
    return platforms.concat(boxes);
  }

  function footY(body) {
    return body.y + body.h;
  }

  function setFootY(body, y) {
    body.y = y - body.h;
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    levelText.textContent = state.level;
    renderHearts(state.lives);
    if (player.shield > 0) {
      shieldPill.classList.add("active");
      shieldTimerEl.textContent = `${Math.ceil(player.shield)} sn`;
    } else {
      shieldPill.classList.remove("active");
      shieldTimerEl.textContent = "Pasif";
    }
  }

  function activateShield(seconds = SHIELD_SECONDS) {
    player.shield = seconds;
    player.shieldHits = 0;
    sounds.shieldOn();
  }

  function absorbShieldHit() {
    if (player.shield <= 0) return false;
    player.shieldHits += 1;
    player.invuln = 0.45;
    sounds.shieldBlock();

    if (player.shieldHits >= MAX_SHIELD_HITS) {
      player.shield = 0;
      player.shieldHits = 0;
      showToast("Kalkan kırıldı");
      sounds.shieldOff();
    } else {
      const remaining = MAX_SHIELD_HITS - player.shieldHits;
      showToast(`Kalkan korudu: ${remaining} hak`);
    }
    updateHud();
    return true;
  }

  function renderHearts(lives) {
    livesEl.replaceChildren();
    livesEl.setAttribute("aria-label", `${lives} kalp`);
    for (let i = 0; i < 3; i += 1) {
      const heart = document.createElement("span");
      heart.className = i < lives ? "heart" : "heart empty";
      livesEl.appendChild(heart);
    }
  }

  function addScore(value, label) {
    state.score += value;
    updateHud();
    if (label) showToast(label);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    state.toastTimer = 1.4;
  }

  function updateToast(dt) {
    if (state.toastTimer <= 0) return;
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) toast.classList.remove("show");
  }

  /* ---------- Matematik soru motoru (seviyenin mathProfile verisiyle) ----------
   * Toplama sonucu maxResult'u, çıkarma sonucu 0'ın altına düşmez; çarpma yalnızca verilen çarpanlarla.
   * Aynı soru arka arkaya gelmez. Testler setQuestionSeed ile deterministik üretim yapabilir. */
  let questionRng = Math.random;
  let lastQuestionText = "";

  function rngInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pickOperation(profile, rng) {
    const ops = ["add", "sub", "mul"].filter((k) => profile[k] && profile[k].weight > 0);
    const total = ops.reduce((sum, k) => sum + profile[k].weight, 0);
    let roll = rng() * total;
    for (const k of ops) {
      roll -= profile[k].weight;
      if (roll < 0) return k;
    }
    return ops[ops.length - 1];
  }

  function makeQuestion(profile, rng) {
    const op = pickOperation(profile, rng);
    if (op === "add") {
      const p = profile.add;
      const a = rngInt(rng, p.min, p.maxResult - p.min);
      const b = rngInt(rng, p.min, p.maxResult - a);
      return { text: `${a} + ${b}`, answer: a + b, op };
    }
    if (op === "sub") {
      const p = profile.sub;
      const a = rngInt(rng, p.minA, p.max);
      const b = rngInt(rng, p.minB, a - 1);
      return { text: `${a} - ${b}`, answer: a - b, op };
    }
    const p = profile.mul;
    const factor = p.factors[rngInt(rng, 0, p.factors.length - 1)];
    const other = rngInt(rng, p.min, p.max);
    const [a, b] = rng() < 0.5 ? [factor, other] : [other, factor];
    return { text: `${a} × ${b}`, answer: a * b, op };
  }

  function generateQuestion(level = state.level, rng = questionRng) {
    const profile = (LEVELS[level - 1] || LEVELS[0]).mathProfile;
    let q = makeQuestion(profile, rng);
    for (let i = 0; i < 20 && q.text === lastQuestionText; i += 1) q = makeQuestion(profile, rng);
    lastQuestionText = q.text;
    return q;
  }

  function setQuestionSeed(seed) {
    questionRng = seed === null ? Math.random : seededRandom(seed);
    lastQuestionText = "";
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function activateBox(box) {
    if (box.state !== "closed") return;
    box.state = "question";
    box.bump = 1;
    box.question = generateQuestion();
    state.activeBox = box;
    state.currentQuestion = box.question;
    state.questionTimer = QUESTION_SECONDS;
    state.paused = true;
    questionText.textContent = box.question.text;
    questionText.setAttribute("aria-label", box.question.text.replace("×", "çarpı").replace("-", "eksi").replace("+", "artı"));
    setQuestionFeedback("", "");
    dialog.classList.remove("answer-correct", "answer-wrong");
    state.pendingAnswerFx = null;
    spawnBoxHitFx(box);
    answerInput.value = "";
    // Dokunmatik cihazlarda sistem klavyesi açılmasın; cevap ekran tuş takımıyla girilir.
    // Alan yine odaklanabilir ve ekran okuyucular tarafından okunur.
    answerInput.readOnly = isTouchUi();
    setAnswerLocked(false);
    updateQuestionTimerUi();
    sounds.box();
    releaseAllInput();
    dialog.showModal();
    syncControlsEnabled();
    setTimeout(() => {
      // Kullanıcı bu arada pencerede başka bir öğeye (ör. Tab ile bir tuşa) geçtiyse odağı geri çekme.
      const active = document.activeElement;
      if (!dialog.contains(active) || active === dialog) answerInput.focus({ preventScroll: true });
    }, 50);
  }

  function isTouchUi() {
    return document.documentElement.classList.contains("is-touch");
  }

  function setAnswerLocked(locked) {
    answerButton.disabled = locked;
    for (const key of numpadKeys) key.disabled = locked;
  }

  // Ekran tuş takımı ve fiziksel klavye kısayolları cevabı yalnızca bu fonksiyonla değiştirir.
  function editAnswer(action, digit) {
    if (!state.currentQuestion || answerButton.disabled) return;
    const current = answerInput.value.replace(/\D/g, "");
    let next = current;
    if (action === "digit") {
      if (current.length >= MAX_ANSWER_DIGITS) return;
      next = current === "0" ? digit : current + digit;
    } else if (action === "delete") {
      next = current.slice(0, -1);
    } else if (action === "clear") {
      next = "";
    }
    answerInput.value = next;
    if (questionFeedback.classList.contains("is-wrong")) setQuestionFeedback("", "");
  }

  numpad.addEventListener("click", (event) => {
    const key = event.target.closest("button");
    if (!key || key.disabled) return;
    if (key.dataset.digit) editAnswer("digit", key.dataset.digit);
    else editAnswer(key.dataset.numpad);
  });
  numpad.addEventListener("contextmenu", (event) => event.preventDefault());

  // Odak tuş takımındayken (veya alan salt okunurken) fiziksel klavye ile rakam yazılabilsin.
  dialog.addEventListener("keydown", (event) => {
    const typingInInput = event.target === answerInput && !answerInput.readOnly;
    if (typingInInput || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      editAnswer("digit", event.key);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      editAnswer("delete");
    } else if (event.key === "Enter" && event.target === answerInput) {
      event.preventDefault();
      answerButton.click();
    }
  });

  function setQuestionFeedback(message, tone) {
    questionFeedback.textContent = message;
    questionFeedback.classList.toggle("is-correct", tone === "correct");
    questionFeedback.classList.toggle("is-wrong", tone === "wrong");
  }

  function completeBox(box) {
    box.state = "used";
    box.bump = 0;
    box.question = null;
    if (box.kind === "bossBox") box.caught = true;
  }

  questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.currentQuestion || !state.activeBox) return;
    const activeBox = state.activeBox;
    const isBossQuestion = activeBox.kind === "bossBox";
    const raw = answerInput.value.trim();
    if (!/^\d+$/.test(raw)) {
      setQuestionFeedback(raw === "" ? "Önce cevabını yaz." : "Lütfen sadece rakam yaz.", "wrong");
      if (!isTouchUi()) answerInput.focus({ preventScroll: true });
      return;
    }
    setAnswerLocked(true);
    const given = Number(raw);
    recordAnswer(given === state.currentQuestion.answer);
    if (given === state.currentQuestion.answer) {
      setQuestionFeedback("Doğru!", "correct");
      showAnswerFx("correct");
      addScore(50, isBossQuestion ? "+50 ve 10 sn kalkan" : "+50 ve 15 sn kalkan");
      activateShield(isBossQuestion ? BOSS_SHIELD_SECONDS : SHIELD_SECONDS);
      completeBox(activeBox);
      state.currentQuestion = null;
      state.questionTimer = 0;
      if (isBossQuestion) launchRocket();
      sounds.correct();
      closeQuestionSoon();
    } else {
      setQuestionFeedback(`Yanlış cevap. Doğrusu ${state.currentQuestion.answer}. Puan yok.`, "wrong");
      showAnswerFx("wrong");
      completeBox(activeBox);
      state.currentQuestion = null;
      state.questionTimer = 0;
      sounds.wrong();
      closeQuestionSoon();
    }
  });

  gameOverForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentScore();
    resetGame();
    state.paused = false;
    state.gameOver = false;
    gameOverDialog.close();
    returnFocusToGame();
    syncControlsEnabled();
    showLevelIntro();
  });

  // Esc veya Android geri tuşu soruyu/oyun sonunu yarıda kapatıp oyunu duraklatılmış bırakmasın.
  for (const modal of [dialog, gameOverDialog, startDialog, rotateDialog, summaryDialog]) {
    modal.addEventListener("cancel", (event) => event.preventDefault());
  }
  dialog.addEventListener("close", () => {
    if (state.currentQuestion && state.activeBox) dialog.showModal();
  });
  gameOverDialog.addEventListener("close", () => {
    if (state.gameOver) gameOverDialog.showModal();
  });
  summaryDialog.addEventListener("close", () => {
    if (state.summaryOpen) summaryDialog.showModal();
  });
  startDialog.addEventListener("close", () => {
    if (!state.started) startDialog.showModal();
  });

  function closeQuestionSoon() {
    setTimeout(() => {
      state.paused = false;
      state.activeBox = null;
      state.currentQuestion = null;
      state.questionTimer = 0;
      answerInput.blur();
      dialog.close();
      playPendingAnswerFx();
      releaseAllInput();
      returnFocusToGame();
      syncControlsEnabled();
    }, 650);
  }

  function returnFocusToGame() {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    canvas.focus({ preventScroll: true });
    // iOS klavye kapandıktan sonra sayfayı kaydırılmış bırakabiliyor.
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  }

  function isTypingTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  function isControlTarget(target) {
    return isTypingTarget(target) || target instanceof HTMLButtonElement;
  }

  window.addEventListener("keydown", (event) => {
    // Form alanları ve düğmeler kendi tuş davranışını korusun
    // (ör. oyuncu adında A, D, W, boşluk; düğmelerde Boşluk/Enter ile basma).
    if (isControlTarget(event.target)) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (state.introActive) {
      if (["Enter", "Space", "Escape"].includes(event.code)) hideLevelIntro();
      return;
    }
    if (!isGameInteractive()) return;
    keys.add(event.code);
    if (event.code === "F2") state.debug = !state.debug;
    unlockAudio();
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  /* ---------- Dokunmatik kontroller (Pointer Events) ---------- */

  function isGameInteractive() {
    return (
      state.started &&
      !state.paused &&
      !state.introActive &&
      !state.summaryOpen &&
      !state.orientationBlocked &&
      !dialog.open &&
      !gameOverDialog.open
    );
  }

  /* Yuvarlak analog joystick
   * - Parmağın joystick merkezine göre konumu, hareket yarıçapıyla sınırlanır (daire dışına çıkmaz).
   * - Yatay eksen -1…+1 aralığına normalize edilir, ölü bölge çıkarılıp yeniden ölçeklenir:
   *   az sürükleme yavaş, kenara yakın (%95) sürükleme MOVE_SPEED.
   * - Dikey sürükleme yalnızca topuzu oynatır; zıplama sadece zıplama düğmesinden gelir.
   * - Joystick kendi pointerId'sini izler; ikinci parmakla zıplama bağımsız çalışır. */
  function joystickGeometry() {
    const base = joystickBase.getBoundingClientRect();
    const knob = joystickKnob.getBoundingClientRect();
    return {
      cx: base.left + base.width / 2,
      cy: base.top + base.height / 2,
      // Topuz kenardan hafifçe taşabilir; böylece küçük ekranda bile yeterli sürükleme mesafesi kalır.
      radius: Math.max(1, base.width / 2 - knob.width * 0.2)
    };
  }

  function axisFromOffset(dx, dy, radius) {
    const distance = Math.hypot(dx, dy);
    const scale = distance > radius ? radius / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    const nx = x / radius;
    const magnitude = Math.abs(nx);
    const axis =
      magnitude <= JOYSTICK_DEAD_ZONE
        ? 0
        : Math.sign(nx) * Math.min(1, (magnitude - JOYSTICK_DEAD_ZONE) / (JOYSTICK_FULL_AT - JOYSTICK_DEAD_ZONE));
    return { x, y, axis };
  }

  function renderJoystick() {
    joystick.style.setProperty("--kx", `${stick.x.toFixed(1)}px`);
    joystick.style.setProperty("--ky", `${stick.y.toFixed(1)}px`);
    joystick.classList.toggle("is-active", stick.pointerId !== null);
    joystick.classList.toggle("is-moving", touchInput.axis !== 0);
  }

  function moveJoystick(event) {
    const result = axisFromOffset(event.clientX - stick.cx, event.clientY - stick.cy, stick.radius);
    stick.x = result.x;
    stick.y = result.y;
    touchInput.axis = result.axis;
    renderJoystick();
  }

  function resetJoystick() {
    if (stick.pointerId !== null) {
      try {
        if (joystick.hasPointerCapture(stick.pointerId)) joystick.releasePointerCapture(stick.pointerId);
      } catch (_) {
        // Yakalama zaten bırakılmış olabilir.
      }
    }
    stick.pointerId = null;
    stick.x = 0;
    stick.y = 0;
    touchInput.axis = 0;
    renderJoystick();
  }

  joystick.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    unlockAudio();
    if (!isGameInteractive() || stick.pointerId !== null) return;
    const geometry = joystickGeometry();
    stick.pointerId = event.pointerId;
    stick.cx = geometry.cx;
    stick.cy = geometry.cy;
    stick.radius = geometry.radius;
    try {
      joystick.setPointerCapture(event.pointerId);
    } catch (_) {
      // Bazı tarayıcılar yakalamayı reddedebilir; olaylar yine de akar.
    }
    moveJoystick(event);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stick.pointerId) return;
    event.preventDefault();
    moveJoystick(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    joystick.addEventListener(type, (event) => {
      if (event.pointerId === stick.pointerId) resetJoystick();
    });
  }
  joystick.addEventListener("contextmenu", (event) => event.preventDefault());

  function renderJumpButton() {
    touchInput.jump = jumpPointers.size > 0;
    jumpButton.classList.toggle("is-pressed", touchInput.jump);
  }

  jumpButton.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    unlockAudio();
    if (!isGameInteractive()) return;
    try {
      jumpButton.setPointerCapture(event.pointerId);
    } catch (_) {
      // Bazı tarayıcılar yakalamayı reddedebilir; olaylar yine de akar.
    }
    jumpPointers.add(event.pointerId);
    renderJumpButton();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    jumpButton.addEventListener(type, (event) => {
      if (jumpPointers.delete(event.pointerId)) renderJumpButton();
    });
  }
  touchControls.addEventListener("contextmenu", (event) => event.preventDefault());
  // Klavye/ekran okuyucu ile etkinleştirilen zıplama düğmesi kısa bir zıplama girdisi üretir.
  jumpButton.addEventListener("click", (event) => {
    if (event.detail !== 0 || !isGameInteractive()) return;
    touchInput.jump = true;
    setTimeout(() => renderJumpButton(), 180);
  });

  function releaseAllInput() {
    keys.clear();
    resetJoystick();
    jumpPointers.clear();
    renderJumpButton();
  }

  function syncControlsEnabled() {
    const enabled = isGameInteractive();
    touchControls.classList.toggle("is-disabled", !enabled);
    if (!enabled) releaseAllInput();
  }

  window.addEventListener("blur", releaseAllInput);
  window.addEventListener("pagehide", releaseAllInput);
  // Cihaz yönü değişince joystick merkezi yer değiştirir; basılı parmak sıfırlanır.
  window.addEventListener("orientationchange", releaseAllInput);
  if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
    window.screen.orientation.addEventListener("change", releaseAllInput);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAllInput();
  });

  // Dokunmatik cihaz tespiti: kaba işaretçi varsa ya da ilk dokunuş geldiğinde mobil kontrolleri göster.
  const coarseQuery = window.matchMedia("(any-pointer: coarse)");
  function setTouchMode(enabled) {
    document.documentElement.classList.toggle("is-touch", enabled);
  }
  setTouchMode(coarseQuery.matches || navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches);
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") setTouchMode(true);
      unlockAudio();
    },
    { capture: true, passive: true }
  );
  // Oyun alanında uzun basma menüsü ve iki parmak/çift dokunma yakınlaştırması engellenir.
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1 || !event.target.closest("dialog")) event.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("dblclick", (event) => {
    if (!isTypingTarget(event.target)) event.preventDefault();
  });

  function update(dt) {
    if (!state.started || state.orientationBlocked) return;
    updateToast(dt);
    if (state.introActive) {
      state.introTimer -= dt;
      if (state.introTimer <= 0) hideLevelIntro();
      updateHud();
      return;
    }
    updateQuestionTimer(dt);
    for (const box of boxes) box.bump = Math.max(0, box.bump - dt * 4);

    if (state.paused) {
      updateHud();
      return;
    }

    if (state.bossCelebration) {
      updateBossCelebration(dt);
      updatePlayerAnimation(dt);
      updateFx(dt);
      updateHud();
      return;
    }

    player.animTime += dt;
    if (player.shield > 0) {
      player.shield = Math.max(0, player.shield - dt);
      if (player.shield === 0) {
        player.shieldHits = 0;
        sounds.shieldOff();
      }
    }
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

    updatePlayer(dt);
    updatePlayerAnimation(dt);
    for (const e of enemies) updateEnemy(e, dt);
    updateFx(dt);
    updateBoss(dt);
    collectCoins();
    checkEnemyContacts();
    checkFinish();
    updateCamera(dt);
    updateHud();
  }

  function updateQuestionTimer(dt) {
    if (!state.currentQuestion || !state.activeBox) return;
    state.questionTimer = Math.max(0, state.questionTimer - dt);
    updateQuestionTimerUi();
    if (state.questionTimer > 0) return;
    const activeBox = state.activeBox;
    setQuestionFeedback("Süre bitti. Puan yok.", "wrong");
    recordAnswer(false);
    showAnswerFx("wrong");
    setAnswerLocked(true);
    completeBox(activeBox);
    state.currentQuestion = null;
    sounds.wrong();
    closeQuestionSoon();
  }

  function updateQuestionTimerUi() {
    const remaining = Math.max(0, state.questionTimer);
    const ratio = Math.max(0, Math.min(1, remaining / QUESTION_SECONDS));
    questionTimerFill.style.width = `${ratio * 100}%`;
    questionTimerText.textContent = `${Math.ceil(remaining)} sn`;
    questionTimerBar.setAttribute("aria-valuenow", String(Math.ceil(remaining)));
  }

  function updatePlayer(dt) {
    // Klavye yönü basılıysa öncelikli (tam hız); değilse joystick ekseni hızı orantılı belirler.
    let input = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) input -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) input += 1;
    if (input === 0) input = touchInput.axis;
    player.vx = input * MOVE_SPEED;
    if (input !== 0) player.facing = Math.sign(input);

    if ((keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space") || touchInput.jump) && player.grounded) {
      player.vy = -JUMP_SPEED;
      player.grounded = false;
      sounds.jump();
    }

    applyPhysics(player, dt, true);
    updatePlayerRunEffects(input, dt);
    if (state.boss.active && !state.boss.defeated) {
      player.x = Math.max(BOSS_ARENA.start + 26, Math.min(state.boss.x - player.w - 90, player.x));
    }

    if (player.grounded) rememberSafeGround();

    if (player.y > VIEW.h + 120) {
      hurtPlayer(true);
      // Çukura düşünce en son güvenle durulan zemine dön (çukurun üstüne değil)
      player.x = state.lastSafe.x;
      setFootY(player, state.lastSafe.footY);
      player.prevY = player.y;
      player.vx = 0;
      player.vy = 0;
    }
  }

  // Güvenli zemin: platformun kenarından en az 24 px içeride ve yakında devriye gezen düşman yok.
  function rememberSafeGround() {
    const foot = footY(player);
    for (const p of platforms) {
      if (Math.abs(p.y - foot) > 0.5) continue;
      if (player.x < p.x + 24 || player.x + player.w > p.x + p.w - 24) continue;
      const threatened = enemies.some((e) => !e.defeated && Math.abs(footY(e) - foot) < 2 && player.x + player.w > e.minX - 60 && player.x < e.maxX + 60);
      if (threatened) return;
      state.lastSafe = { x: player.x, footY: p.y };
      return;
    }
  }

  function updateEnemy(e, dt) {
    if (e.defeated) {
      e.defeatTimer = Math.max(0, e.defeatTimer - dt);
      return;
    }
    e.animTime += dt;
    e.vy = 0;
    e.x += e.vx * dt;
    if (e.x < e.minX) {
      e.x = e.minX;
      e.vx = Math.abs(e.vx);
    }
    if (e.x + e.w > e.maxX) {
      e.x = e.maxX - e.w;
      e.vx = -Math.abs(e.vx);
    }
    e.facing = e.vx >= 0 ? 1 : -1;
    updateEnemyVisual(e, dt);
  }

  function updatePlayerRunEffects(input, dt) {
    if (!player.grounded || input === 0) {
      state.footstepTimer = 0;
      return;
    }
    // Toz sıklığı gerçek hıza bağlı: yavaş yürüyüşte seyrek, koşuda sık.
    const speedRatio = Math.min(1, player.anim.speed / MOVE_SPEED);
    if (speedRatio < 0.15) return;
    state.footstepTimer -= dt;
    if (state.footstepTimer > 0) return;
    state.footstepTimer = 0.22 - speedRatio * 0.1;
    spawnDust(player.x + player.w / 2 - player.facing * 18, footY(player) + 1, -player.facing, speedRatio > 0.6 ? 3 : 2);
  }

  function applyPhysics(body, dt, canOpenBoxes) {
    body.vy = Math.min(MAX_FALL, body.vy + GRAVITY * dt);
    body.grounded = false;

    body.x += body.vx * dt;
    body.x = Math.max(0, Math.min(WORLD.w - body.w, body.x));
    for (const solid of allSolids()) {
      if (!rectsOverlap(body, solid)) continue;
      if (body.vx > 0) body.x = solid.x - body.w;
      if (body.vx < 0) body.x = solid.x + solid.w;
    }

    const previousY = body.y;
    body.prevY = previousY;
    body.y += body.vy * dt;
    for (const solid of allSolids()) {
      if (!rectsOverlap(body, solid)) continue;
      const wasAbove = previousY + body.h <= solid.y + 1;
      const wasBelow = previousY >= solid.y + solid.h - 1;
      if (body.vy >= 0 && wasAbove) {
        setFootY(body, solid.y);
        body.vy = 0;
        body.grounded = true;
        if (canOpenBoxes && solid.kind === "box") activateBox(solid);
      } else if (body.vy < 0 && wasBelow) {
        body.y = solid.y + solid.h;
        body.vy = 90;
        if (canOpenBoxes && solid.kind === "box") activateBox(solid);
      }
    }
  }

  function collectCoins() {
    for (const c of coins) {
      if (c.collected) continue;
      c.spin += 0.14;
      if (rectsOverlap(player, c)) {
        c.collected = true;
        addScore(10, "+10 altın");
        state.levelStats.coins += 1;
        state.totalStats.coins += 1;
        spawnCoinSparkle(c.x + c.w / 2, c.y + c.h / 2);
        sounds.coin();
      }
    }
  }

  function checkEnemyContacts() {
    for (const e of enemies) {
      if (e.defeated) continue;
      if (!rectsOverlap(player, e)) continue;
      if (isStompingEnemy(e)) {
        defeatEnemy(e);
      } else if (player.shield > 0) {
        if (player.invuln <= 0 && absorbShieldHit()) {
          e.vx *= -1;
          e.x += e.vx > 0 ? 18 : -18;
        }
      } else if (player.invuln <= 0) {
        hurtPlayer(false);
      }
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss.active || boss.defeated) return;

    boss.shake = Math.max(0, boss.shake - dt * 6);

    if (boss.rockets.length > 0) {
      boss.fireTimer = 0.9;
      boss.boxTimer = 1.1;
      updateRockets(dt);
      return;
    }

    boss.fireTimer -= dt;
    boss.boxTimer -= dt;

    if (boss.fireTimer <= 0) {
      spawnBossFire();
      boss.fireTimer = Math.max(0.85, 1.65 - state.level * 0.1);
    }

    if (boss.boxTimer <= 0) {
      spawnBossBox();
      boss.boxTimer = Math.max(1.05, 2.1 - state.level * 0.12);
    }

    updateBossFires(dt);
    updateBossBoxes(dt);
    updateRockets(dt);
  }

  function spawnBossFire() {
    const y = BOSS_ARENA.floorY - 30;
    state.boss.fires.push({
      x: state.boss.x - 20,
      y,
      w: 58,
      h: 30,
      vx: -(260 + state.level * 18)
    });
    sounds.bossFire();
  }

  function updateBossFires(dt) {
    for (const fire of state.boss.fires) {
      fire.x += fire.vx * dt;
      if (rectsOverlap(player, fire)) {
        if (player.shield > 0) {
          if (player.invuln <= 0) absorbShieldHit();
          fire.x = BOSS_ARENA.start - 200;
        } else {
          hurtPlayer(false);
          fire.x = BOSS_ARENA.start - 200;
        }
      }
    }
    state.boss.fires = state.boss.fires.filter((fire) => fire.x + fire.w > BOSS_ARENA.start - 140);
  }

  function spawnBossBox() {
    const minX = BOSS_ARENA.start + 160;
    const maxX = Math.max(minX, state.boss.x - BOSS_BOX_BOSS_GAP - BOSS_BOX_SIZE);
    const x = rand(minX, maxX);
    state.boss.fallingBoxes.push(createBossBox(x));
  }

  function updateBossBoxes(dt) {
    for (const box of state.boss.fallingBoxes) {
      box.bump = Math.max(0, box.bump - dt * 4);
      if (box.caught || box.state !== "closed") continue;
      box.vy = Math.min(360, box.vy + 620 * dt);
      box.y += box.vy * dt;
      if (rectsOverlap(player, box)) activateBox(box);
      if (box.y + box.h >= BOSS_ARENA.floorY) {
        box.caught = true;
        spawnDust(box.x + box.w / 2, BOSS_ARENA.floorY, 1);
      }
    }
    state.boss.fallingBoxes = state.boss.fallingBoxes.filter((box) => !box.caught || box.state === "question");
  }

  function launchRocket() {
    if (!state.boss.active || state.boss.defeated) return;
    state.boss.fires = [];
    state.boss.fallingBoxes = [];
    const salvoId = state.boss.rocketSalvoId;
    state.boss.rocketSalvoId += 1;

    for (let i = 0; i < ROCKET_SALVO_COUNT; i += 1) {
      const startX = state.cameraX + 80 + i * 18;
      const startY = 96 + i * 58;
      const targetX = state.boss.x + state.boss.w * 0.36 - 18;
      const targetY = state.boss.y + 58 + i * 38;
      const dx = targetX - startX;
      const dy = targetY - startY;
      state.boss.rockets.push({
        x: startX,
        y: startY,
        startX,
        startY,
        targetX,
        targetY,
        w: 82,
        h: 24,
        elapsed: 0,
        duration: ROCKET_FLIGHT_SECONDS,
        angle: Math.atan2(dy, dx),
        color: ["#ef3f2e", "#22a8f4", "#78c83f"][i],
        trailColor: ["#ffb12b", "#4fe5ff", "#d7ff45"][i],
        salvoId,
        damagesBoss: i === 1,
        sprite: i,
        hit: false
      });
    }
    showToast("Üç roket geliyor");
    sounds.rocket();
  }

  function updateRockets(dt) {
    for (const rocket of state.boss.rockets) {
      rocket.elapsed += dt;
      const t = Math.min(1, rocket.elapsed / rocket.duration);
      const eased = t * t * (3 - 2 * t);
      rocket.x = rocket.startX + (rocket.targetX - rocket.startX) * eased;
      rocket.y = rocket.startY + (rocket.targetY - rocket.startY) * eased;
      spawnRocketSmoke(rocket);
      if (t >= 1) {
        rocket.hit = true;
        spawnRocketImpact(rocket.x + rocket.w / 2, rocket.y + rocket.h / 2);
        if (rocket.damagesBoss) damageBoss();
      }
    }
    state.boss.rockets = state.boss.rockets.filter((rocket) => !rocket.hit);
  }

  function spawnRocketImpact(x, y) {
    for (let i = 0; i < 7; i += 1) {
      pushParticle({
        kind: "spark",
        x,
        y,
        vx: rand(-80, 80),
        vy: rand(-95, 35),
        life: 0.34,
        maxLife: 0.34,
        size: rand(4, 9),
        gravity: 160,
        color: i % 2 === 0 ? "#ffb12b" : "#ff5938"
      });
    }
  }

  function damageBoss() {
    const boss = state.boss;
    if (boss.defeated) return;
    boss.health = Math.max(0, boss.health - 1);
    boss.shake = 1;
    onBossHitFx();
    sounds.bossHit();
    showToast(`Boss canı: ${boss.health}`);
    if (boss.health === 0) {
      defeatBoss();
    }
  }

  function defeatBoss() {
    const boss = state.boss;
    boss.defeated = true;
    boss.active = false;
    boss.fires = [];
    boss.fallingBoxes = [];
    boss.rockets = [];
    addScore(200, "Boss yenildi +200");
    startBossCelebration();
  }

  function startBossCelebration() {
    state.fireworks = [];
    state.bossCelebration = {
      timer: 3.2,
      burstTimer: 0,
      title: "Tebrikler!",
      subtitle: state.level < LEVELS.length ? `${currentLevel().name} tamamlandı` : "Tüm seviyeler tamamlandı"
    };
    spawnFirework(360, 190);
    spawnFirework(720, 145);
    spawnFirework(1010, 215);
    sounds.levelComplete();
  }

  function updateBossCelebration(dt) {
    const celebration = state.bossCelebration;
    if (!celebration) return;
    celebration.timer -= dt;
    celebration.burstTimer -= dt;
    if (celebration.burstTimer <= 0) {
      celebration.burstTimer = 0.42;
      spawnFirework(rand(250, 1040), rand(130, 300));
      spawnFirework(rand(180, 1100), rand(90, 220), "far");
    }
    updateFireworks(dt);
    if (celebration.timer <= 0) {
      state.bossCelebration = null;
      state.fireworks = [];
      completeLevel();
    }
  }

  // Havai fişekler iki derinlik katmanında: uzak (küçük, soluk, yavaş) ve yakın (büyük, parlak).
  function spawnFirework(x, y, depth = "near") {
    const colors = ["#ff4d6d", "#ffd166", "#2dd4bf", "#38bdf8", "#a78bfa"];
    const far = depth === "far";
    const count = Math.round((far ? 18 : 28) * fxIntensity());
    const cap = fireworkCap();
    for (let i = 0; i < count && state.fireworks.length < cap; i += 1) {
      const angle = (Math.PI * 2 * i) / count + rand(-8, 8) / 100;
      const speed = rand(75, 170) * (far ? 0.6 : 1);
      state.fireworks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: far ? 1.1 : 0.9,
        maxLife: far ? 1.1 : 0.9,
        size: rand(3, 6) * (far ? 0.6 : 1),
        depth,
        color: colors[i % colors.length]
      });
    }
  }

  function updateFireworks(dt) {
    let n = 0;
    for (const p of state.fireworks) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.depth === "far" ? 60 : 95) * dt;
      state.fireworks[n] = p;
      n += 1;
    }
    state.fireworks.length = n;
  }

  function bossBody() {
    return {
      x: state.boss.x,
      y: state.boss.y,
      w: state.boss.w,
      h: state.boss.h
    };
  }

  function isStompingEnemy(e) {
    const previousFoot = player.prevY + player.h;
    const currentFoot = footY(player);
    return player.vy > 0 && previousFoot <= e.y + 18 && currentFoot >= e.y;
  }

  function defeatEnemy(e) {
    e.defeated = true;
    e.defeatTimer = 0.45;
    player.vy = -620;
    player.grounded = false;
    setFootY(player, e.y - 2);
    showToast("Canavar yenildi");
    sounds.stomp();
    spawnEnemyDefeatPuff(e);
  }

  function hurtPlayer(fell) {
    if (!fell && player.invuln > 0) return;
    state.lives = Math.max(0, state.lives - 1);
    player.invuln = 1.4;
    player.anim.hurt = PLAYER_ANIM_TIMING.hurt;
    player.vy = -460;
    player.vx = -player.facing * 210;
    sounds.hurt();
    showToast(state.lives > 0 ? "Dikkat!" : "Oyun bitti");
    updateHud();
    if (state.lives === 0) showGameOver();
  }

  function showGameOver() {
    state.paused = true;
    state.gameOver = true;
    state.resultSaved = false;
    releaseAllInput();
    resultKicker.textContent = "Oyun Bitti";
    restartButton.textContent = "Yeniden Başlat";
    resultStats.textContent = `Doğru cevaplar: ${state.totalStats.correct}/${state.totalStats.questions} · Ulaşılan: ${levelTitle()}`;
    resultTitle.textContent = "Skor";
    finalScore.textContent = state.score;
    savedScoreStatus.textContent = "";
    renderHighScores(loadHighScores());
    gameOverDialog.showModal();
    syncControlsEnabled();
    setTimeout(() => playerNameInput.select(), 50);
  }

  function showVictory() {
    state.paused = true;
    state.gameOver = true;
    state.resultSaved = false;
    releaseAllInput();
    resultKicker.textContent = "Tebrikler";
    state.victoryPose = true;
    setPlayerAnimation("victory");
    resultTitle.textContent = "Macera Tamamlandı";
    restartButton.textContent = "Yeniden Oyna";
    const t = state.totalStats;
    const accuracy = t.questions > 0 ? `Genel doğruluk: ${accuracyText(t.correct, t.questions)} (${t.correct}/${t.questions})` : "Hiç soru cevaplanmadı";
    resultStats.textContent = `${accuracy} · Coin: ${t.coins}`;
    finalScore.textContent = state.score;
    savedScoreStatus.textContent = "";
    renderHighScores(loadHighScores());
    gameOverDialog.showModal();
    syncControlsEnabled();
    setTimeout(() => playerNameInput.select(), 50);
  }

  function loadHighScores() {
    try {
      const saved = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(isScoreEntry).slice(0, 10) : [];
    } catch (_) {
      return [];
    }
  }

  function isScoreEntry(entry) {
    return entry && typeof entry.name === "string" && Number.isFinite(entry.score);
  }

  function saveHighScores(scores) {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores.slice(0, 10)));
  }

  function saveCurrentScore() {
    if (state.resultSaved) return;
    const name = sanitizePlayerName(playerNameInput.value);
    const scores = loadHighScores();
    scores.push({
      name,
      score: state.score,
      level: state.level,
      date: new Date().toISOString()
    });
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, 10);
    try {
      saveHighScores(topScores);
      savedScoreStatus.textContent = "Skor kaydedildi.";
    } catch (_) {
      savedScoreStatus.textContent = "Skor kaydedilemedi.";
    }
    state.resultSaved = true;
    renderHighScores(topScores);
  }

  function sanitizePlayerName(value) {
    const trimmed = String(value || "").trim().slice(0, 16);
    return trimmed || "Oyuncu";
  }

  function renderHighScores(scores) {
    highScoresList.replaceChildren();
    if (scores.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "Henüz skor yok";
      highScoresList.appendChild(empty);
      return;
    }
    for (const entry of scores.slice(0, 10)) {
      const item = document.createElement("li");
      const row = document.createElement("span");
      const name = document.createElement("span");
      const score = document.createElement("span");
      row.className = "score-row";
      name.textContent = `${entry.name} (S${entry.level || 1})`;
      score.textContent = String(entry.score);
      row.append(name, score);
      item.appendChild(row);
      highScoresList.appendChild(item);
    }
  }

  function checkFinish() {
    if (player.x + player.w >= BOSS_ARENA.start && !state.boss.active && !state.boss.defeated) {
      startBossFight();
    }
  }

  function startBossFight() {
    state.boss.active = true;
    state.boss.health = BOSS_MAX_HEALTH;
    state.boss.fires = [];
    state.boss.fallingBoxes = [];
    state.boss.rockets = [];
    state.boss.fireTimer = 0.75;
    state.boss.boxTimer = 0.7;
    player.x = Math.max(player.x, BOSS_ARENA.start + 60);
    showToast("Büyük canavar!");
    sounds.bossAppear();
  }

  function completeLevel() {
    if (state.level < LEVELS.length) showLevelSummary();
    else showVictory();
  }

  /* ---------- Seviye akışı: istatistik, tanıtım, özet ---------- */

  function resetLevelStats() {
    state.levelStats = { coins: 0, questions: 0, correct: 0, scoreStart: state.score };
  }

  function recordAnswer(correct) {
    state.levelStats.questions += 1;
    state.totalStats.questions += 1;
    if (correct) {
      state.levelStats.correct += 1;
      state.totalStats.correct += 1;
    }
  }

  function accuracyText(correct, questions) {
    return questions > 0 ? `%${Math.round((correct / questions) * 100)}` : "—";
  }

  function levelTitle(level = state.level) {
    return `Seviye ${level} — ${LEVELS[level - 1].name}`;
  }

  // Seviye başında kısa tanıtım: en fazla ~2 sn, dokunarak/Enter ile geçilebilir; oyun bu sırada bekler.
  const LEVEL_INTRO_SECONDS = 2;

  function showLevelIntro() {
    levelIntroTitle.textContent = levelTitle();
    levelIntroFocus.textContent = currentLevel().mathProfile.focus;
    releaseAllInput();
    state.introActive = true;
    state.introTimer = LEVEL_INTRO_SECONDS;
    levelIntro.hidden = false;
    syncControlsEnabled();
  }

  function hideLevelIntro() {
    if (!state.introActive) return;
    state.introActive = false;
    state.introTimer = 0;
    levelIntro.hidden = true;
    releaseAllInput();
    state.lastTime = performance.now();
    syncControlsEnabled();
    if (!dialog.open && !gameOverDialog.open && !summaryDialog.open) returnFocusToGame();
  }

  levelIntro.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    unlockAudio();
    hideLevelIntro();
  });

  function showLevelSummary() {
    const st = state.levelStats;
    const def = currentLevel();
    const coinTotal = coins.length;
    summaryTitle.textContent = levelTitle();
    summaryScore.textContent = String(state.score - st.scoreStart);
    summaryCoins.textContent = `${st.coins} / ${coinTotal}`;
    summaryAnswers.textContent = `${st.correct} / ${st.questions}`;
    summaryAccuracy.textContent = accuracyText(st.correct, st.questions);
    state.summaryOpen = true;
    state.paused = true;
    releaseAllInput();
    summaryDialog.showModal();
    syncControlsEnabled();
    nextLevelButton.focus({ preventScroll: true });
    return def;
  }

  function proceedToNextLevel() {
    if (!state.summaryOpen) return;
    state.summaryOpen = false;
    summaryDialog.close();
    state.level += 1;
    state.lives = 3;
    resetLevelEntities();
    resetPlayerPosition();
    state.paused = false;
    updateHud();
    showLevelIntro();
  }

  nextLevelButton.addEventListener("click", () => {
    unlockAudio();
    proceedToNextLevel();
  });

  function resetGame() {
    state.score = 0;
    state.totalStats = { coins: 0, questions: 0, correct: 0 };
    state.lives = 3;
    state.level = 1;
    state.bossCelebration = null;
    state.fireworks = [];
    resetLevelEntities();
    resetPlayerPosition();
    state.cameraX = 0;
    state.gameOver = false;
    state.resultSaved = false;
    updateHud();
  }

  function resetPlayerPosition() {
    player.x = LEVEL_DATA.start.x;
    setFootY(player, LEVEL_DATA.start.footY);
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.shield = 0;
    player.shieldHits = 0;
    player.invuln = 0;
    player.grounded = false;
    state.cameraX = 0;
    state.cameraLook = 0;
    state.victoryPose = false;
    player.anim = createPlayerAnimState();
    releaseAllInput();
  }

  function resetLevelEntities() {
    loadLevelGeometry(state.level);
    resetLevelStats();
    const speedMultiplier = currentLevel().enemySpeed;
    for (const c of coins) c.collected = false;
    for (const b of boxes) {
      b.state = "closed";
      b.question = null;
      b.bump = 0;
    }
    for (const e of enemies) {
      e.x = e.spawnX;
      e.y = e.spawnY;
      e.vx = e.baseVx * speedMultiplier;
      e.facing = e.vx >= 0 ? 1 : -1;
      e.defeated = false;
      e.defeatTimer = 0;
    }
    resetBossState();
  }

  function resetBossState() {
    Object.assign(state.boss, createBossState());
  }

  function currentLevel() {
    return LEVELS[state.level - 1] || LEVELS[0];
  }

  function currentTheme() {
    return currentLevel().theme;
  }

  function currentBossImage() {
    return assets.bosses[state.level - 1] || assets.bosses[0];
  }

  /* =======================================================================
   * GÖRSEL KATMAN
   * Karakter animasyonu, 2.5D platformlar, parallax arka plan ve efektler.
   * Bu bölüm oyun durumunu yalnızca OKUR: çarpışma kutuları, platform koordinatları,
   * fizik değerleri ve oyun kuralları burada değiştirilmez.
   * ======================================================================= */

  /* ---------- Oyuncu animasyonu ---------- */

  // Poz kutuları kaynak sprite sheet koordinatlarındadır (1664 px genişlik); oyun %60 küçültülmüş
  // kopyayı kullanır ve koordinatları orantılı ölçekler. Değerler tools/prepare-player-sheet.mjs
  // ile ölçülmüştür. ax: gövde merkezinin kutu içindeki x'i, ay: ayak tabanının kutu içindeki y'si.
  const PLAYER_FRAMES = {
    "run-0": { sx: 0, sy: 69, sw: 318, sh: 474, ax: 180, ay: 474 },
    "run-1": { sx: 339, sy: 62, sw: 310, sh: 496, ax: 182, ay: 496 },
    "run-2": { sx: 698, sy: 61, sw: 288, sh: 495, ax: 156, ay: 495 },
    "run-3": { sx: 1044, sy: 64, sw: 290, sh: 494, ax: 153, ay: 494 },
    "run-4": { sx: 1372, sy: 68, sw: 292, sh: 484, ax: 174, ay: 484 },
    "walk-0": { sx: 24, sy: 880, sw: 251, sh: 520, ax: 122, ay: 520 },
    "walk-1": { sx: 379, sy: 880, sw: 229, sh: 519, ax: 113, ay: 519 },
    "walk-2": { sx: 711, sy: 880, sw: 236, sh: 516, ax: 117, ay: 516 },
    "walk-3": { sx: 1039, sy: 880, sw: 269, sh: 518, ax: 135, ay: 518 },
    "walk-4": { sx: 1401, sy: 880, sw: 249, sh: 520, ax: 125, ay: 520 },
    idle: { sx: 535, sy: 1470, sw: 186, sh: 488, ax: 93, ay: 488 },
    "jump-tuck": { sx: 466, sy: 2000, sw: 329, sh: 477, ax: 159, ay: 477 },
    victory: { sx: 1325, sy: 1998, sw: 307, sh: 508, ax: 156, ay: 508 }
  };

  // scale: kaynak pikselden dünya birimine ölçek (yürüme satırı kaynakta biraz daha büyük çizilmiş).
  // stride: bir karenin kaç dünya pikseli yürüyüşe karşılık geldiği → kare hızı gerçek hıza bağlı.
  // lean: yönle çarpılan hafif eğim (radyan).
  const PLAYER_ANIMATIONS = {
    idle: { frames: ["idle"], scale: 0.262 },
    walk: { frames: ["walk-0", "walk-1", "walk-2", "walk-3", "walk-4"], scale: 0.251, stride: 24 },
    run: { frames: ["run-0", "run-1", "run-2", "run-3", "run-4"], scale: 0.266, stride: 34, lean: 0.05 },
    "jump-start": { frames: ["run-1"], scale: 0.266 },
    "jump-up": { frames: ["run-2"], scale: 0.266, lean: -0.03 },
    apex: { frames: ["jump-tuck"], scale: 0.262 },
    fall: { frames: ["run-3"], scale: 0.266, lean: 0.04 },
    land: { frames: ["idle"], scale: 0.262 },
    hurt: { frames: ["jump-tuck"], scale: 0.262, lean: -0.16 },
    victory: { frames: ["victory"], scale: 0.262 }
  };

  const PLAYER_ANIM_TIMING = {
    jumpStart: 0.09, // zıplamanın ilk anı
    land: 0.13, // iniş sıkışması (100–160 ms)
    hurt: 0.38,
    apexBand: 260, // |vy| bu değerin altındaysa tepe noktası
    walkToRun: 0.62, // hız / MOVE_SPEED bu oranın üstünde koşu
    runToWalk: 0.55, // koşudan yürüyüşe dönüş eşiği (titremeyi önler)
    idleSpeed: 12, // px/sn altında boşta
    minAirForLand: 0.12 // bu süreden kısa havada kalışlarda iniş animasyonu oynamaz
  };

  function createPlayerAnimState() {
    return {
      name: "idle",
      frame: "idle",
      stateTime: 0,
      time: 0,
      distance: 0,
      speed: 0,
      lastX: null,
      wasGrounded: true,
      jumped: false,
      airTime: 0,
      peakFall: 0,
      jumpStart: 0,
      land: 0,
      hurt: 0
    };
  }

  function setPlayerAnimation(name) {
    const a = player.anim;
    if (a.name !== name) a.stateTime = 0;
    a.name = name;
    a.frame = PLAYER_ANIMATIONS[name].frames[0];
  }

  // Durum makinesi: fiziğin ürettiği gerçek hareketten animasyon seçer. FPS'ten bağımsızdır.
  function updatePlayerAnimation(dt) {
    const a = player.anim;
    const T = PLAYER_ANIM_TIMING;
    if (a.lastX === null) a.lastX = player.x;
    // Gerçek yer değiştirme: duvara yaslanınca yerinde koşma olmaz.
    if (dt > 0) a.speed = Math.min(MOVE_SPEED * 1.2, Math.abs(player.x - a.lastX) / dt);
    a.lastX = player.x;
    a.time += dt;
    a.jumpStart = Math.max(0, a.jumpStart - dt);
    a.land = Math.max(0, a.land - dt);
    a.hurt = Math.max(0, a.hurt - dt);

    if (a.wasGrounded && !player.grounded) {
      a.airTime = 0;
      a.peakFall = 0;
      a.jumped = player.vy < -300;
      if (a.jumped) {
        a.jumpStart = T.jumpStart;
        spawnJumpDust(player.x + player.w / 2, footY(player));
      }
    }
    if (!player.grounded) {
      a.airTime += dt;
      a.peakFall = Math.max(a.peakFall, player.vy);
    } else if (!a.wasGrounded) {
      if (a.airTime >= T.minAirForLand) {
        a.land = T.land;
        spawnLandingDust(player.x + player.w / 2, footY(player), a.peakFall);
        sounds.land();
      }
      a.airTime = 0;
      a.jumped = false;
    }
    a.wasGrounded = player.grounded;

    let name;
    if (state.victoryPose || state.bossCelebration) name = "victory";
    else if (a.hurt > 0) name = "hurt";
    else if (!player.grounded) {
      if (a.jumpStart > 0) name = "jump-start";
      else if (player.vy < -T.apexBand) name = "jump-up";
      else if (a.jumped && player.vy <= T.apexBand) name = "apex";
      else name = "fall";
    } else if (a.land > 0) name = "land";
    else if (a.speed < T.idleSpeed) name = "idle";
    else {
      const ratio = a.speed / MOVE_SPEED;
      name = (a.name === "run" ? ratio > T.runToWalk : ratio >= T.walkToRun) ? "run" : "walk";
    }

    if (name !== a.name) a.stateTime = 0;
    else a.stateTime += dt;
    a.name = name;
    const def = PLAYER_ANIMATIONS[name];
    if (def.stride) {
      a.distance += a.speed * dt;
      a.frame = def.frames[Math.floor(a.distance / def.stride) % def.frames.length];
    } else {
      a.frame = def.frames[0];
    }
  }

  // Çizim dönüşümü: ayak noktası (çarpışma kutusunun alt ortası) sabit kalır; ölçek ve eğim
  // bu nokta etrafında uygulanır. Hem çizimde hem testlerde kullanılır.
  function playerVisualState() {
    const a = player.anim;
    const def = PLAYER_ANIMATIONS[a.name] || PLAYER_ANIMATIONS.idle;
    const frame = PLAYER_FRAMES[a.frame] || PLAYER_FRAMES.idle;
    const reduced = reducedMotionQuery.matches;
    let sx = 1;
    let sy = 1;
    if (a.name === "idle" && !reduced) {
      const breathe = Math.sin(a.time * 2.4);
      sy = 1 + breathe * 0.012;
      sx = 1 - breathe * 0.006;
    } else if (a.name === "land") {
      const k = Math.sin(Math.PI * (1 - a.land / PLAYER_ANIM_TIMING.land));
      sy = 1 - 0.07 * k;
      sx = 1 + 0.05 * k;
    } else if (a.name === "jump-start") {
      sy = 1.05;
      sx = 0.96;
    }
    const facing = player.facing < 0 ? -1 : 1;
    const lean = (def.lean || 0) * (a.name === "hurt" ? a.hurt / PLAYER_ANIM_TIMING.hurt : 1);
    const scale = def.scale;
    const footX = player.x + player.w / 2;
    const footYv = footY(player);
    // Ayak tabanı ay satırında: çizilen görüntünün alt kenarı her karede ayak noktasına denk gelir.
    const left = footX + facing * (0 - frame.ax) * scale * sx;
    const right = footX + facing * (frame.sw - frame.ax) * scale * sx;
    return {
      animation: a.name,
      frameName: a.frame,
      frame,
      scale,
      sx,
      sy,
      tilt: lean * facing,
      facing,
      footX,
      footY: footYv,
      spriteBottom: footYv + (frame.sh - frame.ay) * scale * sy,
      spriteLeft: Math.min(left, right),
      spriteRight: Math.max(left, right)
    };
  }

  function drawPlayer() {
    if (player.shield > 0) drawShield(player);
    // Mevcut hasar sonrası yanıp sönme davranışı korunur.
    if (player.invuln > 0 && Math.floor(player.invuln * 16) % 2 === 0) return;
    const v = playerVisualState();
    drawGroundShadow(v.footX, v.footY, 50);
    ctx.save();
    ctx.translate(v.footX, v.footY);
    ctx.rotate(v.tilt);
    ctx.scale(v.facing * v.sx, v.sy);
    const sheet = assets.playerSheet;
    if (sheet.complete && sheet.naturalWidth > 0) {
      const k = sheet.naturalWidth / SPRITE_SHEET_SOURCE_WIDTH;
      const f = v.frame;
      ctx.drawImage(sheet, f.sx * k, f.sy * k, f.sw * k, f.sh * k, -f.ax * v.scale, -f.ay * v.scale, f.sw * v.scale, f.sh * v.scale);
    } else if (assets.player.complete && assets.player.naturalWidth > 0) {
      // Sprite sheet yüklenemezse tekli görsel (eski davranış)
      ctx.drawImage(assets.player, -42, -128, 84, 128);
    } else {
      ctx.fillStyle = "#2f85dc";
      roundRect(-23, -112, 46, 112, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Düşman görseli ---------- */

  const ENEMY_DEFEAT_TIME = 0.45;

  function updateEnemyVisual(e, dt) {
    e.stepPhase += Math.abs(e.vx) * dt * 0.11;
    const dx = player.x + player.w / 2 - (e.x + e.w / 2);
    const dy = Math.abs(footY(player) - footY(e));
    const target = Math.abs(dx) < 230 && dy < 160 ? 1 : 0;
    e.alert += (target - e.alert) * Math.min(1, dt * 6);
    e.lookDir = dx >= 0 ? 1 : -1;
  }

  function enemyVisualState(e) {
    if (e.defeated) {
      const t = 1 - Math.max(0, e.defeatTimer) / ENEMY_DEFEAT_TIME;
      const ease = 1 - (1 - t) * (1 - t);
      return { sx: 1 + 0.35 * ease, sy: Math.max(0.15, 1 - 0.8 * ease), tilt: 0, alpha: Math.max(0, 1 - t * t), visible: e.defeatTimer > 0 };
    }
    const step = Math.sin(e.stepPhase);
    const bounce = Math.abs(step);
    const alert = e.alert || 0;
    return {
      sx: 1 - bounce * 0.02 + alert * 0.015,
      sy: 1 + bounce * 0.04 + alert * 0.03,
      tilt: step * 0.045 + alert * 0.05 * (e.lookDir || 1),
      alpha: 1,
      visible: true
    };
  }

  function drawEnemy(e) {
    const v = enemyVisualState(e);
    if (!v.visible) return;
    const cx = e.x + e.w / 2;
    const foot = footY(e);
    drawGroundShadow(cx, foot, 62 * v.sx, v.alpha);
    ctx.save();
    ctx.globalAlpha = v.alpha;
    ctx.translate(cx, foot);
    ctx.rotate(v.tilt);
    ctx.scale((e.facing < 0 ? -1 : 1) * v.sx, v.sy);
    const sprite = e.sprite;
    if (sprite.image.complete && sprite.image.naturalWidth > 0) {
      ctx.drawImage(sprite.image, -sprite.drawW / 2, -sprite.drawH, sprite.drawW, sprite.drawH);
    } else {
      ctx.fillStyle = "#c88be2";
      roundRect(-sprite.drawW / 2, -sprite.drawH, sprite.drawW, sprite.drawH, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Yardımcılar: renk, tuval, rastgele ---------- */

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixColor(a, b, t, alpha = 1) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
    return alpha >= 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  // Tekrarlanabilir desenler için küçük deterministik rastgele üretici
  function seededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cacheScale() {
    return Math.max(0.5, Math.min(state.renderScale, 2));
  }

  /* ---------- Yumuşak zemin gölgesi ---------- */

  const shadowSprite = (() => {
    const c = makeCanvas(128, 32);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 16, 2, 64, 16, 64);
    grad.addColorStop(0, "rgba(20, 38, 35, 0.55)");
    grad.addColorStop(0.55, "rgba(20, 38, 35, 0.3)");
    grad.addColorStop(1, "rgba(20, 38, 35, 0)");
    g.fillStyle = grad;
    g.setTransform(1, 0, 0, 0.25, 0, 12);
    g.beginPath();
    g.arc(64, 16, 64, 0, Math.PI * 2);
    g.fill();
    return c;
  })();

  function groundBelow(x, fromY) {
    let best = Infinity;
    for (const p of platforms) {
      if (x >= p.x && x <= p.x + p.w && p.y >= fromY - 2 && p.y < best) best = p.y;
    }
    return best;
  }

  // Gölge zemindeki gerçek noktaya bağlıdır; karakter yükseldikçe küçülür ve saydamlaşır.
  function drawGroundShadow(cx, footYv, width, alpha = 1) {
    const gy = groundBelow(cx, footYv);
    if (!Number.isFinite(gy)) return;
    const height = Math.max(0, gy - footYv);
    const f = Math.max(0.3, Math.min(1, 1 - height / 320));
    const w = width * f;
    const h = 16 * f;
    ctx.save();
    ctx.globalAlpha = f * alpha;
    ctx.drawImage(shadowSprite, cx - w / 2, gy - h / 2 + 2, w, h);
    ctx.restore();
  }

  /* ---------- 2.5D platformlar (önceden çizilip önbellekte tutulur) ---------- */

  const platformCache = new Map();
  let platformCacheKey = "";

  function drawPlatform(p, index) {
    const scale = cacheScale();
    const key = `${state.level}|${scale}`;
    if (key !== platformCacheKey) {
      platformCache.clear();
      platformCacheKey = key;
    }
    let entry = platformCache.get(index);
    if (!entry) {
      entry = renderPlatformSprite(p, index, currentTheme(), scale, levelAtmosphere(state.level).platformStyle);
      platformCache.set(index, entry);
    }
    ctx.drawImage(entry.canvas, p.x - entry.padX, p.y - entry.padTop, entry.w, entry.h);
  }

  // Üst yüzey, kenar ve dekorlar seviyenin platform stiline göre çizilir. Dekorlar küçük, soluk ve
  // çarpışmasızdır; platform yüzeyinin üstünde en fazla ~12 px yükselir.
  function drawPlatformTop(g, p, topColor, style, rnd) {
    const cap = g.createLinearGradient(0, 0, 0, 15);
    cap.addColorStop(0, mixColor(topColor, "#ffffff", 0.22));
    cap.addColorStop(0.55, topColor);
    cap.addColorStop(1, mixColor(topColor, "#000000", 0.12));
    g.fillStyle = cap;
    roundRect(0, 0, p.w, 15, 7, g);
    g.fill();
    g.strokeStyle = "rgba(255, 255, 255, 0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(7, 1.6);
    g.lineTo(p.w - 7, 1.6);
    g.stroke();

    if (style === "sandstone") {
      // Kumlu kenar: küçük çakıllar, saçak yok
      g.fillStyle = mixColor(topColor, "#000000", 0.18);
      for (let x = 6; x < p.w - 6; x += 10 + rnd() * 14) {
        g.beginPath();
        g.ellipse(x, 14, 3 + rnd() * 2, 2, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else if (style === "moonstone") {
      // Kristal saçaklar
      g.fillStyle = "rgba(170, 240, 255, 0.75)";
      for (let x = 6; x < p.w - 6; x += 9 + rnd() * 10) {
        const hgt = 4 + rnd() * 5;
        g.beginPath();
        g.moveTo(x - 2.5, 13);
        g.lineTo(x, 13 + hgt);
        g.lineTo(x + 2.5, 13);
        g.closePath();
        g.fill();
      }
    } else {
      // Çim/yosun saçakları ve üstte küçük çim uçları
      g.fillStyle = mixColor(topColor, "#000000", style === "moss" ? 0.16 : 0.08);
      for (let x = 3; x < p.w - 3; x += 6 + rnd() * 6) {
        const r = 3 + rnd() * 3;
        g.beginPath();
        g.arc(x, 13.5, r, 0, Math.PI);
        g.fill();
      }
      g.fillStyle = mixColor(topColor, "#ffffff", 0.3);
      for (let x = 6; x < p.w - 6; x += 7 + rnd() * 9) {
        const bh = 2 + rnd() * 4;
        g.beginPath();
        g.moveTo(x - 2, 1);
        g.lineTo(x + (rnd() - 0.5) * 2, -bh);
        g.lineTo(x + 2, 1);
        g.closePath();
        g.fill();
      }
    }

    // Dekorlar: yalnızca geniş zemin platformlarında, seyrek
    if (p.type !== "ground" || p.w < 250) return;
    const count = Math.floor(p.w / 170);
    for (let i = 0; i < count; i += 1) {
      const x = 30 + ((p.w - 60) * (i + 0.2 + rnd() * 0.6)) / count;
      g.save();
      g.globalAlpha = 0.85;
      if (style === "garden") {
        // Çiçek
        g.strokeStyle = mixColor(topColor, "#000000", 0.2);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, 1);
        g.lineTo(x, -7);
        g.stroke();
        g.fillStyle = rnd() < 0.5 ? "#ff9fb8" : "#fff08a";
        for (let k = 0; k < 5; k += 1) {
          const a = (Math.PI * 2 * k) / 5;
          g.beginPath();
          g.arc(x + Math.cos(a) * 2.6, -9 + Math.sin(a) * 2.6, 2, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(x, -9, 1.5, 0, Math.PI * 2);
        g.fill();
      } else if (style === "moss") {
        // Soluk mantar
        g.fillStyle = "#e8e2d6";
        g.fillRect(x - 1.5, -6, 3, 7);
        g.fillStyle = "#c9a8a0";
        g.beginPath();
        g.ellipse(x, -6, 6, 4, 0, Math.PI, 0);
        g.fill();
      } else if (style === "sandstone") {
        // Küçük kaya
        g.fillStyle = mixColor(topColor, "#000000", 0.3);
        g.beginPath();
        g.ellipse(x, -2, 7, 5, 0, Math.PI, 0);
        g.fill();
      } else if (style === "moonstone") {
        // Işıltılı kristal
        g.fillStyle = "rgba(180, 235, 255, 0.9)";
        g.beginPath();
        g.moveTo(x - 4, 1);
        g.lineTo(x - 1, -11);
        g.lineTo(x + 3, -6);
        g.lineTo(x + 4, 1);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  // Işık sol üstten gelir: üst yüzey açık, ön yüz koyu, sağ kenar gölgeli.
  // Çarpışma dikdörtgeni aynen kalır; hacim ön/alt tarafa doğru eklenir.
  function renderPlatformSprite(p, index, theme, scale, style = "garden") {
    const floating = p.type === "grass";
    const padX = 5;
    const padTop = 16; // üstteki küçük dekorlar için pay (yalnızca görsel)
    const under = floating ? 20 : 0;
    const w = p.w + padX * 2;
    const h = padTop + p.h + under + 2;
    const canvas = makeCanvas(w * scale, h * scale);
    const g = canvas.getContext("2d");
    g.scale(scale, scale);
    g.translate(padX, padTop);
    const rnd = seededRandom(index * 7919 + state.level * 104729);
    const topColor = floating ? theme.grass : theme.groundTop;

    // Yüzen platformun kayalık alt tarafı
    if (floating) {
      g.fillStyle = mixColor(theme.dirtBottom, "#000000", 0.25);
      g.beginPath();
      g.moveTo(4, p.h - 6);
      const steps = Math.max(4, Math.round(p.w / 38));
      for (let i = 1; i < steps; i += 1) {
        const x = (p.w * i) / steps;
        const depth = under * (0.45 + 0.55 * Math.sin((Math.PI * i) / steps)) * (0.75 + rnd() * 0.35);
        g.lineTo(x, p.h - 4 + depth);
      }
      g.lineTo(p.w - 4, p.h - 6);
      g.closePath();
      g.fill();
    }

    // Ön yüz (toprak)
    const front = g.createLinearGradient(0, 10, 0, p.h + under);
    front.addColorStop(0, theme.dirtTop);
    front.addColorStop(1, theme.dirtBottom);
    g.fillStyle = front;
    roundRect(0, 0, p.w, p.h, 9, g);
    g.fill();

    // Toprak dokusu: katman çizgileri, benekler ve küçük çakıllar
    g.save();
    roundRect(0, 0, p.w, p.h, 9, g);
    g.clip();
    g.strokeStyle = "rgba(60, 30, 15, 0.14)";
    g.lineWidth = 2;
    for (let y = 24; y < p.h - 4; y += 16 + rnd() * 10) {
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= p.w; x += 40) g.lineTo(x, y + (rnd() - 0.5) * 4);
      g.stroke();
    }
    const speckles = Math.round((p.w * p.h) / 170);
    for (let i = 0; i < speckles; i += 1) {
      const x = rnd() * p.w;
      const y = 16 + rnd() * (p.h - 16);
      g.fillStyle = rnd() < 0.5 ? "rgba(255, 236, 190, 0.16)" : "rgba(50, 25, 10, 0.16)";
      g.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 2);
    }
    const pebbles = Math.round(p.w / 55);
    for (let i = 0; i < pebbles; i += 1) {
      const x = 12 + rnd() * (p.w - 24);
      const y = 22 + rnd() * Math.max(4, p.h - 30);
      const r = 3 + rnd() * 4;
      g.fillStyle = mixColor(theme.dirtTop, "#ffffff", 0.18);
      g.beginPath();
      g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.28)";
      g.beginPath();
      g.ellipse(x - r * 0.4, y - r * 0.35, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Sağ kenar gölgesi, sol kenar ışığı ve alt koyulaşma
    const side = g.createLinearGradient(p.w - 18, 0, p.w, 0);
    side.addColorStop(0, "rgba(0, 0, 0, 0)");
    side.addColorStop(1, "rgba(0, 0, 0, 0.16)");
    g.fillStyle = side;
    g.fillRect(p.w - 18, 0, 18, p.h);
    g.fillStyle = "rgba(255, 255, 255, 0.07)";
    g.fillRect(0, 0, 6, p.h);
    const bottom = g.createLinearGradient(0, p.h * 0.55, 0, p.h);
    bottom.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottom.addColorStop(1, "rgba(0, 0, 0, 0.16)");
    g.fillStyle = bottom;
    g.fillRect(0, p.h * 0.55, p.w, p.h * 0.45);
    // Üst örtünün toprağa düşürdüğü gölge
    const lip = g.createLinearGradient(0, 13, 0, 24);
    lip.addColorStop(0, "rgba(0, 0, 0, 0.22)");
    lip.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = lip;
    g.fillRect(0, 13, p.w, 11);
    g.restore();

    if (style === "sandstone") {
      // Kumtaşı: belirgin yatay katmanlar
      g.save();
      roundRect(0, 0, p.w, p.h, 9, g);
      g.clip();
      for (let y = 20, k = 0; y < p.h + under; y += 14, k += 1) {
        g.fillStyle = k % 2 === 0 ? "rgba(255, 220, 170, 0.14)" : "rgba(90, 30, 15, 0.12)";
        g.fillRect(0, y, p.w, 7);
      }
      g.restore();
    }
    drawPlatformTop(g, p, topColor, style, rnd);
    return { canvas, padX, padTop, w, h };
  }

  /* ---------- Parallax arka plan ---------- */

  // Kamera hızının oranı. Oyun dünyası 1.0'dır.
  const PARALLAX_LAYERS = [
    { id: "far-clouds", factor: 0.07, drift: 6 },
    { id: "far-mountains", factor: 0.18 },
    { id: "mid-hills", factor: 0.42 },
    { id: "near-bushes", factor: 0.7 }
  ];
  const PARALLAX_TILE_W = VIEW.w;
  // Zemin platformları dünyanın her yerinde y ≥ 650 bölgesini örter; arka plan bu çizgiye kadar
  // çizilir. Böylece görünmeyen alan boyanmaz (telefonda doldurma maliyeti düşer).
  const BACKDROP_BOTTOM = 656;
  // Opak katmanların arkası boyanmaz: dağlar y≈530'dan, orta tepeler y≈600'den aşağısını tamamen örter.
  const SKY_BOTTOM = 530;
  const MOUNTAIN_BOTTOM = 600;
  // Çukurların görünen derinliği bu çizgiden aşağı çizilir (yakın katman bunun üstünü örter).
  const ABYSS_TOP = 646;

  // Seviye atmosferleri mevcut renk paletlerinden türetilir.
  // Seviye atmosferleri level-data.js içindeki "atmosphere" alanından gelir (ışık, sis, yıldız,
  // uzak/orta/yakın silüet türü ve platform stili).
  function levelAtmosphere(level) {
    return (LEVELS[level - 1] || LEVELS[0]).atmosphere;
  }

  // Periyodik üçgen dalga (0–1), döşeme kenarlarında birleşir.
  function tri(x, period, phase = 0) {
    const t = ((x * period) / PARALLAX_TILE_W + phase) % 1;
    return 1 - Math.abs(t * 2 - 1);
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function silhouette(g, fn, bottom) {
    g.beginPath();
    g.moveTo(0, bottom);
    for (let x = 0; x <= PARALLAX_TILE_W; x += 6) g.lineTo(x, fn(x));
    g.lineTo(PARALLAX_TILE_W, bottom);
    g.closePath();
  }

  // Uzak katman şekilleri: hepsi y ≥ 530'u tamamen örter (gökyüzü o çizgide biter).
  const FAR_SHAPES = {
    hills: (x) =>
      440 + 46 * Math.sin((Math.PI * 2 * 2 * x) / PARALLAX_TILE_W + 0.4) + 28 * Math.sin((Math.PI * 2 * 5 * x) / PARALLAX_TILE_W + 1.7) + 12 * Math.sin((Math.PI * 2 * 11 * x) / PARALLAX_TILE_W + 0.2),
    peaks: (x) => 500 - 100 * tri(x, 6, 0.1) - 50 * tri(x, 13, 0.35),
    mesas: (x) => {
      const a = Math.sin((Math.PI * 2 * 3 * x) / PARALLAX_TILE_W + 0.6) + 0.45 * Math.sin((Math.PI * 2 * 7 * x) / PARALLAX_TILE_W + 2.1);
      return 520 - 110 * smoothstep(0.05, 0.3, a) - 45 * smoothstep(0.75, 0.95, a);
    },
    spires: (x) => 505 - 130 * Math.pow(tri(x, 9, 0.2), 3) - 55 * tri(x, 4, 0.6)
  };

  let parallaxCache = null;

  function getParallax() {
    const scale = Math.min(cacheScale(), 1.25);
    const key = `${state.level}|${scale}`;
    if (!parallaxCache || parallaxCache.key !== key) parallaxCache = buildParallax(state.level, scale, key);
    return parallaxCache;
  }

  // Periyodik (döşenebilir) silüet: tam sayılı sinüs periyotları sayesinde kenarlar birleşir.
  function ridge(g, baseY, parts, bottom) {
    g.beginPath();
    g.moveTo(0, bottom);
    for (let x = 0; x <= PARALLAX_TILE_W; x += 8) {
      let y = baseY;
      for (const [amp, period, phase] of parts) y += amp * Math.sin((Math.PI * 2 * period * x) / PARALLAX_TILE_W + phase);
      g.lineTo(x, y);
    }
    g.lineTo(PARALLAX_TILE_W, bottom);
    g.closePath();
  }

  function buildParallax(level, scale, key) {
    const theme = (LEVELS[level - 1] || LEVELS[0]).theme;
    const atmo = levelAtmosphere(level);
    const rnd = seededRandom(level * 31337);

    // 1) Gökyüzü, ışık kaynağı, yıldızlar (ekrana sabit)
    const sky = makeCanvas(VIEW.w * scale, SKY_BOTTOM * scale);
    const sg = sky.getContext("2d");
    sg.scale(scale, scale);
    const grad = sg.createLinearGradient(0, 0, 0, VIEW.h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(0.55, theme.skyMid);
    grad.addColorStop(1, theme.skyBottom);
    sg.fillStyle = grad;
    sg.fillRect(0, 0, VIEW.w, VIEW.h);
    for (let i = 0; i < atmo.stars; i += 1) {
      sg.fillStyle = `rgba(255, 255, 255, ${0.35 + rnd() * 0.5})`;
      const r = 0.8 + rnd() * 1.4;
      sg.beginPath();
      sg.arc(rnd() * VIEW.w, rnd() * 330, r, 0, Math.PI * 2);
      sg.fill();
    }
    const L = atmo.light;
    const glow = sg.createRadialGradient(L.x, L.y, L.r * 0.6, L.x, L.y, L.r * 3.4);
    glow.addColorStop(0, atmo.glow);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    sg.fillStyle = glow;
    sg.fillRect(0, 0, VIEW.w, VIEW.h);
    sg.fillStyle = L.kind === "moon" ? "#f4f1ff" : theme.sun;
    sg.beginPath();
    sg.arc(L.x, L.y, L.r, 0, Math.PI * 2);
    sg.fill();
    if (L.kind === "moon") {
      sg.fillStyle = "rgba(170, 170, 220, 0.35)";
      sg.beginPath();
      sg.arc(L.x - 10, L.y - 8, L.r * 0.22, 0, Math.PI * 2);
      sg.arc(L.x + 12, L.y + 10, L.r * 0.16, 0, Math.PI * 2);
      sg.fill();
    }

    const layers = [];
    const tile = (id, y, h, paint) => {
      const def = PARALLAX_LAYERS.find((l) => l.id === id);
      const c = makeCanvas(PARALLAX_TILE_W * scale, h * scale);
      const g = c.getContext("2d");
      g.scale(scale, scale);
      g.translate(0, -y);
      paint(g);
      layers.push({ id, factor: def.factor, drift: def.drift || 0, canvas: c, y, h });
    };

    // 2) Çok uzak bulutlar: her bulut ayrı küçük sprite (saydam geniş döşeme boyanmaz)
    const clouds = [];
    const cloudCount = 6;
    for (let i = 0; i < cloudCount; i += 1) {
      const s = 0.6 + rnd() * 0.7;
      const w = 150 * s;
      const h = 60 * s;
      const c = makeCanvas(w * scale, h * scale);
      const g = c.getContext("2d");
      g.scale(scale, scale);
      g.fillStyle = atmo.cloud;
      g.globalAlpha = atmo.cloudAlpha;
      for (const [ox, oy, rx, ry] of [[0, 0, 46, 18], [30, -12, 34, 20], [-32, -4, 28, 14]]) {
        g.beginPath();
        g.ellipse(w / 2 + ox * s, h * 0.62 + oy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
        g.fill();
      }
      clouds.push({ canvas: c, x: (PARALLAX_TILE_W * (i + rnd() * 0.6)) / cloudCount - w / 2, y: 80 + rnd() * 150 - h * 0.62, w, h });
    }
    const cloudDef = PARALLAX_LAYERS.find((l) => l.id === "far-clouds");
    layers.push({ id: "far-clouds", factor: cloudDef.factor, drift: cloudDef.drift, sprites: clouds });

    // 3) Uzak silüetler (hava perspektifi: gökyüzü rengine yakın). Şekil seviyeye göre değişir.
    tile("far-mountains", 340, MOUNTAIN_BOTTOM - 340, (g) => {
      const shape = FAR_SHAPES[atmo.far] || FAR_SHAPES.hills;
      g.fillStyle = mixColor(theme.hill, theme.skyMid, 0.62);
      silhouette(g, shape, 690);
      g.fill();
      g.save();
      g.clip();
      if (atmo.far === "peaks") {
        // Karlı zirveler
        g.fillStyle = "rgba(255, 255, 255, 0.55)";
        g.fillRect(0, 340, PARALLAX_TILE_W, 55);
      } else if (atmo.far === "mesas") {
        // Kanyon katmanları
        g.fillStyle = "rgba(120, 50, 30, 0.14)";
        for (let y = 405; y < 530; y += 18) g.fillRect(0, y, PARALLAX_TILE_W, 7);
      } else if (atmo.far === "spires") {
        // Kristal yüzey ışıltısı
        g.fillStyle = "rgba(200, 220, 255, 0.18)";
        silhouette(g, (x) => shape(x) + 10, 690);
        g.translate(-10, 0);
        g.fill();
      } else {
        g.fillStyle = "rgba(255, 255, 255, 0.12)";
        silhouette(g, (x) => shape(x) + 12, 690);
        g.translate(-14, 0);
        g.fill();
      }
      g.restore();
      if (atmo.mist > 0) {
        const mist = g.createLinearGradient(0, 470, 0, 600);
        mist.addColorStop(0, "rgba(255, 255, 255, 0)");
        mist.addColorStop(1, `rgba(255, 255, 255, ${atmo.mist})`);
        g.fillStyle = mist;
        g.fillRect(0, 470, PARALLAX_TILE_W, 220);
      }
    });

    // 4) Orta mesafe tepeler ve ağaç öbekleri
    tile("mid-hills", 455, BACKDROP_BOTTOM - 455, (g) => {
      const mid = mixColor(theme.hill, theme.skyBottom, 0.3);
      g.fillStyle = mid;
      ridge(g, 540, [[34, 3, 1.1], [16, 7, 2.3], [6, 13, 0.6]], 720);
      g.fill();
      const ridgeAt = (x) => 540 + 34 * Math.sin((Math.PI * 2 * 3 * x) / PARALLAX_TILE_W + 1.1) + 16 * Math.sin((Math.PI * 2 * 7 * x) / PARALLAX_TILE_W + 2.3) + 6 * Math.sin((Math.PI * 2 * 13 * x) / PARALLAX_TILE_W + 0.6);
      const accent = mixColor(theme.hill, theme.skyBottom, 0.18);
      for (let i = 0; i < 8; i += 1) {
        const x = (PARALLAX_TILE_W * (i + rnd() * 0.7)) / 8;
        const r = 11 + rnd() * 9;
        for (const dx of [-PARALLAX_TILE_W, 0, PARALLAX_TILE_W]) {
          const bx = x + dx;
          const by = ridgeAt(x);
          g.fillStyle = accent;
          if (atmo.mid === "pines") {
            // Çam ağaçları: gövdesi sırtın içinde kalan üçgenler
            for (const [ox, k] of [[-r, 0.8], [0, 1.15], [r * 1.1, 0.9]]) {
              g.beginPath();
              g.moveTo(bx + ox - r * 0.6 * k, by + 8);
              g.lineTo(bx + ox, by - r * 3 * k);
              g.lineTo(bx + ox + r * 0.6 * k, by + 8);
              g.closePath();
              g.fill();
            }
          } else if (atmo.mid === "rocks") {
            // Kaya sütunları (kanyon hoodoo'ları)
            const h = 40 + rnd() * 50;
            roundRect(bx - r * 0.55, by - h, r * 1.1, h + 12, r * 0.5, g);
            g.fill();
            g.fillStyle = "rgba(255, 220, 180, 0.18)";
            g.fillRect(bx - r * 0.55, by - h * 0.6, r * 1.1, 5);
          } else if (atmo.mid === "crystals") {
            // Kristal kümeleri: yarı saydam açık kenarlı
            g.fillStyle = mixColor(theme.hill, "#bcd4ff", 0.35);
            for (const [ox, k] of [[-r * 0.7, 0.7], [0, 1.2], [r * 0.6, 0.85]]) {
              g.beginPath();
              g.moveTo(bx + ox - r * 0.35 * k, by + 6);
              g.lineTo(bx + ox - r * 0.2 * k, by - r * 2.4 * k);
              g.lineTo(bx + ox + r * 0.1 * k, by - r * 2.9 * k);
              g.lineTo(bx + ox + r * 0.35 * k, by + 6);
              g.closePath();
              g.fill();
            }
          } else {
            for (const [ox, k] of [[-r * 0.9, 0.75], [0, 1], [r * 0.9, 0.8]]) {
              g.beginPath();
              g.arc(bx + ox, ridgeAt(x + ox) + r * 0.25, r * k, 0, Math.PI * 2);
              g.fill();
            }
          }
        }
      }
    });

    // 5) Yakın çalı ve çimen detayları (soluk tutulur; coin ve kutuların önüne geçmez)
    tile("near-bushes", 590, BACKDROP_BOTTOM - 590, (g) => {
      const near = mixColor(theme.grass, theme.skyBottom, 0.35);
      g.fillStyle = near;
      ridge(g, 640, [[10, 4, 0.3], [5, 9, 1.9]], 720);
      g.fill();
      const bush = mixColor(theme.grass, theme.hill, 0.5);
      for (let i = 0; i < 12; i += 1) {
        const x = (PARALLAX_TILE_W * (i + rnd() * 0.8)) / 12;
        const r = 10 + rnd() * 14;
        const hue = rnd();
        for (const dx of [-PARALLAX_TILE_W, 0, PARALLAX_TILE_W]) {
          const bx = x + dx;
          g.fillStyle = bush;
          if (atmo.near === "desert") {
            // Küçük kayalar ve kaktüs silüetleri
            g.beginPath();
            g.ellipse(bx, 642, r, r * 0.45, 0, Math.PI, 0);
            g.fill();
            if (hue < 0.45) {
              roundRect(bx + r, 612, 8, 34, 4, g);
              g.fill();
              roundRect(bx + r - 9, 622, 8, 14, 4, g);
              g.fill();
              roundRect(bx + r + 9, 618, 8, 14, 4, g);
              g.fill();
            }
          } else if (atmo.near === "ferns") {
            g.beginPath();
            g.arc(bx, 640, r * 0.8, Math.PI, 0);
            g.fill();
            g.strokeStyle = bush;
            g.lineWidth = 3;
            for (let k = -2; k <= 2; k += 1) {
              g.beginPath();
              g.moveTo(bx + k * 4, 640);
              g.quadraticCurveTo(bx + k * 9, 626, bx + k * 14, 620 + Math.abs(k) * 4);
              g.stroke();
            }
          } else {
            g.beginPath();
            g.arc(bx, 640, r, Math.PI, 0);
            g.arc(bx + r, 642, r * 0.7, Math.PI, 0);
            g.fill();
            if (atmo.near === "flowers") {
              g.fillStyle = hue < 0.5 ? "rgba(255, 190, 210, 0.85)" : "rgba(255, 240, 150, 0.85)";
              for (let k = 0; k < 3; k += 1) {
                g.beginPath();
                g.arc(bx - r * 0.5 + k * r * 0.6, 632 - (k % 2) * 6, 2.6, 0, Math.PI * 2);
                g.fill();
              }
            } else if (atmo.near === "glow") {
              g.fillStyle = "rgba(170, 255, 240, 0.8)";
              for (let k = 0; k < 2; k += 1) {
                g.beginPath();
                g.arc(bx - r * 0.3 + k * r * 0.8, 628 - k * 5, 2.2, 0, Math.PI * 2);
                g.fill();
              }
            }
          }
        }
      }
    });

    // 6) Çukur derinliği: zeminin olmadığı yerde alt bant koyulaşır (su/gökyüzü gibi görünmesin,
    // çocuk tehlikeyi anlasın). Tek sütunluk önbellekli şerit olarak çizilir.
    const abyss = makeCanvas(4, 80);
    const ag = abyss.getContext("2d");
    const ab = ag.createLinearGradient(0, 0, 0, 80);
    ab.addColorStop(0, mixColor(theme.hill, "#000000", 0.3));
    ab.addColorStop(0.35, mixColor(theme.dirtBottom, "#000000", 0.45));
    ab.addColorStop(1, mixColor(theme.dirtBottom, "#000000", 0.7));
    ag.fillStyle = ab;
    ag.fillRect(0, 0, 4, 80);

    return { key, level, atmosphere: atmo.name, sky, layers, abyss };
  }

  function drawParallax() {
    const bg = getParallax();
    ctx.drawImage(bg.abyss, 0, ABYSS_TOP, VIEW.w, VIEW.h - ABYSS_TOP);
    ctx.drawImage(bg.sky, 0, 0, VIEW.w, SKY_BOTTOM);
    for (const layer of bg.layers) {
      const travel = state.cameraX * layer.factor + state.fx.time * layer.drift;
      const offset = -(((travel % PARALLAX_TILE_W) + PARALLAX_TILE_W) % PARALLAX_TILE_W);
      if (layer.sprites) {
        for (const sp of layer.sprites) {
          let x = sp.x + offset;
          if (x + sp.w < 0) x += PARALLAX_TILE_W;
          if (x > VIEW.w) continue;
          ctx.drawImage(sp.canvas, x, sp.y, sp.w, sp.h);
          if (x + PARALLAX_TILE_W < VIEW.w) ctx.drawImage(sp.canvas, x + PARALLAX_TILE_W, sp.y, sp.w, sp.h);
        }
        continue;
      }
      // Döşemeler 1 px üst üste biner: kesirli piksel sınırında açık renkli dikiş çizgisi oluşmaz.
      ctx.drawImage(layer.canvas, offset, layer.y, PARALLAX_TILE_W + 1, layer.h);
      ctx.drawImage(layer.canvas, offset + PARALLAX_TILE_W - 1, layer.y, PARALLAX_TILE_W + 1, layer.h);
    }
  }

  /* ---------- Parçacıklar ve efektler ---------- */

  // Üst sınırlar: telefon performansı için. Hareket azaltma açıkken daha düşük.
  const MAX_PARTICLES = 180;
  const MAX_PARTICLES_REDUCED = 60;
  const MAX_FIREWORKS = 260;
  const MAX_FIREWORKS_REDUCED = 90;
  const MAX_RINGS = 6;
  const SHAKE_MAX_PX = 3;

  function particleCap() {
    return reducedMotionQuery.matches ? MAX_PARTICLES_REDUCED : MAX_PARTICLES;
  }

  function fireworkCap() {
    return reducedMotionQuery.matches ? MAX_FIREWORKS_REDUCED : MAX_FIREWORKS;
  }

  // Hareket azaltma açıkken yoğun efektler seyreltilir.
  function fxIntensity() {
    return reducedMotionQuery.matches ? 0.35 : 1;
  }

  function pushParticle(p) {
    if (document.hidden || state.particles.length >= particleCap()) return false;
    state.particles.push(p);
    return true;
  }

  function spawnDust(x, y, direction, count = 3) {
    for (let i = 0; i < count; i += 1) {
      pushParticle({
        kind: "dust",
        x,
        y,
        vx: direction * rand(20, 55) + rand(-8, 8),
        vy: -rand(12, 32),
        life: 0.34,
        maxLife: 0.34,
        size: rand(4, 8),
        gravity: 160
      });
    }
  }

  function spawnJumpDust(x, y) {
    const count = Math.round(8 * fxIntensity());
    for (let i = 0; i < count; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      pushParticle({ kind: "dust", x: x + dir * rand(4, 14), y, vx: dir * rand(60, 130), vy: -rand(5, 25), life: 0.3, maxLife: 0.3, size: rand(4, 7), gravity: 60 });
    }
  }

  function spawnLandingDust(x, y, fallSpeed) {
    const strength = Math.min(1, fallSpeed / MAX_FALL);
    const count = Math.round((4 + strength * 8) * fxIntensity());
    for (let i = 0; i < count; i += 1) {
      const dir = i % 2 === 0 ? 1 : -1;
      pushParticle({ kind: "dust", x: x + dir * rand(6, 18), y, vx: dir * rand(50, 90 + strength * 90), vy: -rand(20, 60 + strength * 50), life: 0.42, maxLife: 0.42, size: rand(5, 9), gravity: 180 });
    }
  }

  function spawnSparks(x, y, count, colors, speed = 120, life = 0.5) {
    const n = Math.round(count * fxIntensity());
    for (let i = 0; i < n; i += 1) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const v = speed * (0.55 + Math.random() * 0.6);
      pushParticle({ kind: "spark", x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 40, life, maxLife: life, size: rand(3, 5), gravity: 220, color: colors[i % colors.length] });
    }
  }

  function spawnCoinSparkle(x, y) {
    spawnSparks(x, y, 8, ["#fff3a0", "#ffd33f", "#ffffff"], 130, 0.45);
  }

  function spawnBoxHitFx(box) {
    spawnSparks(box.x + box.w / 2, box.y + (box.kind === "bossBox" ? box.h / 2 : box.h), 6, ["#fff7bf", "#ffd557"], 110, 0.4);
  }

  function spawnEnemyDefeatPuff(e) {
    spawnSparks(e.x + e.w / 2, e.y + e.h * 0.4, 7, ["#ffffff", "#e9d5ff", "#ffd166"], 140, 0.5);
    addRing(e.x + e.w / 2, footY(e) - 10, 70, 0.35, "rgba(255, 255, 255, 0.8)");
  }

  function addRing(x, y, maxR, life, color) {
    if (reducedMotionQuery.matches || state.fx.rings.length >= MAX_RINGS) return;
    state.fx.rings.push({ x, y, r: 8, maxR, life, maxLife: life, color });
  }

  function shakeScreen(strength, duration) {
    // Yalnızca özel anlarda, en fazla birkaç piksel; hareket azaltma açıkken hiç sallama yok.
    if (reducedMotionQuery.matches) return;
    state.fx.shakeStrength = Math.min(SHAKE_MAX_PX, strength);
    state.fx.shakeDuration = duration;
    state.fx.shakeTime = duration;
  }

  function onBossHitFx() {
    const boss = state.boss;
    boss.hitFlash = 0.2;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h * 0.45;
    addRing(cx, cy, 150, 0.45, "rgba(255, 235, 170, 0.9)");
    spawnSparks(cx, cy, 10, ["#fff3a0", "#ff9f2d", "#ffffff"], 180, 0.5);
    shakeScreen(3, 0.18);
  }

  function showAnswerFx(result) {
    state.pendingAnswerFx = result;
    dialog.classList.remove("answer-correct", "answer-wrong");
    dialog.classList.add(result === "correct" ? "answer-correct" : "answer-wrong");
  }

  // Soru kapanınca oyun alanında kısa geri bildirim: doğru → yeşil-altın parlama, yanlış → yumuşak kırmızı.
  function playPendingAnswerFx() {
    const result = state.pendingAnswerFx;
    state.pendingAnswerFx = null;
    dialog.classList.remove("answer-correct", "answer-wrong");
    if (result === "correct") {
      state.fx.successGlow = 0.6;
      spawnSparks(player.x + player.w / 2, player.y + player.h * 0.4, 14, ["#7ee787", "#ffd33f", "#ffffff"], 170, 0.6);
      addRing(player.x + player.w / 2, player.y + player.h * 0.5, 110, 0.5, "rgba(126, 231, 135, 0.9)");
    } else if (result === "wrong") {
      state.fx.wrongPulse = 0.35;
    }
  }

  function updateFx(dt) {
    const fx = state.fx;
    fx.time += dt;
    fx.shakeTime = Math.max(0, fx.shakeTime - dt);
    fx.successGlow = Math.max(0, fx.successGlow - dt);
    fx.wrongPulse = Math.max(0, fx.wrongPulse - dt);
    if (state.boss.hitFlash) state.boss.hitFlash = Math.max(0, state.boss.hitFlash - dt);
    let n = 0;
    for (const p of state.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      p.vx *= 1 - Math.min(1, dt * 1.5);
      state.particles[n] = p;
      n += 1;
    }
    state.particles.length = n;
    let r = 0;
    for (const ring of fx.rings) {
      ring.life -= dt;
      if (ring.life <= 0) continue;
      ring.r = 8 + (ring.maxR - 8) * (1 - ring.life / ring.maxLife);
      fx.rings[r] = ring;
      r += 1;
    }
    fx.rings.length = r;
  }

  function drawParticles() {
    ctx.save();
    for (const p of state.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      if (p.kind === "spark") {
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        const s = p.size * (0.6 + t * 0.4);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 1.6);
        ctx.lineTo(p.x + s * 0.6, p.y);
        ctx.lineTo(p.x, p.y + s * 1.6);
        ctx.lineTo(p.x - s * 0.6, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "smoke") {
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = p.color || "#d9dde3";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = t * 0.42;
        ctx.fillStyle = p.color || "#d7b37c";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const ring of state.fx.rings) {
      const t = ring.life / ring.maxLife;
      ctx.globalAlpha = t;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1 + 5 * t;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ekran boyutunda hafif kenar karartması (yanlış cevap için kırmızı tonlu), bir kez üretilir.
  const vignetteSprite = (() => {
    const c = makeCanvas(320, 180);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(160, 90, 50, 160, 90, 190);
    grad.addColorStop(0, "rgba(231, 53, 79, 0)");
    grad.addColorStop(1, "rgba(231, 53, 79, 0.55)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 320, 180);
    return c;
  })();

  function drawScreenFx() {
    const fx = state.fx;
    if (fx.successGlow > 0) {
      const t = fx.successGlow / 0.6;
      const px = player.x + player.w / 2 - state.cameraX;
      const py = player.y + player.h / 2;
      const glow = ctx.createRadialGradient(px, py, 10, px, py, 220);
      glow.addColorStop(0, `rgba(255, 230, 120, ${0.45 * t})`);
      glow.addColorStop(0.5, `rgba(126, 231, 135, ${0.22 * t})`);
      glow.addColorStop(1, "rgba(126, 231, 135, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(px - 220, py - 220, 440, 440);
    }
    if (fx.wrongPulse > 0) {
      ctx.save();
      ctx.globalAlpha = (fx.wrongPulse / 0.35) * 0.5;
      ctx.drawImage(vignetteSprite, 0, 0, VIEW.w, VIEW.h);
      ctx.restore();
    }
  }

  /* ---------- Coin ve soru kutusu (önceden çizilmiş sprite'lar) ---------- */

  let coinSprite = null;

  function getCoinSprite() {
    const scale = cacheScale();
    if (coinSprite && coinSprite.scale === scale) return coinSprite;
    const size = 34;
    const c = makeCanvas(size * scale, size * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.translate(size / 2, size / 2);
    const grad = g.createRadialGradient(-7, -8, 4, 0, 0, 16);
    grad.addColorStop(0, "#fff7a5");
    grad.addColorStop(0.55, "#ffd33f");
    grad.addColorStop(1, "#d48412");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 15, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "#a96d11";
    g.stroke();
    g.strokeStyle = "rgba(169, 109, 17, 0.45)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.fillRect(-3, -10, 6, 20);
    coinSprite = { canvas: c, size, scale };
    return coinSprite;
  }

  function drawCoin(c) {
    if (c.collected) return;
    const sprite = getCoinSprite();
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const scaleX = 0.66 + Math.abs(Math.cos(c.spin)) * 0.34;
    const s = sprite.size;
    ctx.drawImage(sprite.canvas, cx - (s / 2) * scaleX, cy - s / 2, s * scaleX, s);
    // Dönerken kısa parlama: coin yüzü tam öne döndüğünde küçük bir yıldız
    const glint = Math.cos(c.spin);
    if (glint > 0.97) {
      const a = (glint - 0.97) / 0.03;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const gx = cx - 5;
      const gy = cy - 7;
      ctx.moveTo(gx, gy - 7);
      ctx.lineTo(gx + 1.6, gy - 1.6);
      ctx.lineTo(gx + 7, gy);
      ctx.lineTo(gx + 1.6, gy + 1.6);
      ctx.lineTo(gx, gy + 7);
      ctx.lineTo(gx - 1.6, gy + 1.6);
      ctx.lineTo(gx - 7, gy);
      ctx.lineTo(gx - 1.6, gy - 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const boxSprites = { scale: 0, closed: null, used: null };

  function getBoxSprite(used) {
    const scale = cacheScale();
    if (boxSprites.scale !== scale) {
      boxSprites.scale = scale;
      boxSprites.closed = renderBoxSprite(false, scale);
      boxSprites.used = renderBoxSprite(true, scale);
    }
    return used ? boxSprites.used : boxSprites.closed;
  }

  function renderBoxSprite(used, scale) {
    const size = 54;
    const depth = 6; // alt/ön kenar kalınlığı (2.5D)
    const c = makeCanvas(size * scale, (size + depth) * scale);
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.fillStyle = used ? "#5f6870" : "#a55e17";
    roundRect(0, depth, size, size, 9, g);
    g.fill();
    const grad = g.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, used ? "#c5ccd2" : "#ffdf6e");
    grad.addColorStop(1, used ? "#7d8790" : "#e28a29");
    g.fillStyle = grad;
    roundRect(0, 0, size, size, 9, g);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = used ? "#626b73" : "#a55e17";
    g.stroke();
    g.strokeStyle = "rgba(255, 255, 255, 0.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(8, 3.5);
    g.lineTo(size - 8, 3.5);
    g.stroke();
    // Köşe perçinleri
    g.fillStyle = used ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 247, 191, 0.8)";
    for (const [x, y] of [[8, 8], [size - 8, 8], [8, size - 8], [size - 8, size - 8]]) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = used ? "#e9edf0" : "#fff7bf";
    g.font = "900 36px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(used ? "!" : "?", size / 2, size / 2 + 1);
    return { canvas: c, w: size, h: size + depth };
  }

  function drawQuestionBox(box) {
    const bumpK = Math.sin(box.bump * Math.PI);
    const y = box.y - bumpK * 9;
    const used = box.state === "used";
    const sprite = getBoxSprite(used);
    // Vurulunca hafif sıkışma (görsel)
    const sy = 1 + bumpK * 0.08;
    const sx = 1 - bumpK * 0.05;
    const cx = box.x + box.w / 2;
    if (!used) {
      // Kapalı kutularda hafif nabız gibi parlama
      const pulse = 0.5 + 0.5 * Math.sin(state.fx.time * 3 + box.x * 0.01);
      ctx.save();
      ctx.globalAlpha = 0.18 + pulse * 0.14;
      ctx.fillStyle = "#fff2a8";
      roundRect(box.x - 5, y - 5, box.w + 10, box.h + 10, 13);
      ctx.fill();
      ctx.restore();
    }
    ctx.drawImage(sprite.canvas, cx - (sprite.w * sx) / 2, y + box.h - box.h * sy, sprite.w * sx, sprite.h * sy);
    if (bumpK > 0.01) {
      ctx.save();
      ctx.globalAlpha = bumpK * 0.45;
      ctx.fillStyle = "#ffffff";
      roundRect(cx - (box.w * sx) / 2, y + box.h - box.h * sy, box.w * sx, box.h * sy, 9);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Kalkan ---------- */

  function drawShield(actor) {
    const cx = actor.x + actor.w / 2;
    const cy = actor.y + actor.h / 2;
    const t = state.fx.time;
    const pulse = 1 + Math.sin(t * 8.3) * 0.04;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = "#2cd4f0";
    ctx.fillStyle = "rgba(97, 225, 255, 0.16)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 58 * pulse, 72 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 47 * pulse, 60 * pulse, 0, -0.9, 1.1);
    ctx.stroke();
    // Enerji halkası: kalkanın çevresinde dönen iki kısa yay ve üç enerji noktası
    const spin = reducedMotionQuery.matches ? 0 : t * 2.4;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#a5f3fc";
    ctx.lineWidth = 3;
    for (const offset of [0, Math.PI]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, 64 * pulse, 78 * pulse, 0, spin + offset, spin + offset + 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = "#e0fbff";
    for (let i = 0; i < 3; i += 1) {
      const a = -spin * 1.3 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 64 * pulse, cy + 4 + Math.sin(a) * 78 * pulse, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Boss, roket ve havai fişek görselleri ---------- */

  function drawBoss() {
    const boss = state.boss;
    if (!boss.active && !boss.defeated) return;
    if (boss.defeated && boss.health <= 0) return;
    const shakeX = boss.shake > 0 && !reducedMotionQuery.matches ? Math.sin(performance.now() / 22) * 8 * boss.shake : 0;
    const cx = boss.x + boss.w / 2 + shakeX;
    const foot = boss.y + boss.h;
    drawGroundShadow(cx, foot, 190);
    ctx.save();
    ctx.translate(cx, foot);
    const bossImage = currentBossImage();
    if (bossImage.complete && bossImage.naturalWidth > 0) {
      ctx.drawImage(bossImage, -132, -250, 264, 250);
      if (boss.hitFlash > 0) {
        // Kısa beyaz vuruş parlaması: aynı görsel eklemeli karışımla üstüne çizilir
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, boss.hitFlash / 0.2) * 0.6;
        ctx.drawImage(bossImage, -132, -250, 264, 250);
      }
    } else if (assets.enemy.complete && assets.enemy.naturalWidth > 0) {
      ctx.scale(-1, 1);
      ctx.drawImage(assets.enemy, -112, -188, 224, 188);
    } else {
      ctx.fillStyle = "#c88be2";
      roundRect(-72, -168, 144, 168, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  const ROCKET_SPRITE = { cellW: 256, cellH: 72, drawW: 124 };

  function drawRocket(rocket) {
    const img = assets.rockets;
    if (!(img.complete && img.naturalWidth > 0)) {
      drawRocketProcedural(rocket);
      return;
    }
    const t = state.fx.time;
    const flicker = 1 + Math.sin(t * 38 + rocket.salvoId + rocket.sprite) * 0.14;
    const dw = ROCKET_SPRITE.drawW;
    const dh = (dw * ROCKET_SPRITE.cellH) / ROCKET_SPRITE.cellW;
    const back = -dw * 0.42;
    ctx.save();
    ctx.translate(rocket.x + rocket.w / 2, rocket.y + rocket.h / 2);
    ctx.rotate(rocket.angle);
    // İz: uzun, soluk kuyruk
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = rocket.trailColor;
    ctx.beginPath();
    ctx.moveTo(back - 120 * flicker, 0);
    ctx.lineTo(back - 10, -dh * 0.34);
    ctx.lineTo(back, 0);
    ctx.lineTo(back - 10, dh * 0.34);
    ctx.closePath();
    ctx.fill();
    // Alev: dış renkli, iç sarı çekirdek
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = rocket.trailColor;
    ctx.beginPath();
    ctx.moveTo(back - 44 * flicker, 0);
    ctx.quadraticCurveTo(back - 12, -dh * 0.42, back + 4, -dh * 0.2);
    ctx.lineTo(back + 4, dh * 0.2);
    ctx.quadraticCurveTo(back - 12, dh * 0.42, back - 44 * flicker, 0);
    ctx.fill();
    ctx.fillStyle = "#fff4b0";
    ctx.beginPath();
    ctx.moveTo(back - 24 * flicker, 0);
    ctx.quadraticCurveTo(back - 6, -dh * 0.2, back + 4, -dh * 0.1);
    ctx.lineTo(back + 4, dh * 0.1);
    ctx.quadraticCurveTo(back - 6, dh * 0.2, back - 24 * flicker, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(img, 0, (rocket.sprite || 0) * ROCKET_SPRITE.cellH, ROCKET_SPRITE.cellW, ROCKET_SPRITE.cellH, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // Roketin arkasında küçük duman izi (üst sınırlı; yalnızca oyun güncellenirken üretilir)
  function spawnRocketSmoke(rocket) {
    if (Math.random() >= 0.35 * fxIntensity()) return;
    const back = -ROCKET_SPRITE.drawW * 0.42 - 20;
    const bx = rocket.x + rocket.w / 2 + Math.cos(rocket.angle) * back;
    const by = rocket.y + rocket.h / 2 + Math.sin(rocket.angle) * back;
    pushParticle({ kind: "smoke", x: bx, y: by, vx: rand(-15, 15), vy: rand(-20, 5), life: 0.5, maxLife: 0.5, size: rand(5, 8), gravity: -20 });
  }

  function drawFireworks(depth) {
    for (const p of state.fireworks) {
      if ((p.depth || "near") !== depth) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      if (depth === "near") {
        // Yakın parçacıklarda hafif hale: derinlik hissi
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = depth === "far" ? alpha * 0.6 : alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBossCelebration() {
    if (!state.bossCelebration) return;
    ctx.save();
    drawFireworks("far");
    ctx.globalAlpha = 0.84;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    roundRect(360, 248, 560, 156, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(35, 47, 74, 0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#172033";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 48px system-ui, sans-serif";
    ctx.fillText(state.bossCelebration.title, VIEW.w / 2, 310);
    ctx.font = "800 28px system-ui, sans-serif";
    ctx.fillText(state.bossCelebration.subtitle, VIEW.w / 2, 358);
    drawFireworks("near");
    ctx.restore();
  }

  /* ---------- Kamera ---------- */

  // Kamera sınırları değişmez; yalnızca yumuşatma ve küçük bir yatay ileri bakış eklenir.
  const CAMERA = {
    anchor: 0.42, // oyuncunun ekrandaki yatay konumu (oran)
    lookAhead: 70, // tam hızda koşarken ileriye bakış (px)
    lookAheadRate: 2.5, // ileri bakışın yerleşme hızı (1/sn)
    followRate: 5.7, // eski 0.09/kare (60 FPS) takip hızına eşdeğer, FPS'ten bağımsız
    reducedFollowRate: 14 // hareket azaltma açıkken daha doğrudan takip, ileri bakış yok
  };

  function updateCamera(dt = 1 / 60) {
    const reduced = reducedMotionQuery.matches;
    const speedRatio = Math.min(1, Math.abs(player.vx) / MOVE_SPEED);
    const lookTarget = reduced ? 0 : player.facing * speedRatio * CAMERA.lookAhead;
    state.cameraLook += (lookTarget - state.cameraLook) * (1 - Math.exp(-CAMERA.lookAheadRate * dt));
    const target = player.x + player.w / 2 - VIEW.w * CAMERA.anchor + state.cameraLook;
    const rate = reduced ? CAMERA.reducedFollowRate : CAMERA.followRate;
    state.cameraX += (target - state.cameraX) * (1 - Math.exp(-rate * dt));
    state.cameraX = Math.max(0, Math.min(WORLD.w - VIEW.w, state.cameraX));
  }

  /* ---------- Ana çizim ---------- */

  function draw() {
    ctx.setTransform(state.renderScale, 0, 0, state.renderScale, 0, 0);
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    let shakeX = 0;
    let shakeY = 0;
    if (state.fx.shakeTime > 0) {
      const k = (state.fx.shakeTime / state.fx.shakeDuration) * state.fx.shakeStrength;
      shakeX = Math.sin(state.fx.time * 83) * k;
      shakeY = Math.cos(state.fx.time * 71) * k * 0.6;
    }
    drawParallax();
    ctx.save();
    ctx.translate(-Math.round(state.cameraX) + shakeX, shakeY);
    // Ekran dışındaki nesneler çizilmez
    const viewLeft = state.cameraX - 80;
    const viewRight = state.cameraX + VIEW.w + 80;
    const onScreen = (o) => o.x + o.w >= viewLeft && o.x <= viewRight;
    platforms.forEach((p, i) => {
      if (onScreen(p)) drawPlatform(p, i);
    });
    drawFinishGate();
    for (const b of boxes) if (onScreen(b)) drawQuestionBox(b);
    drawBossFightObjects();
    for (const c of coins) if (onScreen(c)) drawCoin(c);
    for (const e of enemies) if (onScreen(e)) drawEnemy(e);
    drawBoss();
    drawPlayer();
    drawParticles();
    if (state.debug) drawDebug();
    ctx.restore();
    drawScreenFx();
    drawBossHud();
    drawBossCelebration();
    if (state.debug) drawDebugOverlay();
  }

  function drawDebug() {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
    ctx.strokeRect(player.x, player.y, player.w, player.h);
    ctx.strokeStyle = "rgba(0, 80, 255, 0.8)";
    for (const p of platforms) ctx.strokeRect(p.x, p.y, p.w, p.h);
    for (const b of boxes) ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(255, 230, 0, 0.9)";
    for (const c of coins) if (!c.collected) ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = "rgba(255, 0, 200, 0.9)";
    for (const e of enemies) if (!e.defeated) ctx.strokeRect(e.x, e.y, e.w, e.h);
    // Ayak noktası
    ctx.fillStyle = "#ff00c8";
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, footY(player), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Yalnızca debug açıkken (F2 veya ?debug=1): animasyon, kare, FPS, parçacık, kamera
  function drawDebugOverlay() {
    const lines = [
      `Animasyon: ${player.anim.name} (${player.anim.frame})`,
      `FPS: ${Math.round(state.fps)}`,
      `Parçacık: ${state.particles.length}/${particleCap()}  Fişek: ${state.fireworks.length}`,
      `Kamera: x=${Math.round(state.cameraX)} ileri=${Math.round(state.cameraLook)}`,
      `Hareket azaltma: ${reducedMotionQuery.matches ? "açık" : "kapalı"}`
    ];
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(VIEW.w - 360, VIEW.h - 22 - lines.length * 20, 350, lines.length * 20 + 12);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 14px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, VIEW.w - 350, VIEW.h - 16 - lines.length * 20 + i * 20));
    ctx.restore();
  }

  function drawFinishGate() {
    const theme = currentTheme();
    const groundY = topAt(FINISH.x);
    const poleX = FINISH.x + 32;
    ctx.fillStyle = "#f7f7f2";
    ctx.fillRect(poleX, groundY - 150, 8, 150);
    ctx.fillStyle = theme.flag;
    ctx.beginPath();
    ctx.moveTo(poleX + 8, groundY - 145);
    ctx.lineTo(poleX + 92, groundY - 124);
    ctx.lineTo(poleX + 8, groundY - 100);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(23, 32, 51, 0.2)";
    ctx.fillRect(poleX - 9, groundY - 5, 34, 5);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(state.level), poleX + 33, groundY - 124);
  }

  function drawBossFightObjects() {
    for (const fire of state.boss.fires) drawFire(fire);
    for (const box of state.boss.fallingBoxes) drawQuestionBox(box);
    for (const rocket of state.boss.rockets) drawRocket(rocket);
  }

  function drawBossHud() {
    if (state.bossCelebration) return;
    if (!state.boss.active && !state.boss.defeated) return;
    const ratio = Math.max(0, state.boss.health / BOSS_MAX_HEALTH);
    const x = 500;
    const y = 18;
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    roundRect(x, y, 380, 48, 8);
    ctx.fill();
    ctx.fillStyle = "#4a5260";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("BÜYÜK CANAVAR", x + 16, y + 15);
    ctx.fillStyle = "#dbe4e8";
    roundRect(x + 16, y + 27, 348, 12, 8);
    ctx.fill();
    ctx.fillStyle = ratio > 0.45 ? "#e7354f" : "#ff9f2d";
    roundRect(x + 16, y + 27, 348 * ratio, 12, 8);
    ctx.fill();
    ctx.restore();
  }

  function drawFire(fire) {
    ctx.save();
    const pulse = Math.sin(performance.now() / 80) * 4;
    ctx.fillStyle = "#ffb12b";
    ctx.beginPath();
    ctx.ellipse(fire.x + fire.w / 2, fire.y + fire.h / 2, fire.w / 2, fire.h / 2 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4d32";
    ctx.beginPath();
    ctx.moveTo(fire.x + 8, fire.y + fire.h);
    ctx.quadraticCurveTo(fire.x + fire.w * 0.35, fire.y - 18, fire.x + fire.w * 0.55, fire.y + fire.h);
    ctx.quadraticCurveTo(fire.x + fire.w * 0.75, fire.y - 10, fire.x + fire.w - 4, fire.y + fire.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Roket görseli yüklenemezse eski prosedürel çizim kullanılır.
  function drawRocketProcedural(rocket) {
    const pulse = 1 + Math.sin(performance.now() / 45 + rocket.salvoId) * 0.12;
    ctx.save();
    ctx.translate(rocket.x + rocket.w / 2, rocket.y + rocket.h / 2);
    ctx.rotate(rocket.angle);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = rocket.trailColor;
    ctx.beginPath();
    ctx.moveTo(-rocket.w / 2 - 96 * pulse, 0);
    ctx.lineTo(-rocket.w / 2 - 16, -rocket.h * 0.82);
    ctx.lineTo(-rocket.w / 2 - 6, 0);
    ctx.lineTo(-rocket.w / 2 - 16, rocket.h * 0.82);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#ffd84a";
    ctx.beginPath();
    ctx.moveTo(-rocket.w / 2 - 34 * pulse, 0);
    ctx.lineTo(-rocket.w / 2 - 4, -rocket.h * 0.7);
    ctx.lineTo(-rocket.w / 2 + 6, 0);
    ctx.lineTo(-rocket.w / 2 - 4, rocket.h * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#56636d";
    roundRect(-rocket.w / 2 - 4, -rocket.h * 0.34, 16, rocket.h * 0.68, 5);
    ctx.fill();

    ctx.fillStyle = rocket.color;
    roundRect(-rocket.w / 2 + 6, -rocket.h / 2, rocket.w - 24, rocket.h, 12);
    ctx.fill();

    const shine = ctx.createLinearGradient(-rocket.w / 2, -rocket.h / 2, rocket.w / 2, rocket.h / 2);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.78)");
    shine.addColorStop(0.32, "rgba(255, 255, 255, 0.18)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shine;
    roundRect(-rocket.w / 2 + 15, -rocket.h * 0.34, rocket.w - 44, rocket.h * 0.28, 7);
    ctx.fill();

    ctx.fillStyle = "#ffcf42";
    ctx.beginPath();
    ctx.moveTo(rocket.w / 2, 0);
    ctx.lineTo(rocket.w / 2 - 21, -rocket.h / 2);
    ctx.lineTo(rocket.w / 2 - 21, rocket.h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(67, 37, 33, 0.48)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r, c = ctx) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  }

  function createSoundBoard() {
    let context = null;
    let unlocked = false;
    function getContext() {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!context) context = new AudioCtor();
      if (context.state === "suspended") context.resume().catch(() => {});
      return context;
    }
    // Yalnızca kullanıcı etkileşimi (dokunma, tıklama, tuş) sırasında çağrılır.
    function unlock() {
      const audio = getContext();
      if (!audio || unlocked) return audio;
      // iOS Safari: kullanıcı hareketi içinde sessiz bir tampon çalmak ses kilidini açar.
      const buffer = audio.createBuffer(1, 1, 22050);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start(0);
      unlocked = true;
      return audio;
    }
    function play(name) {
      // Ses kapalıysa veya kullanıcı henüz etkileşmediyse hiçbir şey başlatılmaz.
      if (!state.soundEnabled || !unlocked) return;
      let audio = null;
      try {
        audio = getContext();
      } catch (_) {
        return;
      }
      if (!audio) return;
      const now = audio.currentTime;
      for (const note of SOUND_DEFS[name]) {
        const t0 = now + (note.at || 0);
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = note.type;
        osc.frequency.setValueAtTime(note.f0, t0);
        if (note.f1) osc.frequency.exponentialRampToValueAtTime(note.f1, t0 + note.dur);
        // Yumuşak başlangıç (tık sesi olmasın) ve hızlı sönüm
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(note.gain, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + note.dur);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(t0);
        osc.stop(t0 + note.dur + 0.02);
      }
    }
    const board = { unlock, isUnlocked: () => unlocked, hasContext: () => context !== null };
    for (const name of Object.keys(SOUND_DEFS)) board[name] = () => play(name);
    return board;
  }

  function unlockAudio() {
    try {
      sounds.unlock();
    } catch (_) {
      // Audio unlock is best-effort on browsers that require user gestures.
    }
  }

  function loop(now) {
    // rAF zaman damgası, tıklama anında alınan performance.now() değerinden küçük olabilir; negatif dt fiziği bozar.
    const rawDt = (now - state.lastTime) / 1000;
    const dt = Math.max(0, Math.min(1 / 30, rawDt));
    state.lastTime = now;
    if (rawDt > 0 && rawDt < 1) state.fps += (1 / rawDt - state.fps) * 0.05;
    // Testlerde elle adım modu: oyun güncellemesi test tarafından yürütülür, çizim sürer.
    if (!state.manualStep) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Debug: ?level=N doğrudan N. seviyeyle başlar; ?boss=1 boss arenasına gider.
  function applyDebugStart() {
    const params = new URLSearchParams(window.location.search);
    const levelParam = Number(params.get("level"));
    if (Number.isInteger(levelParam) && levelParam >= 1 && levelParam <= LEVELS.length && levelParam !== state.level) {
      state.level = levelParam;
      resetLevelEntities();
    }
    if (params.get("boss") !== "1") return;
    player.x = BOSS_ARENA.start + 80;
    setFootY(player, BOSS_ARENA.floorY);
    player.prevY = player.y;
    state.cameraX = Math.max(0, BOSS_ARENA.start - 180);
    startBossFight();
    if (params.get("celebrate") === "1") {
      state.boss.health = 0;
      defeatBoss();
      return;
    }
    if (params.get("rocket") === "1") {
      setTimeout(() => launchRocket(), 350);
    }
  }

  /* ---------- Yerel depolama (kullanılamazsa sessizce devam eder) ---------- */

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      // Gizli sekme veya kapalı depolama: tercih sadece bu oturumda geçerli olur.
    }
  }

  /* ---------- Ses tercihi ---------- */

  function applySoundUi() {
    document.documentElement.classList.toggle("sound-muted", !state.soundEnabled);
    for (const button of soundToggles) {
      button.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
      const text = button.querySelector(".sound-toggle-text");
      if (text) text.textContent = state.soundEnabled ? "Ses: Açık" : "Ses: Kapalı";
      if (!text) {
        button.setAttribute("aria-label", state.soundEnabled ? "Ses açık. Kapatmak için dokun." : "Ses kapalı. Açmak için dokun.");
      }
    }
  }

  for (const button of soundToggles) {
    button.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      writeStorage(SOUND_KEY, state.soundEnabled ? "on" : "off");
      applySoundUi();
      if (state.soundEnabled) {
        unlockAudio();
        sounds.coin();
      }
      if (state.started && !dialog.open && !gameOverDialog.open) returnFocusToGame();
    });
  }

  /* ---------- Başlangıç ekranı ---------- */

  function showStartScreen() {
    const best = loadHighScores()[0];
    bestScoreEl.hidden = !best;
    if (best) bestScoreValue.textContent = `${best.score} (${best.name})`;
    if (!startDialog.open) startDialog.showModal();
    startButton.focus({ preventScroll: true });
    syncControlsEnabled();
  }

  function startGame({ intro = true } = {}) {
    if (state.started) return;
    state.started = true;
    state.lastTime = performance.now();
    startDialog.close();
    returnFocusToGame();
    syncControlsEnabled();
    updateOrientation();
    if (intro) showLevelIntro();
  }

  startButton.addEventListener("click", () => {
    // Ses yalnızca kullanıcı etkileşimiyle açılır
    unlockAudio();
    startGame();
  });

  /* ---------- Dikey kullanım uyarısı ---------- */

  function updateOrientation() {
    const blocked = portraitQuery.matches;
    if (blocked === state.orientationBlocked && blocked === rotateDialog.open) return;
    state.orientationBlocked = blocked;
    if (blocked && !rotateDialog.open) {
      rotateDialog.showModal();
    } else if (!blocked && rotateDialog.open) {
      rotateDialog.close();
      state.lastTime = performance.now();
    }
    syncControlsEnabled();
  }

  if (portraitQuery.addEventListener) {
    portraitQuery.addEventListener("change", updateOrientation);
  } else if (portraitQuery.addListener) {
    portraitQuery.addListener(updateOrientation);
  }

  /* ---------- Canvas ölçekleme (fizik 1280x720'de kalır) ---------- */

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    // DPR 2 ile sınırlı: 3x ekranlarda görüntü keskin kalır ama düşük güçlü telefonlar yorulmaz.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.max(0.5, Math.min(MAX_RENDER_SCALE, (rect.width * dpr) / VIEW.w));
    const rounded = Math.round(scale * 100) / 100;
    if (rounded === state.renderScale && canvas.width === Math.round(VIEW.w * rounded)) return;
    state.renderScale = rounded;
    canvas.width = Math.round(VIEW.w * rounded);
    canvas.height = Math.round(VIEW.h * rounded);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  }
  window.addEventListener("resize", resizeCanvas);

  /* ---------- Ekran klavyesi: görünür yüksekliği CSS'e aktar ---------- */

  function updateVisualViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty("--kb-vh", `${Math.round(vv.height)}px`);
    if (dialog.open && document.activeElement === answerInput) {
      answerButton.scrollIntoView({ block: "nearest" });
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateVisualViewport);
  }

  resetLevelEntities();
  setFootY(player, LEVEL_DATA.start.footY);
  applyDebugStart();
  applySoundUi();
  updateHud();
  resizeCanvas();
  updateVisualViewport();
  // autostart=1 test/debug içindir: tanıtım atlanır.
  if (new URLSearchParams(window.location.search).get("autostart") === "1") {
    startGame({ intro: false });
  } else {
    showStartScreen();
  }
  updateOrientation();
  requestAnimationFrame(loop);

  window.__MAVI_GAME__ = {
    state,
    player,
    platforms,
    boxes,
    coins,
    enemies,
    touchInput,
    // Salt okunur görsel durum (testler ve debug için)
    get currentAnimation() {
      return player.anim.name;
    },
    get currentFrame() {
      return player.anim.frame;
    },
    get particleCount() {
      return state.particles.length;
    },
    get reducedMotion() {
      return reducedMotionQuery.matches;
    },
    visual: {
      PLAYER_FRAMES,
      PLAYER_ANIMATIONS,
      PLAYER_ANIM_TIMING,
      CAMERA,
      playerVisualState,
      enemyVisualState,
      particleCap,
      fireworkCap,
      maxShakePx: SHAKE_MAX_PX,
      parallaxInfo(level) {
        const bg = buildParallax(level, 0.25, "test");
        return { atmosphere: bg.atmosphere, layers: bg.layers.map((l) => ({ id: l.id, factor: l.factor })), sky: LEVELS[level - 1].theme.skyTop };
      },
      spawnCoinSparkle,
      onBossHitFx,
      fx: state.fx
    },
    levelData: LEVEL_DATA,
    test: {
      rectsOverlap,
      setQuestionSeed,
      generateQuestion,
      setManualStep(on) {
        state.manualStep = Boolean(on);
      },
      // Gerçek update() fonksiyonunu n kare çalıştırır (deterministik, 60 FPS adımı)
      step(n = 1, dt = 1 / 60) {
        for (let i = 0; i < n; i += 1) update(dt);
      },
      dismissQuestion() {
        state.currentQuestion = null;
        state.activeBox = null;
        state.questionTimer = 0;
        state.paused = false;
        dialog.close();
        releaseAllInput();
        syncControlsEnabled();
      },
      hideLevelIntro,
      proceedToNextLevel,
      soundNames: Object.keys(SOUND_DEFS),
      soundDefs: SOUND_DEFS,
      audioUnlocked: () => sounds.isUnlocked(),
      audioContextCreated: () => sounds.hasContext(),
      footY,
      topAt,
      coinGap: COIN_GAP,
      question: generateQuestion,
      startGame,
      activateBox,
      hurtPlayer,
      isGameInteractive,
      joystickGeometry,
      defeatEnemy,
      damageBoss,
      launchRocket,
      joystickDeadZone: JOYSTICK_DEAD_ZONE,
      moveSpeed: MOVE_SPEED
    }
  };
})();
