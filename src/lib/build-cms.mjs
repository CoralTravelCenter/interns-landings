import fs from "node:fs";
import path from "node:path";
import {build} from "vite";
import vue from "@vitejs/plugin-vue";

import {cleanDir, ensureDir, existsFile, normalizeHtml, r, readBlocks} from "./_utils.mjs";

const ORDER_FILE = r("src/order.json");

const MARKUP_DIR = r("src/markup");
const STYLES_DIR = r("src/styles");
const SCRIPTS_DIR = r("src/scripts");

const OUT_DIR = r("@CMS");

// ---------- CSS (from styles/<key>.scss|css) ----------

async function bundleCssInline(absCssPath) {
  const rel = "/" + path.relative(process.cwd(), absCssPath).replaceAll("\\", "/");

  const V_ID = "virtual:cms-css";
  const R_ID = "\0" + V_ID;

  const virtualCss = {
    name: "cms-virtual-css",
    enforce: "pre",
    resolveId(id) {
      if (id === V_ID) return R_ID;
    },
    load(id) {
      if (id === R_ID) return `import ${JSON.stringify(rel)};`;
    },
  };

  const res = await build({
    logLevel: "silent",
    plugins: [virtualCss],
    build: {
      write: false,
      minify: "esbuild",
      cssCodeSplit: true,
      rollupOptions: {input: V_ID},
    },
  });

  const cssParts = [];
  for (const out of Array.isArray(res) ? res : [res]) {
    for (const item of out.output) {
      if (item.type === "asset" && item.fileName.endsWith(".css")) {
        const css = String(item.source || "").trim();
        if (css) cssParts.push(css);
      }
    }
  }
  return cssParts.join("\n");
}

// ---------- JS (+ CSS extracted from Vue/JS imports) ----------

async function bundleJsInline(absJsPath) {
  const rel = "/" + path.relative(process.cwd(), absJsPath).replaceAll("\\", "/");

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
        // контракт: scripts/<key>.js экспортирует default init()
        return `
import init from ${JSON.stringify(rel)};
try { if (typeof init === "function") init(); } catch (e) { console.warn(e); }
        `.trim();
      }
    },
  };

  const res = await build({
    logLevel: "silent",
    plugins: [vue(), virtualJs],
    build: {
      write: false,
      minify: "esbuild",
      cssCodeSplit: true,
      rollupOptions: {
        input: V_ID,
        output: {format: "iife", inlineDynamicImports: true},
      },
    },
  });

  let js = "";
  const cssParts = [];

  for (const out of Array.isArray(res) ? res : [res]) {
    for (const item of out.output) {
      if (item.type === "chunk" && item.isEntry) js = item.code.trim();
      if (item.type === "asset" && item.fileName.endsWith(".css")) {
        const css = String(item.source || "").trim();
        if (css) cssParts.push(css);
      }
    }
  }

  return {js, css: cssParts.join("\n")};
}

// ---------- block build ----------

async function buildBlock(key) {
  const htmlPath = path.join(MARKUP_DIR, `${key}.html`);
  if (!existsFile(htmlPath)) return null;

  const cssPathScss = path.join(STYLES_DIR, `${key}.scss`);
  const cssPathCss = path.join(STYLES_DIR, `${key}.css`);
  const jsPath = path.join(SCRIPTS_DIR, `${key}.js`);

  const html = normalizeHtml(fs.readFileSync(htmlPath, "utf8"));

  // приоритет: scss -> css
  const cssPath = existsFile(cssPathScss)
    ? cssPathScss
    : existsFile(cssPathCss)
      ? cssPathCss
      : null;

  const blockCss = cssPath ? await bundleCssInline(cssPath) : "";

  let js = "";
  let jsCss = "";
  if (existsFile(jsPath)) {
    const out = await bundleJsInline(jsPath);
    js = out.js || "";
    jsCss = out.css || "";
  }

  const parts = [];

  const mergedCss = [blockCss, jsCss].filter(Boolean).join("\n");
  if (mergedCss) parts.push(`<style>\n${mergedCss}\n</style>`);

  parts.push(html);

  if (js) parts.push(`<script>\n${js}\n</script>`);

  return parts.join("\n\n") + "\n";
}

// ---------- run ----------

async function run() {
  ensureDir(OUT_DIR);
  cleanDir(OUT_DIR);

  const blocks = readBlocks(ORDER_FILE);
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
