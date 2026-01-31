import path from "node:path";
import chokidar from "chokidar";

import {absEq, ensureDir, existsFile, r, readBlocks, writeIfChanged} from "./_utils.mjs";

const WATCH = process.argv.includes("--watch");

const ORDER_FILE = r("src/order.json");

const MARKUP_DIR = r("src/markup");
const OUT_FILE = path.join(MARKUP_DIR, "index.js");

function generate() {
  ensureDir(MARKUP_DIR);

  const blocks = readBlocks(ORDER_FILE);
  const present = [];

  for (const key of blocks) {
    const htmlFile = path.join(MARKUP_DIR, `${key}.html`);
    if (existsFile(htmlFile)) present.push(key);
  }

  if (present.length === 0) {
    writeIfChanged(OUT_FILE, "export default [];\n", "[gen-markup] updated (empty)");
    return;
  }

  const imports = present
    .map((key, i) => `import h${i} from './${key}.html?raw';`)
    .join("\n");

  const entries = present
    .map((key, i) => `{ key: ${JSON.stringify(key)}, html: h${i} }`)
    .join(", ");

  writeIfChanged(OUT_FILE, `${imports}\n\nexport default [${entries}];\n`, "[gen-markup] updated");
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
      if (absEq(filePath, OUT_FILE)) return; // анти-луп
      schedule();
    })
    .on("add", schedule)
    .on("unlink", schedule)
    .on("addDir", schedule)
    .on("unlinkDir", schedule);
}
