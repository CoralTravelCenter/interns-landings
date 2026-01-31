import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

import {absEq, ensureDir, existsFile, r, readBlocks, writeIfChanged} from "./_utils.mjs";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = r("src/order.json");

const SCRIPTS_DIR = r("src/scripts");
const OUT_FILE = path.join(SCRIPTS_DIR, "index.js");

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

function generate() {
  ensureDir(SCRIPTS_DIR);

  const blocks = readBlocks(ORDER_FILE);
  const usableKeys = [];

  for (const key of blocks) {
    const jsFile = path.join(SCRIPTS_DIR, `${key}.js`);
    if (!existsFile(jsFile)) continue;
    if (!isUsableScript(jsFile)) continue;
    usableKeys.push(key);
  }

  if (usableKeys.length === 0) {
    writeIfChanged(OUT_FILE, "export default new Map();\n", "[gen-scripts] updated (empty)");
    return;
  }

  const imports = usableKeys
    .map((key, i) => `import init${i} from './${key}.js';`)
    .join("\n");

  const entries = usableKeys
    .map((key, i) => `[${JSON.stringify(key)}, init${i}]`)
    .join(", ");

  writeIfChanged(
    OUT_FILE,
    `${imports}\n\nexport default new Map([${entries}]);\n`,
    "[gen-scripts] updated"
  );
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
    .watch([ORDER_FILE, SCRIPTS_DIR], {
      ignoreInitial: true,
      awaitWriteFinish: {stabilityThreshold: 120, pollInterval: 30},
    })
    .on("add", schedule)
    .on("unlink", schedule)
    .on("addDir", schedule)
    .on("unlinkDir", schedule)
    .on("change", (filePath) => {
      if (absEq(filePath, OUT_FILE)) return; // анти-луп
      schedule();
    });
}
