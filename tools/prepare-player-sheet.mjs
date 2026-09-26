// Oyuncu sprite sheet'inin oyunda kullanılan, temizlenmiş ve küçültülmüş kopyasını üretir.
// Kaynak: player_spritesheet_clean.png (1664x2520, dokunulmaz)
// Çıktı:  assets/img/player_spritesheet_clean.png (%60 boyut)
//
// Temizlik:
//  - "victory" pozunun bacak arasına opak piksel olarak gömülmüş dama desenini siler.
//  - "idle", "jump-tuck" ve "victory" pozlarının altındaki gömülü gölgeyi siler
//    (oyun kendi yumuşak gölgesini çizer; iki gölge üst üste binmesin).
// Sonunda her pozun ölçülen kaynak dikdörtgenini ve ayak/gövde bağlantı noktasını yazdırır;
// bu değerler game.js içindeki PLAYER_FRAMES tablosuna girer.
//
// Kullanım: node tools/prepare-player-sheet.mjs   (Playwright Chromium gerekir)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "player_spritesheet_clean.png");
const OUTPUT = join(root, "assets", "img", "player_spritesheet_clean.png");
const OUTPUT_SCALE = 0.6;

// Alfa taramasıyla bulunan poz kutuları (kaynak piksel). Ad → [sx, sy, sw, sh]
const POSES = {
  "run-0": [0, 69, 318, 474],
  "run-1": [339, 62, 310, 496],
  "run-2": [698, 61, 288, 495],
  "run-3": [1044, 64, 290, 494],
  "run-4": [1372, 68, 292, 484],
  "walk-0": [24, 880, 251, 520],
  "walk-1": [379, 880, 229, 519],
  "walk-2": [711, 880, 236, 516],
  "walk-3": [1039, 880, 269, 518],
  "walk-4": [1401, 880, 249, 520],
  idle: [524, 1470, 219, 493],
  "jump-tuck": [466, 2000, 329, 520],
  victory: [1325, 1998, 307, 522]
};

// Kaynak üzerinde yapılacak işlemler (kaynak koordinatları).
const CLEANUP = [
  // Kutlama pozunda bacak arasındaki dama deseni: nötr açık gri/beyaz, bacakların çevrelediği alan.
  { kind: "checker", pose: "victory", seeds: [[1465, 2431], [1462, 2460], [1468, 2400]] },
  // Gömülü gölgeler: pozun en alt satırlarındaki mavimsi koyu renkten başlayarak yayılır.
  { kind: "shadow", pose: "idle", band: 40 },
  { kind: "shadow", pose: "jump-tuck", band: 45 },
  { kind: "shadow", pose: "victory", band: 35 }
];

const browser = await chromium.launch();
const page = await browser.newPage();
const src = `data:image/png;base64,${readFileSync(SOURCE).toString("base64")}`;

const result = await page.evaluate(
  async ({ src, POSES, CLEANUP, OUTPUT_SCALE }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, W, H);
    const d = imageData.data;
    const at = (x, y) => (y * W + x) * 4;
    const opaque = (q) => d[q + 3] > 60;
    const isChecker = (q) => {
      const mx = Math.max(d[q], d[q + 1], d[q + 2]);
      const mn = Math.min(d[q], d[q + 1], d[q + 2]);
      return opaque(q) && mx - mn < 18 && mx > 150;
    };
    const isShadow = (q) => opaque(q) && d[q] < 90 && d[q + 1] < 95 && d[q + 2] - d[q] >= 18 && d[q + 2] < 130;

    const report = [];
    function flood(seeds, test, box) {
      const [bx, by, bw, bh] = box;
      const seen = new Uint8Array(W * H);
      const stack = [];
      for (const [x, y] of seeds) if (test(at(x, y))) stack.push([x, y]);
      let cleared = 0;
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < bx || y < by || x >= bx + bw || y >= by + bh) continue;
        const idx = y * W + x;
        if (seen[idx]) continue;
        seen[idx] = 1;
        const q = idx * 4;
        if (!test(q)) continue;
        d[q + 3] = 0;
        cleared += 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      return cleared;
    }

    for (const op of CLEANUP) {
      const [sx, sy, sw, sh] = POSES[op.pose];
      if (op.kind === "checker") {
        // Yalnızca pozun alt yarısında; beyaz tişört ve ayakkabı tabanları bacaklarla ayrılmış durumda.
        const box = [sx, sy + Math.floor(sh * 0.55), sw, Math.ceil(sh * 0.45)];
        report.push(`${op.pose} dama deseni: ${flood(op.seeds, isChecker, box)} piksel`);
      } else {
        const box = [sx, sy + sh - op.band, sw, op.band];
        const seeds = [];
        for (let y = sy + sh - 4; y < sy + sh; y += 1) {
          for (let x = sx; x < sx + sw; x += 1) if (isShadow(at(x, y))) seeds.push([x, y]);
        }
        const cleared = flood(seeds, isShadow, box);
        // Gölge elipsinin ince dış çizgisi kalır; bant içinde komşusu az olan (1–2 px kalınlığındaki)
        // pikseller silinir. Ayakkabılar dolu kütle olduğu için korunur.
        let thin = 0;
        for (let pass = 0; pass < 4; pass += 1) {
          const toClear = [];
          for (let y = box[1]; y < box[1] + box[3]; y += 1) {
            for (let x = box[0]; x < box[0] + box[2]; x += 1) {
              if (!opaque(at(x, y))) continue;
              let n = 0;
              for (let dy = -2; dy <= 2; dy += 1) {
                for (let dx = -2; dx <= 2; dx += 1) {
                  if ((dx || dy) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && opaque(at(x + dx, y + dy))) n += 1;
                }
              }
              if (n < 9) toClear.push(at(x, y));
            }
          }
          for (const q of toClear) d[q + 3] = 0;
          thin += toClear.length;
        }
        // Kalan minik kırıntılar: bant içinde, bandın üst kenarına değmeyen küçük parçalar silinir
        // (ayakkabılar bandın üstünden devam ettiği için üst kenara değer ve korunur).
        const label = new Int32Array(box[2] * box[3]).fill(-1);
        let specks = 0;
        for (let y0 = 0; y0 < box[3]; y0 += 1) {
          for (let x0 = 0; x0 < box[2]; x0 += 1) {
            if (label[y0 * box[2] + x0] !== -1 || !opaque(at(box[0] + x0, box[1] + y0))) continue;
            const pixels = [];
            let touchesTop = false;
            const stack = [[x0, y0]];
            label[y0 * box[2] + x0] = 1;
            while (stack.length) {
              const [x, y] = stack.pop();
              pixels.push([x, y]);
              if (y === 0) touchesTop = true;
              for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx < 0 || ny < 0 || nx >= box[2] || ny >= box[3]) continue;
                  if (label[ny * box[2] + nx] !== -1 || !opaque(at(box[0] + nx, box[1] + ny))) continue;
                  label[ny * box[2] + nx] = 1;
                  stack.push([nx, ny]);
                }
              }
            }
            if (!touchesTop && pixels.length < 120) {
              for (const [x, y] of pixels) d[at(box[0] + x, box[1] + y) + 3] = 0;
              specks += pixels.length;
            }
          }
        }
        report.push(`${op.pose} gölge: ${cleared} piksel + ${thin} ince kenar + ${specks} kırıntı`);
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Temizlik sonrası kesin kutular ve bağlantı noktaları.
    // foot: en alttaki opak satır (ayakkabı tabanı). anchorX: gövde (yüksekliğin %25–%60'ı) ortalaması.
    const frames = {};
    for (const [name, [px, py, pw, ph]] of Object.entries(POSES)) {
      let top = Infinity;
      let bottom = -1;
      let left = Infinity;
      let right = -1;
      for (let y = py; y < py + ph; y += 1) {
        for (let x = px; x < px + pw; x += 1) {
          if (!opaque(at(x, y))) continue;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
      const h = bottom - top + 1;
      let sum = 0;
      let count = 0;
      for (let y = top + Math.floor(h * 0.25); y < top + Math.floor(h * 0.6); y += 1) {
        for (let x = left; x <= right; x += 1) {
          if (opaque(at(x, y))) {
            sum += x;
            count += 1;
          }
        }
      }
      frames[name] = {
        sx: left,
        sy: top,
        sw: right - left + 1,
        sh: h,
        ax: Math.round(sum / count - left),
        ay: h
      };
    }

    const out = new OffscreenCanvas(Math.round(W * OUTPUT_SCALE), Math.round(H * OUTPUT_SCALE));
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, 0, 0, out.width, out.height);
    const blob = await out.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return { png: btoa(binary), frames, report, size: [out.width, out.height] };
  },
  { src, POSES, CLEANUP, OUTPUT_SCALE }
);

writeFileSync(OUTPUT, Buffer.from(result.png, "base64"));
await browser.close();
console.log(result.report.join("\n"));
console.log(`Çıktı: assets/img/player_spritesheet_clean.png (${result.size.join("x")})`);
console.log("Kaynak koordinatlarında pozlar (sx, sy, sw, sh, ax, ay):");
for (const [name, f] of Object.entries(result.frames)) {
  console.log(`  "${name}": { sx: ${f.sx}, sy: ${f.sy}, sw: ${f.sw}, sh: ${f.sh}, ax: ${f.ax}, ay: ${f.ay} },`);
}
