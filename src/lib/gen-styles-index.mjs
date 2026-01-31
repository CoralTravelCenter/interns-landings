import path from "node:path";
import chokidar from "chokidar";
import {absEq, ensureDir, existsFile, r, readBlocks, writeIfChanged} from "./_utils.mjs";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = r("src/order.json");
const STYLES_DIR = r("src/styles");
const OUT_FILE = path.join(STYLES_DIR, "index.js");

function generate() {
  ensureDir(STYLES_DIR);

  const blocks = readBlocks(ORDER_FILE);
  const imports = [];

  for (const key of blocks) {
    const scssFile = path.join(STYLES_DIR, `${key}.scss`);
    const cssFile = path.join(STYLES_DIR, `${key}.css`);

    if (existsFile(scssFile)) imports.push(`import './${key}.scss';`);
    else if (existsFile(cssFile)) imports.push(`import './${key}.css';`);
  }

  const content = imports.length ? imports.join("\n") + "\n" : "\n";
  writeIfChanged(OUT_FILE, content, "[gen-styles] updated");
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
    .watch([ORDER_FILE, STYLES_DIR], {
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
