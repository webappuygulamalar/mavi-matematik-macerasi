// Yayın paketi: yalnızca oyunun çalışması için gereken dosyaları dist/ içine kopyalar.
// Bağımlılık yok; yalnızca Node'un yerleşik modülleri kullanılır.
//
// Kullanım: node tools/build.mjs [--out <klasör>]
//
// Cache sürümleme otomatiktir: dosya içeriklerinden bir özet (hash) hesaplanır ve
//  - service-worker.js içindeki CACHE_VERSION,
//  - index.html ve service worker'daki ?v= sorgu parametreleri
// bu değerle güncellenir. İçerik değişince yeni cache adı oluşur, eski cache silinir.
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadLevelData, validateLevels } from "./level-validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArgIndex = process.argv.indexOf("--out");
const outDir = resolve(root, outArgIndex > -1 ? process.argv[outArgIndex + 1] : "dist");

const FILES = ["index.html", "styles.css", "level-data.js", "game.js", "pwa.js", "manifest.webmanifest", "service-worker.js"];
const DIRS = ["assets/img", "assets/icons"];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const realTmp = realpathSync(tmpdir());

function fail(message) {
  console.error(`\n✖ Build başarısız: ${message}`);
  process.exit(1);
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else files.push(full);
  }
  return files;
}

const toPosix = (p) => p.split(sep).join("/");

// Güvenlik: silinecek klasör yalnızca proje içindeki "dist..." klasörü ya da sistem geçici klasörü olabilir.
function assertSafeOutDir(dir) {
  const rel = relative(root, dir);
  const insideProject = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  const isTmp = dir.startsWith(resolve(tmpdir()) + sep) || dir.startsWith(realTmp + sep);
  if (insideProject && !/^dist[\w-]*$/.test(rel)) fail(`çıktı klasörü proje içinde yalnızca dist* olabilir: ${rel}`);
  if (!insideProject && !isTmp) fail(`güvensiz çıktı klasörü: ${dir}`);
}

async function main() {
  // Geçersiz seviye verisiyle yayın paketi üretilmez
  const { errors: levelErrors } = validateLevels(loadLevelData(join(root, "level-data.js")));
  if (levelErrors.length) fail(`seviye verisi geçersiz:\n  - ${levelErrors.join("\n  - ")}`);
  assertSafeOutDir(outDir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const file of FILES) await cp(join(root, file), join(outDir, file));
  for (const dir of DIRS) await cp(join(root, dir), join(outDir, dir), { recursive: true, filter: (src) => !basename(src).startsWith(".") });

  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const files = await listFiles(outDir);

  // İçerik özeti: dosya yolları + içerikler (deterministik sırayla).
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(toPosix(relative(outDir, file)));
    hash.update(await readFile(file));
  }
  const buildHash = hash.digest("hex").slice(0, 10);
  const cacheVersion = `${pkg.version}-${buildHash}`;

  // index.html: ?v= sorgularını yeni sürüme bağla
  const indexPath = join(outDir, "index.html");
  let indexHtml = await readFile(indexPath, "utf8");
  indexHtml = indexHtml.replace(/\?v=[\w.-]+/g, `?v=${buildHash}`);
  await writeFile(indexPath, indexHtml);

  // service-worker.js: CACHE_VERSION, sürümlü çekirdek dosyalar ve görsel listesi
  const swPath = join(outDir, "service-worker.js");
  let sw = await readFile(swPath, "utf8");
  if (!/const CACHE_VERSION = "[^"]*";/.test(sw)) fail("service-worker.js içinde CACHE_VERSION bulunamadı");
  sw = sw.replace(/const CACHE_VERSION = "[^"]*";/, `const CACHE_VERSION = "${cacheVersion}";`);
  sw = sw.replace(/\?v=[\w.-]+/g, `?v=${buildHash}`);
  const imageList = files
    .filter((f) => toPosix(relative(outDir, f)).startsWith("assets/"))
    .map((f) => `  "./${toPosix(relative(outDir, f))}"`)
    .join(",\n");
  if (!/const IMAGE_ASSETS = \[[\s\S]*?\];/.test(sw)) fail("service-worker.js içinde IMAGE_ASSETS bulunamadı");
  sw = sw.replace(/const IMAGE_ASSETS = \[[\s\S]*?\];/, `const IMAGE_ASSETS = [\n${imageList}\n];`);
  await writeFile(swPath, sw);

  await validate(outDir, sw, indexHtml);

  const finalFiles = await listFiles(outDir);
  let total = 0;
  for (const file of finalFiles) {
    const { size } = await stat(file);
    if (size > MAX_FILE_BYTES) fail(`${toPosix(relative(outDir, file))} çok büyük (${(size / 1048576).toFixed(1)} MB)`);
    total += size;
  }
  await writeFile(
    join(outDir, "build-info.json"),
    `${JSON.stringify({ name: pkg.name, version: pkg.version, cacheVersion, files: finalFiles.length }, null, 2)}\n`
  );
  console.log(`✔ Build tamam: ${toPosix(relative(root, outDir)) || outDir}`);
  console.log(`  Sürüm: ${cacheVersion}`);
  console.log(`  ${finalFiles.length} dosya, ${(total / 1048576).toFixed(2)} MB`);
}

// dist/ içindeki bütün yerel referansların var olduğunu ve alt dizinde çalışacağını doğrular.
async function validate(dir, sw, indexHtml) {
  const exists = async (ref) => {
    try {
      await stat(join(dir, ref));
      return true;
    } catch (_) {
      return false;
    }
  };
  const refs = [];
  for (const [, ref] of indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)) refs.push(["index.html", ref]);
  const manifest = JSON.parse(await readFile(join(dir, "manifest.webmanifest"), "utf8"));
  for (const icon of manifest.icons) refs.push(["manifest.webmanifest", icon.src]);
  refs.push(["manifest.webmanifest", manifest.start_url]);
  const game = await readFile(join(dir, "game.js"), "utf8");
  for (const [, ref] of game.matchAll(/loadImage\("([^"]+)"\)/g)) refs.push(["game.js", ref]);
  for (const [, ref] of sw.matchAll(/"(\.\/[^"]*)"/g)) refs.push(["service-worker.js", ref]);
  const pwa = await readFile(join(dir, "pwa.js"), "utf8");
  for (const [, ref] of pwa.matchAll(/register\("([^"]+)"\)/g)) refs.push(["pwa.js", ref]);

  const problems = [];
  for (const [from, ref] of refs) {
    if (/^(https?:|data:|mailto:|#)/.test(ref)) continue;
    // Alt dizinde (ör. GitHub Pages /repo/) çalışması için mutlak yol kullanılmamalı.
    if (ref.startsWith("/")) problems.push(`${from}: mutlak yol "${ref}" alt dizinde çalışmaz`);
    const clean = ref.split(/[?#]/)[0].replace(/^\.\//, "");
    if (clean === "" || clean.endsWith("/")) {
      if (!(await exists(join(clean, "index.html")))) problems.push(`${from}: "${ref}" için index.html yok`);
    } else if (!(await exists(clean))) {
      problems.push(`${from}: "${ref}" dist içinde yok`);
    }
  }
  if (problems.length) fail(`geçersiz referanslar:\n  - ${problems.join("\n  - ")}`);
}

main().catch((error) => fail(error.stack || error.message));
