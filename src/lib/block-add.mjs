import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const ORDER_FILE = path.resolve(ROOT, "src/order.json");
const MARKUP_DIR = path.resolve(ROOT, "src/markup");
const STYLES_DIR = path.resolve(ROOT, "src/styles");
const SCRIPTS_DIR = path.resolve(ROOT, "src/scripts");

const key = process.argv[2];

if (!key) {
  console.log("Usage: node scripts/block-add.mjs <key>");
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-_]*$/i.test(key)) {
  console.log("Invalid key. Use letters/numbers/dash/underscore.");
  process.exit(1);
}

function ensureDir(p) {
  fs.mkdirSync(p, {recursive: true});
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

function writeIfMissing(filePath, content) {
  if (exists(filePath)) {
    console.log(`[block:add] exists: ${path.relative(ROOT, filePath)}`);
    return;
  }
  fs.writeFileSync(filePath, content);
  console.log(`[block:add] created: ${path.relative(ROOT, filePath)}`);
}

// dirs
ensureDir(MARKUP_DIR);
ensureDir(STYLES_DIR);
ensureDir(SCRIPTS_DIR);

// files
writeIfMissing(
  path.join(MARKUP_DIR, `${key}.html`),
  `<!-- ${key} -->\n<section class="${key}">\n</section>\n`
);

writeIfMissing(
  path.join(STYLES_DIR, `${key}.scss`),
  `/* ${key} */\n.${key} {\n}\n`
);

writeIfMissing(
  path.join(SCRIPTS_DIR, `${key}.js`),
  `export default function ${key.replace(/-+/g, "_")}() {
  // init logic here
}
`
);

// order.json
const order = readOrder();
const blocks = Array.isArray(order.blocks) ? order.blocks : [];

if (!blocks.includes(key)) {
  blocks.push(key);
  order.blocks = blocks;
  writeOrder(order);
  console.log(`[block:add] order.json updated (+${key})`);
} else {
  console.log(`[block:add] order.json already has "${key}"`);
}
