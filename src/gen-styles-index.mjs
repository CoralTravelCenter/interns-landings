import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = path.resolve(process.cwd(), "src/order.json");

const STYLES_DIR = path.resolve(process.cwd(), "src/styles");
const OUT_FILE = path.join(STYLES_DIR, "index.js");

function readBlocks() {
  if (!fs.existsSync(ORDER_FILE)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
    return Array.isArray(json?.blocks) ? json.blocks.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function writeIfChanged(next) {
  const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(OUT_FILE, next);
    console.log("[gen-styles] updated");
  }
}

function generate() {
  fs.mkdirSync(STYLES_DIR, {recursive: true});

  const blocks = readBlocks();
  const presentKeys = [];

  for (const key of blocks) {
    const cssFile = path.join(STYLES_DIR, `${key}.css`);
    if (fileExists(cssFile)) presentKeys.push(key);
  }

  const content =
    presentKeys.length === 0
      ? "\n"
      : presentKeys.map((key) => `import './${key}.css';`).join("\n") + "\n";

  writeIfChanged(content);
}

// once
generate();

// watch
if (WATCH) {
  let t = null;
  const schedule = () => {
    clearTimeout(t);
    t = setTimeout(generate, 80);
  };

  const outResolved = path.resolve(OUT_FILE);

  chokidar
    .watch([ORDER_FILE, STYLES_DIR], {
      ignoreInitial: true,
      awaitWriteFinish: {stabilityThreshold: 120, pollInterval: 30},
    })
    .on("add", schedule)
    .on("unlink", schedule)
    .on("addDir", schedule)
    .on("unlinkDir", schedule)
    .on("change", (filePath) => {
      // ключевой фикс: игнорим собственный index.js по полному пути
      if (path.resolve(filePath) === outResolved) return;
      schedule();
    });
}
