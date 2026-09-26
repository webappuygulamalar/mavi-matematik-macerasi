// Kullanım: node tools/validate-levels.mjs   (npm run validate:levels)
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLevelData, validateLevels } from "./level-validator.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { errors, stats } = validateLevels(loadLevelData(join(root, "level-data.js")));
for (const s of stats) {
  console.log(`Seviye ${s.id} — ${s.name}: ${s.platforms} platform, ${s.coins} coin, ${s.boxes} kutu, ${s.enemies} düşman (imza ${s.signature})`);
}
if (errors.length) {
  console.error(`\n✖ ${errors.length} hata:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("✔ Seviye verisi geçerli");
