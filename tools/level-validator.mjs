// Seviye verisinin statik doğrulaması (Node). Build ve testler kullanır.
// Fizik değerleri game.js ile aynıdır; burada yalnızca erişilebilirlik tahmini için kullanılır.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

export const PHYSICS = {
  gravity: 1900,
  jumpSpeed: 1100,
  moveSpeed: 325,
  playerW: 46,
  playerH: 104,
  enemyW: 62,
  enemyH: 68,
  boxSize: 54,
  coinSize: 30,
  coinGap: 10
};

// Kurallar (piksel)
export const RULES = {
  walkUnderClearance: 120, // yüzen platformun altından yürüyebilme payı (oyuncu 104)
  boxBumpMin: 120, // kutu tabanı ile altındaki yüzey arası (altından yürünebilsin)
  boxBumpMax: 300, // zıplayınca kafayla vurulabilsin (erişim ~422)
  coinReachAbove: 400, // coin merkezi yüzeyin en fazla bu kadar üstünde
  coinReachSide: 220,
  maxRise: 260, // tek zıplamada ana rota yükselişi
  routeMargin: 0.75, // ana rota: hesaplanan menzilin en fazla %75'i kullanılır
  maxHopDistance: 600, // kör zıplama yok: iniş noktası ekranda görünür
  startSafeZone: 700, // başlangıç bölgesinde düşman yok
  startCoinLead: 60, // ilk coin başlangıçtaki oyuncunun sağ kenarından en az bu kadar ileride
  landingSafe: 90, // zıplayarak varılan platformun giriş kenarında düşman yok
  minPatrol: 102
};

export function loadLevelData(path) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path, "utf8"), sandbox, { filename: path });
  return sandbox.MAVI_LEVEL_DATA;
}

export function expandCoins(defs) {
  const out = [];
  const size = PHYSICS.coinSize;
  for (const d of defs) {
    if (d[0] === "line") {
      const [, x, surfaceY, count, gap] = d;
      for (let i = 0; i < count; i += 1) out.push({ x: x + i * gap, y: surfaceY - PHYSICS.coinGap - size, w: size, h: size });
    } else if (d[0] === "coin") {
      const [, x, surfaceY] = d;
      out.push({ x, y: surfaceY - PHYSICS.coinGap - size, w: size, h: size });
    } else if (d[0] === "arc") {
      const [, x0, y0, x1, y1, lift, count] = d;
      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 + (y1 - y0) * t - lift * 4 * t * (1 - t);
        out.push({ x: Math.round(cx - size / 2), y: Math.round(cy - size / 2), w: size, h: size });
      }
    } else {
      throw new Error(`bilinmeyen coin tanımı: ${d[0]}`);
    }
  }
  return out;
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Belirli bir yükseklik farkına (yukarı pozitif) atlarken yatay menzil (oyuncu konumunun kat ettiği yol).
export function jumpTravel(rise) {
  const { gravity: g, jumpSpeed: v, moveSpeed: s } = PHYSICS;
  const disc = v * v - 2 * g * rise;
  if (disc < 0) return -Infinity;
  return (s * (v + Math.sqrt(disc))) / g;
}

export function geometrySignature(level) {
  return createHash("sha256").update(JSON.stringify(level.platforms)).digest("hex").slice(0, 12);
}

export function validateLevels(data) {
  const errors = [];
  const stats = [];
  const err = (level, msg) => errors.push(`Seviye ${level}: ${msg}`);
  const W = data.world.width;
  const H = data.world.height;
  const arena = data.arena;
  const arenaRect = { x: arena.platform[0], y: arena.platform[1], w: arena.platform[2], h: arena.platform[3] };

  if (!Array.isArray(data.levels) || data.levels.length !== 4) errors.push("Tam olarak 4 seviye olmalı");

  for (const level of data.levels) {
    const id = level.id;
    for (const key of ["name", "theme", "atmosphere", "mathProfile", "platforms", "coins", "boxes", "enemies", "route"]) {
      if (!(key in level)) err(id, `"${key}" alanı eksik`);
    }
    const platforms = level.platforms.map(([x, y, w, h, type], i) => ({ i, x, y, w, h, type }));
    const arenaPlatform = { i: "arena", ...arenaRect, type: "ground" };
    const all = [...platforms, arenaPlatform];

    // Şema ve dünya sınırları
    for (const p of platforms) {
      if (![p.x, p.y, p.w, p.h].every(Number.isFinite)) err(id, `platform ${p.i} sayısal değil`);
      if (!["ground", "grass"].includes(p.type)) err(id, `platform ${p.i} türü geçersiz: ${p.type}`);
      if (p.x < 0 || p.x + p.w > arenaRect.x || p.y < 150 || p.y + p.h > H) err(id, `platform ${p.i} dünya/arena sınırı dışında`);
      if (p.type === "ground" && p.y + p.h !== H) err(id, `zemin platformu ${p.i} ekranın altına kadar inmeli`);
      if (p.type === "grass" && p.h !== 34) err(id, `yüzen platform ${p.i} yüksekliği 34 olmalı`);
    }
    for (let a = 0; a < all.length; a += 1) {
      for (let b = a + 1; b < all.length; b += 1) {
        if (overlaps(all[a], all[b])) err(id, `platform ${all[a].i} ile ${all[b].i} iç içe`);
      }
    }
    // Yüzen platformların altından yürünebilmeli (görünmez duvar olmasın)
    for (const p of platforms.filter((q) => q.type === "grass")) {
      for (const q of all) {
        if (q === p || q.x >= p.x + p.w || q.x + q.w <= p.x || q.y <= p.y) continue;
        const clearance = q.y - (p.y + p.h);
        if (clearance < RULES.walkUnderClearance) err(id, `platform ${p.i} ile altındaki ${q.i} arası ${clearance}px (en az ${RULES.walkUnderClearance})`);
      }
    }

    // Başlangıç
    const startPlatform = platforms.find((p) => data.start.x >= p.x && data.start.x + PHYSICS.playerW <= p.x + p.w && p.y === data.start.footY);
    if (!startPlatform) err(id, "başlangıç noktası güvenli bir zemin üzerinde değil");
    // Başlangıçta oyuncu hiçbir şeyle çakışmaz; hareket etmeden coin toplanamaz
    const startBody = { x: data.start.x, y: data.start.footY - PHYSICS.playerH, w: PHYSICS.playerW, h: PHYSICS.playerH };
    const startReach = { x: data.start.x - RULES.startCoinLead, y: startBody.y, w: PHYSICS.playerW + RULES.startCoinLead * 2, h: startBody.h };

    // Soru kutuları
    const boxes = level.boxes.map(([x, y], i) => ({ i, x, y, w: PHYSICS.boxSize, h: PHYSICS.boxSize }));
    for (const b of boxes) {
      if (b.x < 0 || b.x + b.w > arenaRect.x || b.y < 40) err(id, `kutu ${b.i} sınır dışında`);
      for (const p of all) if (overlaps(b, p)) err(id, `kutu ${b.i} platform ${p.i} içinde`);
      const support = platforms
        .filter((p) => b.x >= p.x + 5 && b.x + b.w <= p.x + p.w - 5 && p.y > b.y + b.h)
        .sort((p, q) => p.y - q.y)[0];
      if (!support) {
        err(id, `kutu ${b.i} altında platform yok`);
        continue;
      }
      const d = support.y - (b.y + b.h);
      if (d < RULES.boxBumpMin || d > RULES.boxBumpMax) err(id, `kutu ${b.i} ile platform ${support.i} arası ${d}px (${RULES.boxBumpMin}–${RULES.boxBumpMax})`);
    }
    for (let a = 0; a < boxes.length; a += 1) {
      for (let c = a + 1; c < boxes.length; c += 1) if (overlaps(boxes[a], boxes[c])) err(id, `kutu ${a} ile ${c} iç içe`);
    }

    // Coinler
    const coins = expandCoins(level.coins);
    coins.forEach((c, i) => {
      for (const p of all) if (overlaps(c, p)) err(id, `coin ${i} platform ${p.i} içinde`);
      for (const b of boxes) if (overlaps(c, b)) err(id, `coin ${i} kutu ${b.i} içinde`);
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const reachable = all.some(
        (p) => cx >= p.x - RULES.coinReachSide && cx <= p.x + p.w + RULES.coinReachSide && p.y - cy >= 0 && p.y - cy <= RULES.coinReachAbove
      );
      if (!reachable) err(id, `coin ${i} (${cx}, ${cy}) erişilemez`);
      if (c.x < 0 || c.x + c.w > W || c.y < 0) err(id, `coin ${i} dünya dışında`);
    });

    expandCoins(level.coins).forEach((c, i) => {
      if (overlaps(c, startReach)) err(id, `coin ${i} başlangıç noktasına ${RULES.startCoinLead}px'den yakın`);
    });
    for (const [x, y] of level.boxes) {
      if (overlaps({ x, y, w: PHYSICS.boxSize, h: PHYSICS.boxSize }, startBody)) err(id, "soru kutusu başlangıç noktasıyla çakışıyor");
    }

    // Rota
    const route = level.route;
    if (!Array.isArray(route) || route[route.length - 1] !== "arena") err(id, "rota arenada bitmeli");
    if (startPlatform && route[0] !== startPlatform.i) err(id, "rota başlangıç platformundan başlamalı");
    const routeIds = new Set(route.filter((r) => r !== "arena"));
    const byId = (r) => (r === "arena" ? arenaPlatform : platforms[r]);
    const arrivals = new Map(); // platform → giriş kenarı (sol x)
    for (let k = 1; k < route.length; k += 1) {
      const A = byId(route[k - 1]);
      const B = byId(route[k]);
      if (!A || !B) {
        err(id, `rota adımı ${k} geçersiz platform`);
        continue;
      }
      const rise = A.y - B.y;
      const gap = B.x - (A.x + A.w);
      if (B.x < A.x) err(id, `rota ${A.i}→${B.i} geri gidiyor`);
      if (rise > RULES.maxRise) err(id, `rota ${A.i}→${B.i} yükselişi ${rise}px (en fazla ${RULES.maxRise})`);
      if (gap > RULES.maxHopDistance) err(id, `rota ${A.i}→${B.i} kör zıplama (${gap}px)`);
      if (gap > 0) {
        const travel = jumpTravel(rise);
        const needed = gap - PHYSICS.playerW;
        if (needed > travel * RULES.routeMargin) err(id, `rota ${A.i}→${B.i} boşluk ${gap}px, yükseliş ${rise}px için fazla (menzil ${Math.round(travel)}px)`);
        arrivals.set(B.i, B.x);
      }
    }
    if (!routeIds.size) err(id, "rota boş");

    // Düşmanlar
    const enemies = level.enemies.map(([x, surfaceY, minX, maxX, speed], i) => ({ i, x, surfaceY, minX, maxX, speed }));
    for (const e of enemies) {
      const host = platforms.find((p) => p.y === e.surfaceY && e.minX >= p.x && e.maxX <= p.x + p.w);
      if (!host) err(id, `düşman ${e.i} devriyesi tek bir platform üzerinde değil`);
      if (e.maxX - e.minX < RULES.minPatrol) err(id, `düşman ${e.i} devriyesi çok kısa`);
      if (e.x < e.minX || e.x + PHYSICS.enemyW > e.maxX) err(id, `düşman ${e.i} başlangıcı devriye dışında`);
      if (e.minX < RULES.startSafeZone) err(id, `düşman ${e.i} başlangıç bölgesinde`);
      if (!(e.speed >= 40 && e.speed <= 140)) err(id, `düşman ${e.i} hızı geçersiz`);
      if (host && arrivals.has(host.i) && e.minX < host.x + RULES.landingSafe) err(id, `düşman ${e.i} iniş noktasında (platform ${host.i})`);
      if (e.maxX > arenaRect.x) err(id, `düşman ${e.i} boss arenasında`);
    }

    // Boş olmama
    if (platforms.length < 8) err(id, "en az 8 platform olmalı");
    if (coins.length < 25) err(id, "en az 25 coin olmalı");
    if (boxes.length < 6) err(id, "en az 6 soru kutusu olmalı");
    if (enemies.length < 2) err(id, "en az 2 düşman olmalı");

    // Matematik profili
    const m = level.mathProfile || {};
    if (typeof m.focus !== "string" || !m.focus) err(id, "matematik odağı metni eksik");
    const weights = ["add", "sub", "mul"].map((k) => (m[k] ? m[k].weight : 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.001) err(id, `işlem ağırlıkları toplamı 1 olmalı (${sum})`);
    if (m.add && m.add.maxResult > 100) err(id, "toplama sonucu 100'ü aşamaz");
    if (m.sub && (m.sub.max > 100 || m.sub.minB < 0)) err(id, "çıkarma sınırları geçersiz");
    if (m.mul && !m.mul.factors.every((f) => f >= 2 && f <= 9)) err(id, "çarpan 2–9 dışında");

    stats.push({ id, name: level.name, platforms: platforms.length, coins: coins.length, boxes: boxes.length, enemies: enemies.length, signature: geometrySignature(level) });
  }

  // Seviyeler birbirinden farklı olmalı
  const signatures = new Set(stats.map((s) => s.signature));
  if (signatures.size !== data.levels.length) errors.push("Seviyelerin geometri imzaları aynı");
  for (let a = 0; a < data.levels.length; a += 1) {
    for (let b = a + 1; b < data.levels.length; b += 1) {
      const pa = new Set(data.levels[a].platforms.map((p) => p.join(",")));
      const shared = data.levels[b].platforms.filter((p) => pa.has(p.join(","))).length;
      if (shared > data.levels[b].platforms.length * 0.25) errors.push(`Seviye ${a + 1} ve ${b + 1} platformların %25'inden fazlasını paylaşıyor`);
    }
  }
  return { errors, stats };
}
