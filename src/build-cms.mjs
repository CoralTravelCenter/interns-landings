import fs from "node:fs";
import path from "node:path";
import {build} from "vite";

const ROOT = process.cwd();

const ORDER_FILE = path.resolve(ROOT, "src/order.json");

const MARKUP_DIR = path.resolve(ROOT, "src/markup");
const STYLES_DIR = path.resolve(ROOT, "src/styles");
const SCRIPTS_DIR = path.resolve(ROOT, "src/scripts");

const OUT_DIR = path.resolve(ROOT, "@CMS");

// ---------- utils ----------

function readBlocks() {
  if (!fs.existsSync(ORDER_FILE)) return [];
  const json = JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
  return Array.isArray(json?.blocks) ? json.blocks.filter(Boolean) : [];
}

function existsFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, {recursive: true});
}

function cleanDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.rmSync(path.join(p, f), {recursive: true, force: true});
  }
}

function normalizeHtml(html) {
  return html.replace(/\r\n/g, "\n").trim();
}

// ---------- CSS ----------

async function bundleCssInline(absCssPath) {
  const rel = "/" + path.relative(ROOT, absCssPath).replaceAll("\\", "/");

  const V_ID = "virtual:cms-css";
  const R_ID = "\0" + V_ID;

  const virtualCss = {
    name: "cms-virtual-css",
    enforce: "pre",
    resolveId(id) {
      if (id === V_ID) return R_ID;
    },
    load(id) {
      if (id === R_ID) {
        return `import ${JSON.stringify(rel)};`;
      }
    },
  };

  const res = await build({
    logLevel: "silent",
    plugins: [virtualCss],
    build: {
      write: false,
      minify: "esbuild",
      cssCodeSplit: true,
      rollupOptions: {
        input: V_ID, // важно: тут оставляем НЕ \0, resolveId превратит в \0...
      },
    },
  });

  for (const out of Array.isArray(res) ? res : [res]) {
    for (const item of out.output) {
      if (item.type === "asset" && item.fileName.endsWith(".css")) {
        return String(item.source || "").trim();
      }
    }
  }
  return "";
}

// ---------- JS ----------

async function bundleJsInline(absJsPath) {
  const rel = "/" + path.relative(ROOT, absJsPath).replaceAll("\\", "/");

  const V_ID = "virtual:cms-js";
  const R_ID = "\0" + V_ID;

  const virtualJs = {
    name: "cms-virtual-js",
    enforce: "pre",
    resolveId(id) {
      if (id === V_ID) return R_ID;
    },
    load(id) {
      if (id === R_ID) {
        // ВАЖНО: если ты вернулся к export default init(), то тут надо вызвать init()
        return `
import init from ${JSON.stringify(rel)};
try { if (typeof init === "function") init(); } catch (e) { console.warn(e); }
        `.trim();
      }
    },
  };

  const res = await build({
    logLevel: "silent",
    plugins: [virtualJs],
    build: {
      write: false,
      minify: "esbuild",
      rollupOptions: {
        input: V_ID,
        output: {
          format: "iife",
          inlineDynamicImports: true,
        },
      },
    },
  });

  for (const out of Array.isArray(res) ? res : [res]) {
    for (const item of out.output) {
      if (item.type === "chunk" && item.isEntry) {
        return item.code.trim();
      }
    }
  }
  return "";
}

// ---------- block build ----------

async function buildBlock(key) {
  const htmlPath = path.join(MARKUP_DIR, `${key}.html`);
  if (!existsFile(htmlPath)) return null;

  const cssPath = path.join(STYLES_DIR, `${key}.css`);
  const jsPath = path.join(SCRIPTS_DIR, `${key}.js`);

  const html = normalizeHtml(fs.readFileSync(htmlPath, "utf8"));

  const css = existsFile(cssPath) ? await bundleCssInline(cssPath) : "";
  const js = existsFile(jsPath) ? await bundleJsInline(jsPath) : "";

  const parts = [];

  if (css) parts.push(`<style>\n${css}\n</style>`);
  parts.push(html);
  if (js) parts.push(`<script>\n${js}\n</script>`);

  return parts.join("\n\n") + "\n";
}

// ---------- run ----------

async function run() {
  ensureDir(OUT_DIR);
  cleanDir(OUT_DIR);

  const blocks = readBlocks();
  if (!blocks.length) {
    console.log("[CMS] order.json is empty");
    return;
  }

  for (const key of blocks) {
    const result = await buildBlock(key);
    if (!result) {
      console.log(`[CMS] skip "${key}" (no markup)`);
      continue;
    }

    const outFile = path.join(OUT_DIR, `${key}.html`);
    fs.writeFileSync(outFile, result);
    console.log(`[CMS] wrote @CMS/${key}.html`);
  }

  console.log("[CMS] done");
}

run().catch((e) => {
  console.error("[CMS] build failed:", e);
  process.exit(1);
});
