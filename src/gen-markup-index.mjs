import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = path.resolve(process.cwd(), "src/order.json");

const MARKUP_DIR = path.resolve(process.cwd(), "src/markup");
const OUT_FILE = path.join(MARKUP_DIR, "index.js");

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
    console.log(`[gen-markup] updated${next.includes("[]") ? " (empty)" : ""}`);
  }
}

function generate() {
  const blocks = readBlocks();
  const present = [];
  
  console.log("[gen-markup][debug] ORDER_FILE =", ORDER_FILE);
  console.log("[gen-markup][debug] MARKUP_DIR  =", MARKUP_DIR);
  console.log("[gen-markup][debug] blocks     =", blocks);

  for (const key of blocks) {
    const htmlFile = path.join(MARKUP_DIR, `${key}.html`);
    console.log("[gen-markup][debug] check", key, "->", htmlFile, "exists:", fileExists(htmlFile));
  }

  fs.mkdirSync(MARKUP_DIR, {recursive: true});

  for (const key of blocks) {
    const htmlFile = path.join(MARKUP_DIR, `${key}.html`);
    if (fileExists(htmlFile)) present.push(key);
  }

  if (present.length === 0) {
    writeIfChanged("export default [];\n");
    return;
  }

  const imports = present
    .map((key, i) => `import h${i} from './${key}.html?raw';`)
    .join("\n");

  const entries = present
    .map((key, i) => `{ key: ${JSON.stringify(key)}, html: h${i} }`)
    .join(", ");

  writeIfChanged(`${imports}\n\nexport default [${entries}];\n`);
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

  chokidar
    .watch([ORDER_FILE, MARKUP_DIR], {
      ignoreInitial: true,
      awaitWriteFinish: {stabilityThreshold: 120, pollInterval: 30},
    })
    .on("change", (filePath) => {
      // ключевой фикс: игнорим собственный OUT_FILE, иначе будет луп
      if (path.resolve(filePath) === path.resolve(OUT_FILE)) return;
      schedule();
    })
    .on("add", schedule)
    .on("unlink", schedule)
    .on("addDir", schedule)
    .on("unlinkDir", schedule);
}
