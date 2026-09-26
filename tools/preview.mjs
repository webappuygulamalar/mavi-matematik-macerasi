// dist/ klasörünü yerelde önizler. Bağımlılık yok.
// Kullanım: node tools/preview.mjs [--port 4173] [--base /alt-dizin/] [--dir dist]
// --base ile GitHub Pages gibi alt dizinde yayını taklit edebilirsin.
// 127.0.0.1 güvenli bağlam sayıldığı için service worker ve kurulum burada da çalışır.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const port = Number(arg("port", 4173));
let base = arg("base", "/");
if (!base.startsWith("/")) base = `/${base}`;
if (!base.endsWith("/")) base = `${base}/`;
const dir = resolve(root, arg("dir", "dist"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

try {
  await stat(join(dir, "index.html"));
} catch (_) {
  console.error(`${dir} içinde index.html yok. Önce "npm run build" çalıştır.`);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === base.slice(0, -1)) {
    res.writeHead(301, { Location: base + url.search });
    res.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Bulunamadı. Oyun ${base} altında.`);
    return;
  }
  pathname = pathname.slice(base.length) || "index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = normalize(join(dir, pathname));
  if (file !== dir && !file.startsWith(dir + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("dosya değil");
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache"
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  } catch (_) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bulunamadı");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Önizleme: http://127.0.0.1:${port}${base}`);
});
