import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = path.resolve(process.cwd(), "src/order.json");

const SCRIPTS_DIR = path.resolve(process.cwd(), "src/scripts");
const OUT_FILE = path.join(SCRIPTS_DIR, "index.js");

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

function stripCommentsAndWhitespace(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();
}

function isUsableScript(fullPath) {
  let raw = "";
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch {
    return false;
  }
  const cleaned = stripCommentsAndWhitespace(raw);
  if (!cleaned) return false;
  if (!/export\s+default\b/.test(cleaned)) return false;
  return true;
}

function writeIfChanged(next) {
  const prev = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(OUT_FILE, next);
    console.log(`[gen-scripts] updated${next.includes("new Map();") ? " (empty)" : ""}`);
  }
}

function generate() {
  fs.mkdirSync(SCRIPTS_DIR, {recursive: true});

  const blocks = readBlocks();
  const usableKeys = [];

  for (const key of blocks) {
    const jsFile = path.join(SCRIPTS_DIR, `${key}.js`);
    if (!fileExists(jsFile)) continue;
    if (!isUsableScript(jsFile)) continue;
    usableKeys.push(key);
  }

  if (usableKeys.length === 0) {
    writeIfChanged("export default new Map();\n");
    return;
  }

  const imports = usableKeys
    .map((key, i) => `import init${i} from './${key}.js';`)
    .join("\n");

  const entries = usableKeys
    .map((key, i) => `[${JSON.stringify(key)}, init${i}]`)
    .join(", ");

  writeIfChanged(`${imports}\n\nexport default new Map([${entries}]);\n`);
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
    .watch([ORDER_FILE, SCRIPTS_DIR], {
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
