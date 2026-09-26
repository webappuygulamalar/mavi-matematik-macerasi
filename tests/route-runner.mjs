// Oyunun gerçek fiziğiyle rota adımlarını dener (tarayıcıda çalışır; page.evaluate ile gönderilir).
// Her adım A→B için oyuncu A üzerinde farklı kalkış noktalarına konur, yön + zıplama girdisiyle
// gerçek update() çalıştırılır; oyuncu B üzerine inerse adım geçerlidir.
// Hasar almasın diye invuln yüksek tutulur; soru kutuları geçici olarak kullanılmış sayılır.
export function runRouteInPage(levelNumber) {
  const g = window.__MAVI_GAME__;
  const T = g.test;
  const { player, platforms, boxes, state } = g;
  T.setManualStep(true);
  for (const b of boxes) b.state = "used";
  const level = g.levelData.levels[levelNumber - 1];
  const byRef = (r) => (r === "arena" ? platforms[platforms.length - 1] : platforms[r]);
  const standingOn = () => {
    const foot = player.y + player.h;
    return platforms.find((p) => Math.abs(p.y - foot) < 0.6 && player.x + player.w > p.x && player.x < p.x + p.w);
  };
  const results = [];
  for (let k = 1; k < level.route.length; k += 1) {
    const A = byRef(level.route[k - 1]);
    const B = byRef(level.route[k]);
    const dir = B.x + B.w / 2 >= A.x + A.w / 2 ? 1 : -1;
    // Kalkış noktaları: A'nın B'ye yakın kenarından içeri doğru 30 px aralıkla
    const takeoffs = [];
    for (let off = 0; off <= Math.min(A.w - player.w, 420); off += 30) {
      takeoffs.push(dir > 0 ? A.x + A.w - player.w - off : A.x + off);
    }
    const modes = [
      { axis: dir, jump: true },
      { axis: dir * 0.6, jump: true },
      { axis: dir, jump: false },
      { axis: dir * 0.35, jump: true }
    ];
    let ok = null;
    search: for (const mode of modes) {
      for (const x0 of takeoffs) {
        state.boss.active = false;
        state.boss.defeated = false;
        player.x = x0;
        player.y = A.y - player.h;
        player.prevY = player.y;
        player.vx = 0;
        player.vy = 0;
        player.invuln = 999;
        player.shield = 0;
        g.touchInput.axis = 0;
        g.touchInput.jump = false;
        T.step(2);
        if (standingOn() !== A) continue;
        for (let f = 0; f < 300; f += 1) {
          g.touchInput.axis = mode.axis;
          g.touchInput.jump = mode.jump && f < 4;
          T.step(1);
          if (player.y > 700) break;
          if (B === platforms[platforms.length - 1] && state.boss.active) {
            ok = { mode: mode.axis, jump: mode.jump, x0 };
            break search;
          }
          if (f > 3 && player.grounded) {
            const on = standingOn();
            if (on === B) {
              ok = { mode: mode.axis, jump: mode.jump, x0 };
              break search;
            }
            if (on && on !== A) break;
          }
        }
      }
    }
    g.touchInput.axis = 0;
    g.touchInput.jump = false;
    results.push({ from: level.route[k - 1], to: level.route[k], ok: Boolean(ok), how: ok });
  }
  // Son adım arenaya girip boss'u başlatır; sonraki denemeleri etkilemesin
  state.boss.active = false;
  T.setManualStep(false);
  return results;
}

// Her soru kutusu altındaki yüzeyden dik zıplamayla vurulabiliyor mu?
export function runBoxesInPage() {
  const g = window.__MAVI_GAME__;
  const T = g.test;
  const { player, platforms, boxes, state } = g;
  T.setManualStep(true);
  const out = [];
  boxes.forEach((box, i) => {
    const support = platforms
      .filter((p) => box.x >= p.x && box.x + box.w <= p.x + p.w && p.y > box.y + box.h)
      .sort((a, b) => a.y - b.y)[0];
    let hit = false;
    if (support) {
      // Boss savaşı açıksa oyuncu arenaya kilitlenir; kutu denemesinde kapalı olmalı
      state.boss.active = false;
      for (const b of boxes) b.state = b === box ? "closed" : "used";
      player.x = box.x + box.w / 2 - player.w / 2;
      player.y = support.y - player.h;
      player.prevY = player.y;
      player.vx = 0;
      player.vy = 0;
      player.invuln = 999;
      g.touchInput.axis = 0;
      T.step(2);
      for (let f = 0; f < 90 && !hit; f += 1) {
        g.touchInput.jump = f < 4;
        T.step(1);
        if (state.activeBox === box) hit = true;
      }
      g.touchInput.jump = false;
      if (hit) T.dismissQuestion();
    }
    out.push({ box: i, hit });
  });
  T.setManualStep(false);
  return out;
}
