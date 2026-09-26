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
  const dpad = document.getElementById("dpad");
  const jumpButton = touchControls.querySelector('[data-action="jump"]');
  const soundToggles = Array.from(document.querySelectorAll(".sound-toggle"));

  const VIEW = { w: 1280, h: 720 };
  const WORLD = { w: 7500, h: 720 };
  const BOSS_ARENA = { start: 6420, end: 7480, bossX: 7060, floorY: 625 };
  const FINISH = { x: 7360, w: 70 };
  const GRAVITY = 1900;
  const MOVE_SPEED = 325;
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
  const LEVELS = [
    {
      id: 1,
      enemySpeed: 1,
      theme: {
        skyTop: "#70d4ff",
        skyMid: "#d5f6ff",
        skyBottom: "#9ddd78",
        sun: "#fff2a1",
        hill: "#5eb85d",
        grass: "#79dd66",
        groundTop: "#5fbd55",
        groundMid: "#4ea850",
        dirtTop: "#a86c3b",
        dirtBottom: "#7a4a2d",
        flag: "#ff6b57"
      }
    },
    {
      id: 2,
      enemySpeed: 1.1,
      theme: {
        skyTop: "#7b9cff",
        skyMid: "#d7e5ff",
        skyBottom: "#b6d78b",
        sun: "#ffe28d",
        hill: "#4b9f7b",
        grass: "#62c987",
        groundTop: "#42a86d",
        groundMid: "#32895d",
        dirtTop: "#8d5d62",
        dirtBottom: "#57394c",
        flag: "#55d6ff"
      }
    },
    {
      id: 3,
      enemySpeed: 1.15,
      theme: {
        skyTop: "#ffb469",
        skyMid: "#ffe1a8",
        skyBottom: "#b5d783",
        sun: "#fff0a8",
        hill: "#72a85f",
        grass: "#8bd45c",
        groundTop: "#77b956",
        groundMid: "#5b9849",
        dirtTop: "#9d7049",
        dirtBottom: "#68402f",
        flag: "#7e66ff"
      }
    },
    {
      id: 4,
      enemySpeed: 1.2,
      theme: {
        skyTop: "#5f6fdc",
        skyMid: "#aeb9ff",
        skyBottom: "#83c7b6",
        sun: "#f6d36b",
        hill: "#3d8f83",
        grass: "#55d0a3",
        groundTop: "#3cae89",
        groundMid: "#2d816b",
        dirtTop: "#715b83",
        dirtBottom: "#423355",
        flag: "#ffd34d"
      }
    }
  ];

  const keys = new Set();
  const assets = {
    player: loadImage("assets/img/player.png"),
    playerSheet: loadImage("assets/img/player_spritesheet_clean.png"),
    enemy: loadImage("assets/img/enemy.png"),
    bosses: [
      loadImage("assets/img/enemy_boss_clean.png"),
      loadImage("assets/img/enemy_boss_2_clean.png"),
      loadImage("assets/img/enemy_boss_3_clean.png"),
      loadImage("assets/img/enemy_boss_4_clean.png")
    ]
  };

  const touchInput = { left: false, right: false, jump: false };
  const touchPointers = new Map();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const portraitQuery = window.matchMedia("(orientation: portrait) and (hover: none) and (pointer: coarse)");
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
    debug: false
  };

  const platforms = [
    platform(0, 635, 980, 85, "ground"),
    platform(980, 650, 560, 70, "ground"),
    platform(1540, 625, 760, 95, "ground"),
    platform(2300, 642, 1000, 78, "ground"),
    platform(3300, 628, 620, 92, "ground"),
    platform(3920, 650, 520, 70, "ground"),
    platform(4440, 625, 560, 95, "ground"),
    platform(5000, 640, 500, 80, "ground"),
    platform(5500, 625, 500, 95, "ground"),
    platform(6000, 640, 420, 80, "ground"),
    platform(6420, 625, 1080, 95, "ground"),
    platform(270, 492, 260, 34, "grass"),
    platform(690, 406, 280, 34, "grass"),
    platform(1170, 505, 260, 34, "grass"),
    platform(1595, 410, 310, 34, "grass"),
    platform(2100, 505, 260, 34, "grass"),
    platform(2535, 424, 340, 34, "grass"),
    platform(3380, 470, 300, 34, "grass"),
    platform(3775, 382, 260, 34, "grass"),
    platform(4205, 492, 300, 34, "grass"),
    platform(4565, 395, 270, 34, "grass"),
    platform(5080, 462, 310, 34, "grass"),
    platform(5480, 375, 300, 34, "grass"),
    platform(6070, 470, 270, 34, "grass")
  ];

  const boxes = [
    questionBox(555, 382),
    questionBox(1320, 392),
    questionBox(1980, 372),
    questionBox(2680, 312),
    questionBox(3550, 360),
    questionBox(4320, 382),
    questionBox(5200, 352),
    questionBox(6140, 360)
  ];

  const coins = [
    ...coinLine(325, topAt(325), 4, 46),
    ...coinLine(745, topAt(745), 4, 46),
    ...coinLine(1050, topAt(1050), 5, 48),
    ...coinLine(1650, topAt(1650), 5, 48),
    ...coinLine(2140, topAt(2140), 4, 46),
    ...coinLine(2590, topAt(2590), 5, 46),
    coin(2930, topAt(2930)),
    ...coinLine(3395, topAt(3395), 5, 46),
    ...coinLine(3785, topAt(3785), 4, 46),
    ...coinLine(4090, topAt(4090), 5, 46),
    ...coinLine(4595, topAt(4595), 4, 46),
    coin(4765, topAt(4765)),
    ...coinLine(5110, topAt(5110), 5, 46),
    ...coinLine(5505, topAt(5505), 5, 46),
    coin(5775, topAt(5775)),
    ...coinLine(6100, topAt(6100), 4, 46),
    ...coinLine(6600, topAt(6600), 5, 48)
  ];

  const enemies = [
    enemy(1360, topAt(1360), 1170, 1430),
    enemy(2240, topAt(2240), 2100, 2360),
    enemy(2790, topAt(2790), 2535, 2875),
    enemy(3580, topAt(3580), 3380, 3680, 92),
    enemy(4325, topAt(4325), 4205, 4505, 92),
    enemy(4690, topAt(4690), 4470, 4820, 98),
    enemy(5290, topAt(5290), 5080, 5390, 98),
    enemy(5710, topAt(5710), 5500, 5930, 104),
    enemy(6250, topAt(6250), 6040, 6370, 104)
  ];

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
    sounds.enemy();

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

  function generateQuestion() {
    const roll = Math.random();
    if (roll < 0.48) {
      const a = rand(8, 45);
      const b = rand(5, 38);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    if (roll < 0.86) {
      const a = rand(22, 75);
      const b = rand(4, Math.min(39, a - 1));
      return { text: `${a} - ${b}`, answer: a - b };
    }
    const a = rand(2, 9);
    const b = rand(2, 9);
    return { text: `${a} × ${b}`, answer: a * b };
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
    setTimeout(() => answerInput.focus({ preventScroll: true }), 50);
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
    if (given === state.currentQuestion.answer) {
      setQuestionFeedback("Doğru!", "correct");
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
  });

  // Esc veya Android geri tuşu soruyu/oyun sonunu yarıda kapatıp oyunu duraklatılmış bırakmasın.
  for (const modal of [dialog, gameOverDialog, startDialog, rotateDialog]) {
    modal.addEventListener("cancel", (event) => event.preventDefault());
  }
  dialog.addEventListener("close", () => {
    if (state.currentQuestion && state.activeBox) dialog.showModal();
  });
  gameOverDialog.addEventListener("close", () => {
    if (state.gameOver) gameOverDialog.showModal();
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
    return state.started && !state.paused && !state.orientationBlocked && !dialog.open && !gameOverDialog.open;
  }

  function recomputeTouchInput() {
    touchInput.left = false;
    touchInput.right = false;
    touchInput.jump = false;
    for (const action of touchPointers.values()) {
      if (action) touchInput[action] = true;
    }
    for (const button of touchControls.querySelectorAll(".touch-button")) {
      button.classList.toggle("is-pressed", touchInput[button.dataset.action]);
    }
  }

  // Yön tuşları tek bir alan olarak izlenir: parmak sol ve sağ arasında kaydırılabilir.
  function dpadActionAt(clientX) {
    const rect = dpad.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? "left" : "right";
  }

  function bindTouchZone(element, actionForEvent) {
    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      unlockAudio();
      if (!isGameInteractive()) return;
      try {
        element.setPointerCapture(event.pointerId);
      } catch (_) {
        // Bazı tarayıcılar yakalamayı reddedebilir; olaylar yine de akar.
      }
      touchPointers.set(event.pointerId, actionForEvent(event));
      recomputeTouchInput();
    });
    element.addEventListener("pointermove", (event) => {
      if (!touchPointers.has(event.pointerId)) return;
      const next = actionForEvent(event);
      if (touchPointers.get(event.pointerId) !== next) {
        touchPointers.set(event.pointerId, next);
        recomputeTouchInput();
      }
    });
    const release = (event) => {
      if (!touchPointers.delete(event.pointerId)) return;
      recomputeTouchInput();
    };
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  bindTouchZone(dpad, (event) => dpadActionAt(event.clientX));
  bindTouchZone(jumpButton, () => "jump");
  touchControls.addEventListener("contextmenu", (event) => event.preventDefault());
  // Klavye/ekran okuyucu ile basılan dokunmatik düğmeler kısa bir hareket üretir.
  touchControls.addEventListener("click", (event) => {
    const button = event.target.closest(".touch-button");
    if (!button || event.detail !== 0 || !isGameInteractive()) return;
    const action = button.dataset.action;
    touchInput[action] = true;
    setTimeout(() => {
      touchInput[action] = false;
    }, 180);
  });

  function releaseAllInput() {
    keys.clear();
    touchPointers.clear();
    recomputeTouchInput();
  }

  function syncControlsEnabled() {
    const enabled = isGameInteractive();
    touchControls.classList.toggle("is-disabled", !enabled);
    if (!enabled) releaseAllInput();
  }

  window.addEventListener("blur", releaseAllInput);
  window.addEventListener("pagehide", releaseAllInput);
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
    updateQuestionTimer(dt);
    for (const box of boxes) box.bump = Math.max(0, box.bump - dt * 4);

    if (state.paused) {
      updateHud();
      return;
    }

    if (state.bossCelebration) {
      updateBossCelebration(dt);
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
    for (const e of enemies) updateEnemy(e, dt);
    updateParticles(dt);
    updateBoss(dt);
    collectCoins();
    checkEnemyContacts();
    checkFinish();
    updateCamera();
    updateHud();
  }

  function updateQuestionTimer(dt) {
    if (!state.currentQuestion || !state.activeBox) return;
    state.questionTimer = Math.max(0, state.questionTimer - dt);
    updateQuestionTimerUi();
    if (state.questionTimer > 0) return;
    const activeBox = state.activeBox;
    setQuestionFeedback("Süre bitti. Puan yok.", "wrong");
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
    let input = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA") || touchInput.left) input -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD") || touchInput.right) input += 1;
    player.vx = input * MOVE_SPEED;
    if (input !== 0) player.facing = input;

    if ((keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space") || touchInput.jump) && player.grounded) {
      player.vy = -JUMP_SPEED;
      player.grounded = false;
    }

    applyPhysics(player, dt, true);
    updatePlayerRunEffects(input, dt);
    if (state.boss.active && !state.boss.defeated) {
      player.x = Math.max(BOSS_ARENA.start + 26, Math.min(state.boss.x - player.w - 90, player.x));
    }

    if (player.y > VIEW.h + 120) {
      hurtPlayer(true);
      player.x = Math.max(60, state.cameraX + 70);
      setFootY(player, 260);
      player.vx = 0;
      player.vy = 0;
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
  }

  function updatePlayerRunEffects(input, dt) {
    if (!player.grounded || input === 0) {
      state.footstepTimer = 0;
      return;
    }
    state.footstepTimer -= dt;
    if (state.footstepTimer > 0) return;
    state.footstepTimer = 0.13;
    spawnDust(player.x + player.w / 2 - player.facing * 18, footY(player) + 1, -player.facing);
  }

  function spawnDust(x, y, direction) {
    for (let i = 0; i < 3; i += 1) {
      state.particles.push({
        x,
        y,
        vx: direction * rand(20, 55) + rand(-8, 8),
        vy: -rand(12, 32),
        life: 0.34,
        maxLife: 0.34,
        size: rand(4, 8)
      });
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
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
    sounds.box();
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
        hit: false
      });
    }
    showToast("Üç roket geliyor");
    sounds.box();
  }

  function updateRockets(dt) {
    for (const rocket of state.boss.rockets) {
      rocket.elapsed += dt;
      const t = Math.min(1, rocket.elapsed / rocket.duration);
      const eased = t * t * (3 - 2 * t);
      rocket.x = rocket.startX + (rocket.targetX - rocket.startX) * eased;
      rocket.y = rocket.startY + (rocket.targetY - rocket.startY) * eased;
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
      state.particles.push({
        x,
        y,
        vx: rand(-80, 80),
        vy: rand(-95, 35),
        life: 0.34,
        maxLife: 0.34,
        size: rand(4, 9),
        color: i % 2 === 0 ? "#ffb12b" : "#ff5938"
      });
    }
  }

  function damageBoss() {
    const boss = state.boss;
    if (boss.defeated) return;
    boss.health = Math.max(0, boss.health - 1);
    boss.shake = 1;
    sounds.enemy();
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
    const nextLevel = state.level + 1;
    state.fireworks = [];
    state.bossCelebration = {
      timer: 3.2,
      burstTimer: 0,
      title: "Tebrikler!",
      subtitle: nextLevel <= LEVELS.length ? `Seviye ${nextLevel} başlıyor` : "Tüm seviyeler tamamlandı"
    };
    spawnFirework(360, 190);
    spawnFirework(720, 145);
    spawnFirework(1010, 215);
    sounds.correct();
  }

  function updateBossCelebration(dt) {
    const celebration = state.bossCelebration;
    if (!celebration) return;
    celebration.timer -= dt;
    celebration.burstTimer -= dt;
    if (celebration.burstTimer <= 0) {
      celebration.burstTimer = 0.42;
      spawnFirework(rand(250, 1040), rand(130, 300));
    }
    updateFireworks(dt);
    if (celebration.timer <= 0) {
      state.bossCelebration = null;
      state.fireworks = [];
      completeLevel();
    }
  }

  function spawnFirework(x, y) {
    const colors = ["#ff4d6d", "#ffd166", "#2dd4bf", "#38bdf8", "#a78bfa"];
    for (let i = 0; i < 28; i += 1) {
      const angle = (Math.PI * 2 * i) / 28 + rand(-8, 8) / 100;
      const speed = rand(75, 170);
      state.fireworks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.9,
        maxLife: 0.9,
        size: rand(3, 6),
        color: colors[i % colors.length]
      });
    }
  }

  function updateFireworks(dt) {
    for (const p of state.fireworks) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 95 * dt;
    }
    state.fireworks = state.fireworks.filter((p) => p.life > 0);
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
    sounds.enemy();
  }

  function hurtPlayer(fell) {
    if (!fell && player.invuln > 0) return;
    state.lives = Math.max(0, state.lives - 1);
    player.invuln = 1.4;
    player.vy = -460;
    player.vx = -player.facing * 210;
    sounds.enemy();
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
    resultTitle.textContent = "Final Skor";
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
    sounds.box();
  }

  function completeLevel() {
    if (state.level < LEVELS.length) {
      state.level += 1;
      state.lives = 3;
      resetLevelEntities();
      resetPlayerPosition();
      showToast(`Seviye ${state.level}`);
      sounds.correct();
    } else {
      showVictory();
    }
  }

  function resetGame() {
    state.score = 0;
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
    player.x = 90;
    setFootY(player, 635);
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.shield = 0;
    player.shieldHits = 0;
    player.invuln = 0;
    player.grounded = false;
    state.cameraX = 0;
    releaseAllInput();
  }

  function resetLevelEntities() {
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

  function updateCamera() {
    const target = player.x + player.w / 2 - VIEW.w * 0.42;
    state.cameraX += (target - state.cameraX) * 0.09;
    state.cameraX = Math.max(0, Math.min(WORLD.w - VIEW.w, state.cameraX));
  }

  function draw() {
    ctx.setTransform(state.renderScale, 0, 0, state.renderScale, 0, 0);
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    drawSky();
    ctx.save();
    ctx.translate(-Math.round(state.cameraX), 0);
    drawWorldDecor();
    for (const p of platforms) drawPlatform(p);
    drawFinishGate();
    for (const b of boxes) drawQuestionBox(b);
    drawBossFightObjects();
    for (const c of coins) drawCoin(c);
    drawParticles();
    for (const e of enemies) drawActor(e);
    drawBoss();
    drawActor(player);
    if (state.debug) drawDebug();
    ctx.restore();
    drawBossHud();
    drawBossCelebration();
  }

  function drawSky() {
    const theme = currentTheme();
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(0.55, theme.skyMid);
    gradient.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = theme.sun;
    ctx.beginPath();
    ctx.arc(142, 112, 56, 0, Math.PI * 2);
    ctx.fill();
    drawCloud(365 - state.cameraX * 0.18, 120, 1.1);
    drawCloud(860 - state.cameraX * 0.1, 82, 0.8);
    drawCloud(1160 - state.cameraX * 0.15, 165, 0.95);
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    ctx.beginPath();
    ctx.arc(x, y, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 34 * s, y - 12 * s, 36 * s, 0, Math.PI * 2);
    ctx.arc(x + 76 * s, y, 30 * s, 0, Math.PI * 2);
    ctx.rect(x - 4 * s, y, 86 * s, 26 * s);
    ctx.fill();
  }

  function drawWorldDecor() {
    const theme = currentTheme();
    for (let x = -100; x < WORLD.w + 250; x += 260) {
      const hill = 32 + (x % 520 === 0 ? 18 : 0);
      ctx.fillStyle = theme.hill;
      ctx.beginPath();
      ctx.ellipse(x, 645, 170, hill, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatform(p) {
    const top = p.y;
    const theme = currentTheme();
    const topGradient = ctx.createLinearGradient(0, top, 0, top + p.h);
    topGradient.addColorStop(0, p.type === "ground" ? theme.groundTop : theme.grass);
    topGradient.addColorStop(0.22, p.type === "ground" ? theme.groundMid : theme.groundTop);
    topGradient.addColorStop(0.23, theme.dirtTop);
    topGradient.addColorStop(1, theme.dirtBottom);
    ctx.fillStyle = topGradient;
    roundRect(p.x, p.y, p.w, p.h, 8);
    ctx.fill();

    ctx.fillStyle = theme.grass;
    roundRect(p.x, p.y, p.w, 12, 6);
    ctx.fill();

    ctx.strokeStyle = "rgba(34, 87, 45, 0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 13);
    ctx.lineTo(p.x + p.w, p.y + 13);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 238, 185, 0.16)";
    for (let x = p.x + 18; x < p.x + p.w - 10; x += 42) {
      ctx.fillRect(x, p.y + 28, 18, 5);
    }
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

  function drawBoss() {
    const boss = state.boss;
    if (!boss.active && !boss.defeated) return;
    if (boss.defeated && boss.health <= 0) return;
    const shakeX = boss.shake > 0 && !reducedMotionQuery.matches ? Math.sin(performance.now() / 22) * 8 * boss.shake : 0;
    const cx = boss.x + boss.w / 2 + shakeX;
    const foot = boss.y + boss.h;
    drawShadow(cx, foot, 132);
    ctx.save();
    ctx.translate(cx, foot);
    const bossImage = currentBossImage();
    if (bossImage.complete && bossImage.naturalWidth > 0) {
      ctx.drawImage(bossImage, -132, -250, 264, 250);
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

  function drawBossCelebration() {
    if (!state.bossCelebration) return;
    ctx.save();
    for (const p of state.fireworks) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

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

  function drawRocket(rocket) {
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

  function drawQuestionBox(box) {
    const y = box.y - Math.sin(box.bump * Math.PI) * 9;
    const used = box.state === "used";
    const g = ctx.createLinearGradient(0, y, 0, y + box.h);
    g.addColorStop(0, used ? "#b7bec4" : "#ffd557");
    g.addColorStop(1, used ? "#7d8790" : "#e28a29");
    ctx.fillStyle = g;
    roundRect(box.x, y, box.w, box.h, 8);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = used ? "#626b73" : "#a55e17";
    ctx.stroke();
    ctx.fillStyle = used ? "#e9edf0" : "#fff7bf";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(used ? "!" : "?", box.x + box.w / 2, y + box.h / 2 + 1);
  }

  function drawCoin(c) {
    if (c.collected) return;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const scaleX = 0.66 + Math.abs(Math.cos(c.spin)) * 0.34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);
    const g = ctx.createRadialGradient(-7, -8, 4, 0, 0, 16);
    g.addColorStop(0, "#fff7a5");
    g.addColorStop(0.55, "#ffd33f");
    g.addColorStop(1, "#d48412");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, c.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#a96d11";
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(-3, -10, 6, 20);
    ctx.restore();
  }

  function drawActor(actor) {
    const isPlayer = actor.kind === "player";
    const sprite = actor.sprite;
    if (actor.defeated && actor.defeatTimer <= 0) return;
    const moving = Math.abs(actor.vx) > 5;
    const jumpState = actor.vy < -30 ? "jump" : actor.vy > 60 && !actor.grounded ? "fall" : moving ? "run" : "idle";
    const runCycle = Math.sin(actor.animTime * 18);
    const bob = jumpState === "run" ? Math.abs(runCycle) * 5 : jumpState === "idle" ? Math.sin(actor.animTime * 4) * 1.2 : 0;
    const squash = jumpState === "run" ? 1 + Math.abs(runCycle) * 0.035 : jumpState === "jump" ? 1.04 : jumpState === "fall" ? 0.98 : 1;
    const stretchX = jumpState === "run" ? 1 - Math.abs(runCycle) * 0.025 : 1;
    const tilt = jumpState === "run" ? actor.facing * runCycle * 0.035 : jumpState === "jump" ? actor.facing * -0.05 : jumpState === "fall" ? actor.facing * 0.04 : 0;
    const sx = actor.facing < 0 ? -1 : 1;
    const foot = footY(actor);
    const playerFrame = isPlayer ? getPlayerFrame(jumpState, moving, actor.animTime) : null;
    const defeatScale = actor.defeated ? Math.max(0.28, actor.defeatTimer / 0.45) : 1;
    const sourceAspect = playerFrame ? playerFrame.sw / playerFrame.sh : null;
    const baseDrawH = playerFrame ? 132 : sprite.drawH;
    const baseDrawW = playerFrame ? Math.max(74, Math.min(94, baseDrawH * sourceAspect)) : sprite.drawW;
    const drawW = baseDrawW * stretchX * (isPlayer ? 1 : 1 + Math.sin(actor.animTime * 5) * 0.01);
    const drawH = baseDrawH * squash * defeatScale;
    const drawX = actor.x + actor.w / 2 - drawW / 2 + sprite.footOffsetX;
    const drawY = foot - drawH + sprite.footOffsetY + bob;

    if (isPlayer && actor.shield > 0) drawShield(actor);
    if (isPlayer && actor.invuln > 0 && Math.floor(actor.invuln * 16) % 2 === 0) return;

    drawShadow(actor.x + actor.w / 2, foot, isPlayer ? 44 : 54);
    ctx.save();
    ctx.translate(actor.x + actor.w / 2, foot);
    ctx.rotate(isPlayer ? tilt : 0);
    ctx.scale(sx, 1);
    const localX = sx > 0 ? drawX - (actor.x + actor.w / 2) : -(drawX - (actor.x + actor.w / 2)) - drawW;
    const localY = drawY - foot;
    if (playerFrame && sprite.sheet.complete && sprite.sheet.naturalWidth > 0) {
      const k = sprite.sheet.naturalWidth / SPRITE_SHEET_SOURCE_WIDTH;
      ctx.drawImage(sprite.sheet, playerFrame.sx * k, playerFrame.sy * k, playerFrame.sw * k, playerFrame.sh * k, localX, localY, drawW, drawH);
    } else if (sprite.image.complete && sprite.image.naturalWidth > 0) {
      if (actor.defeated) ctx.globalAlpha = Math.max(0.25, actor.defeatTimer / 0.45);
      ctx.drawImage(sprite.image, localX, localY, drawW, drawH);
    } else {
      ctx.fillStyle = isPlayer ? "#2f85dc" : "#c88be2";
      roundRect(localX, localY, drawW, drawH, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  function getPlayerFrame(jumpState, moving, animTime) {
    const frames = {
      run: [
        { sx: 339, sy: 62, sw: 310, sh: 496 },
        { sx: 698, sy: 60, sw: 288, sh: 496 },
        { sx: 1044, sy: 64, sw: 287, sh: 495 }
      ],
      jump: [
        { sx: 698, sy: 60, sw: 288, sh: 496 }
      ],
      fall: [
        { sx: 1044, sy: 64, sw: 287, sh: 495 }
      ]
    };
    if (jumpState === "jump") return frames.jump[0];
    if (jumpState === "fall") return frames.fall[0];
    if (moving) return frames.run[Math.floor(animTime * 10) % frames.run.length];
    return null;
  }

  function drawParticles() {
    ctx.save();
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha * 0.42;
      ctx.fillStyle = p.color || "#d7b37c";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShield(actor) {
    const cx = actor.x + actor.w / 2;
    const cy = actor.y + actor.h / 2;
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.04;
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
    ctx.restore();
  }

  function drawShadow(cx, y, w) {
    ctx.fillStyle = "rgba(20, 38, 35, 0.18)";
    ctx.beginPath();
    ctx.ellipse(cx, y + 6, w / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
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
    function play(freq, duration, type, gainValue) {
      if (!state.soundEnabled) return;
      let audio = null;
      try {
        audio = getContext();
      } catch (_) {
        return;
      }
      if (!audio) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(gainValue, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    }
    return {
      coin: () => play(920, 0.09, "triangle", 0.08),
      box: () => play(420, 0.11, "square", 0.06),
      correct: () => {
        play(660, 0.08, "sine", 0.07);
        setTimeout(() => play(880, 0.12, "sine", 0.07), 75);
      },
      wrong: () => play(160, 0.18, "sawtooth", 0.05),
      shieldOn: () => play(520, 0.24, "triangle", 0.06),
      shieldOff: () => play(240, 0.18, "triangle", 0.05),
      enemy: () => play(120, 0.16, "square", 0.04),
      unlock
    };
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
    const dt = Math.max(0, Math.min(1 / 30, (now - state.lastTime) / 1000));
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function applyDebugStart() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("boss") !== "1") return;
    const levelParam = Number(params.get("level"));
    if (Number.isInteger(levelParam) && levelParam >= 1 && levelParam <= LEVELS.length) {
      state.level = levelParam;
    }
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

  function startGame() {
    if (state.started) return;
    unlockAudio();
    state.started = true;
    state.lastTime = performance.now();
    startDialog.close();
    returnFocusToGame();
    syncControlsEnabled();
    updateOrientation();
  }

  startButton.addEventListener("click", startGame);

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

  setFootY(player, 635);
  applyDebugStart();
  applySoundUi();
  updateHud();
  resizeCanvas();
  updateVisualViewport();
  if (new URLSearchParams(window.location.search).get("autostart") === "1") {
    startGame();
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
    test: {
      rectsOverlap,
      footY,
      topAt,
      coinGap: COIN_GAP,
      question: generateQuestion,
      startGame,
      activateBox,
      hurtPlayer,
      isGameInteractive
    }
  };
})();
