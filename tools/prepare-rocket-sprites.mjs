// roket.png (2816x1536, opak beyaz zemin, 3 çapraz roket) içinden oyunda kullanılacak
// yatay, saydam zeminli roket gövdelerini çıkarır.
// Çıktı: assets/img/rockets.png — kırmızı, mavi, yeşil roket alt alta; burun sağa bakar.
// Alevler ve iz oyun içinde prosedürel çizilir; bu yüzden gövdenin arkasındaki alev kesilir.
//
// Kullanım: node tools/prepare-rocket-sprites.mjs   (Playwright Chromium gerekir)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "roket.png");
const OUTPUT = join(root, "assets", "img", "rockets.png");
const CELL_W = 256;
const CELL_H = 72;

const browser = await chromium.launch();
const page = await browser.newPage();
const src = `data:image/png;base64,${readFileSync(SOURCE).toString("base64")}`;

const result = await page.evaluate(
  async ({ src, CELL_W, CELL_H }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const base = new OffscreenCanvas(W, H);
    const bctx = base.getContext("2d");
    bctx.drawImage(img, 0, 0);
    const d = bctx.getImageData(0, 0, W, H).data;

    // Gövde rengi sınıflandırıcıları (doygun kırmızı / mavi / yeşil)
    const kinds = {
      red: (r, g, b) => r > 170 && g < 110 && b < 90,
      blue: (r, g, b) => b > 170 && r < 110 && g > 110 && g < 200,
      green: (r, g, b) => g > 160 && r > 90 && r < 180 && b < 80
    };
    // Kırmızı ve mavi gövde sınıflandırıcısı alevin bir kısmını da yakalar; arkadaki alev bu oranla kesilir
    // (önizlemeden ölçüldü, motor ağızları korunur).
    const trimBack = { red: 0.265, blue: 0.325, green: 0 };
    const log = [];
    const cells = [];
    for (const [name, test] of Object.entries(kinds)) {
      let n = 0;
      let mx = 0;
      let my = 0;
      const pts = [];
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const q = (y * W + x) * 4;
          if (test(d[q], d[q + 1], d[q + 2])) {
            pts.push([x, y]);
            mx += x;
            my += y;
            n += 1;
          }
        }
      }
      mx /= n;
      my /= n;
      // PCA ile eksen açısı
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (const [x, y] of pts) {
        sxx += (x - mx) ** 2;
        syy += (y - my) ** 2;
        sxy += (x - mx) * (y - my);
      }
      const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      let minP = Infinity;
      let maxP = -Infinity;
      let maxPerp = 0;
      for (const [x, y] of pts) {
        const p = (x - mx) * ux + (y - my) * uy;
        const perp = Math.abs(-(x - mx) * uy + (y - my) * ux);
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
        if (perp > maxPerp) maxPerp = perp;
      }
      // Burun yönü: renk pikselleri gövde boyunca uzanır; motorlar (gri) arka tarafta.
      const front = maxP + 8;
      const rawBack = minP - 0.1 * (maxP - minP); // motor ağızları için pay
      const back = rawBack + trimBack[name] * (front - rawBack);
      const len = front - back;
      const half = maxPerp + 18;
      const cw = Math.round(len);
      const ch = Math.round(half * 2);
      const cut = new OffscreenCanvas(cw, ch);
      const cctx = cut.getContext("2d");
      cctx.fillStyle = "#fff";
      cctx.fillRect(0, 0, cw, ch);
      cctx.translate(-back, half);
      cctx.rotate(-angle);
      cctx.translate(-mx, -my);
      cctx.drawImage(base, 0, 0);
      // Beyaz zemini kenarlardan başlayarak saydam yap (içerideki beyaz parlamalar korunur).
      const cd = cctx.getImageData(0, 0, cw, ch);
      const px = cd.data;
      const nearWhite = (q) => px[q] > 225 && px[q + 1] > 225 && px[q + 2] > 225;
      const seen = new Uint8Array(cw * ch);
      const stack = [];
      for (let x = 0; x < cw; x += 1) stack.push([x, 0], [x, ch - 1]);
      for (let y = 0; y < ch; y += 1) stack.push([0, y], [cw - 1, y]);
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
        const i = y * cw + x;
        if (seen[i]) continue;
        seen[i] = 1;
        const q = i * 4;
        if (!nearWhite(q)) continue;
        px[q + 3] = 0;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      // Kenar yumuşatma: saydam komşusu olan açık renkli pikseller kısmen saydam
      for (let y = 1; y < ch - 1; y += 1) {
        for (let x = 1; x < cw - 1; x += 1) {
          const q = (y * cw + x) * 4;
          if (px[q + 3] === 0) continue;
          const bright = (px[q] + px[q + 1] + px[q + 2]) / 3;
          const edge = px[q - 4 + 3] === 0 || px[q + 4 + 3] === 0 || px[q - cw * 4 + 3] === 0 || px[q + cw * 4 + 3] === 0;
          if (edge && bright > 180) px[q + 3] = Math.round(255 * Math.min(1, (255 - bright) / 75));
        }
      }
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.putImageData(cd, 0, 0);
      cells.push(cut);
      log.push(`${name}: açı ${((angle * 180) / Math.PI).toFixed(1)}°, gövde ${Math.round(len)}x${Math.round(half * 2)} px`);
    }

    const sheet = new OffscreenCanvas(CELL_W, CELL_H * cells.length);
    const sctx = sheet.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    cells.forEach((cut, i) => {
      const s = Math.min(CELL_W / cut.width, CELL_H / cut.height);
      const w = cut.width * s;
      const h = cut.height * s;
      sctx.drawImage(cut, (CELL_W - w) / 2, i * CELL_H + (CELL_H - h) / 2, w, h);
    });
    const blob = await sheet.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return { png: btoa(binary), log };
  },
  { src, CELL_W, CELL_H }
);

writeFileSync(OUTPUT, Buffer.from(result.png, "base64"));
await browser.close();
console.log(result.log.join("\n"));
console.log(`Çıktı: assets/img/rockets.png (${CELL_W}x${CELL_H * 3}, sıra: kırmızı, mavi, yeşil)`);
