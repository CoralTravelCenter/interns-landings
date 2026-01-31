import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const ORDER_FILE = path.resolve(ROOT, "src/order.json");
const MARKUP_DIR = path.resolve(ROOT, "src/markup");
const STYLES_DIR = path.resolve(ROOT, "src/styles");
const SCRIPTS_DIR = path.resolve(ROOT, "src/scripts");

const fromKey = process.argv[2];
const toKey = process.argv[3];

if (!fromKey || !toKey) {
  console.log("Usage: node scripts/block-rename.mjs <oldKey> <newKey>");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-_]*$/i.test(toKey)) {
  console.log("Invalid newKey. Use letters/numbers/dash/underscore.");
  process.exit(1);
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readOrder() {
  if (!exists(ORDER_FILE)) return {blocks: []};
  try {
    return JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
  } catch {
    return {blocks: []};
  }
}

function writeOrder(json) {
  fs.writeFileSync(ORDER_FILE, JSON.stringify(json, null, 2) + "\n");
}

function moveIfExists(src, dst) {
  if (!exists(src)) {
    console.log(`[block:rename] skip (missing): ${path.relative(ROOT, src)}`);
    return;
  }
  if (exists(dst)) {
    console.log(`[block:rename] skip (target exists): ${path.relative(ROOT, dst)}`);
    return;
  }
  fs.renameSync(src, dst);
  console.log(`[block:rename] renamed: ${path.relative(ROOT, src)} → ${path.relative(ROOT, dst)}`);
}

// markup
moveIfExists(
  path.join(MARKUP_DIR, `${fromKey}.html`),
  path.join(MARKUP_DIR, `${toKey}.html`)
);

// styles
moveIfExists(
  path.join(STYLES_DIR, `${fromKey}.scss`),
  path.join(STYLES_DIR, `${toKey}.scss`)
);
moveIfExists(
  path.join(STYLES_DIR, `${fromKey}.css`),
  path.join(STYLES_DIR, `${toKey}.css`)
);

// scripts
moveIfExists(
  path.join(SCRIPTS_DIR, `${fromKey}.js`),
  path.join(SCRIPTS_DIR, `${toKey}.js`)
);

// order.json
const order = readOrder();
const blocks = Array.isArray(order.blocks) ? order.blocks : [];

let changed = false;
order.blocks = blocks.map((k) => {
  if (k === fromKey) {
    changed = true;
    return toKey;
  }
  return k;
});

if (changed) {
  writeOrder(order);
  console.log(`[block:rename] order.json updated (${fromKey} → ${toKey})`);
} else {
  console.log(`[block:rename] order.json had no "${fromKey}"`);
}
