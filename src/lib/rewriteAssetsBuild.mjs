import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CMS_DIR = path.resolve(ROOT, "@CMS");
const prefixArg = process.argv[2];

if (!prefixArg) {
  console.log("Usage: node scripts/rewrite-images.mjs <prefix>");
  console.log("Example: node scripts/rewrite-images.mjs /some-folder/");
  process.exit(1);
}

function normalizePrefix(p) {
  let s = String(p).trim();
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\/+$/, ""); // убрать trailing /
  if (s === "") s = "/";
  return s;
}

const PREFIX = normalizePrefix(prefixArg);

function isSkippable(u) {
  return (
    /^https?:\/\//i.test(u) ||
    u.startsWith("//") ||
    u.startsWith("data:") ||
    u.startsWith("blob:") ||
    u.startsWith("mailto:") ||
    u.startsWith("tel:") ||
    u.startsWith("#")
  );
}

function isRootRel(u) {
  return typeof u === "string" && u.startsWith("/") && !u.startsWith("//");
}

function alreadyPrefixed(u) {
  return PREFIX !== "/" && (u === PREFIX || u.startsWith(PREFIX + "/"));
}

function joinPrefix(u) {
  if (!isRootRel(u) || isSkippable(u)) return u;
  if (PREFIX === "/") return u;
  if (alreadyPrefixed(u)) return u;
  return PREFIX + u; // u уже начинается с /
}

function rewriteSrcset(srcset) {
  if (!srcset || typeof srcset !== "string") return srcset;
  return srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((item) => {
      const [url, ...rest] = item.split(/\s+/);
      if (isSkippable(url)) return item;
      return [joinPrefix(url), ...rest].join(" ");
    })
    .join(", ");
}

// --- CSS url(...) переписываем ТОЛЬКО для картинок по расширениям
// поддержка query/hash: /a.webp?v=1#x
const IMG_EXT_RE = /\.(?:jpe?g|png|webp)(?:[?#][^'")]+)?$/i;

function rewriteCssUrls(cssText) {
  if (!cssText || typeof cssText !== "string") return cssText;

  return cssText.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (m, q, u) => {
      if (isSkippable(u)) return m;
      if (!isRootRel(u)) return m;          // трогаем только "/..."
      if (!IMG_EXT_RE.test(u)) return m;     // трогаем только jpg/png/webp
      const next = joinPrefix(u);
      return `url(${q}${next}${q})`;
    }
  );
}

function rewriteHtmlImages(html) {
  let out = html;

  // img src
  out = out.replace(/\bsrc=(['"])([^'"]+)\1/gi, (m, q, v) => {
    if (isSkippable(v)) return m;
    if (!isRootRel(v)) return m;
    // тут можно НЕ проверять расширение — img обычно и так картинка,
    // но оставим правило "любое root-rel"
    return `src=${q}${joinPrefix(v)}${q}`;
  });

  // img/srcset + source/srcset
  out = out.replace(/\bsrcset=(['"])([\s\S]*?)\1/gi, (m, q, v) => {
    return `srcset=${q}${rewriteSrcset(v)}${q}`;
  });

  // video poster
  out = out.replace(/\bposter=(['"])([^'"]+)\1/gi, (m, q, v) => {
    if (isSkippable(v)) return m;
    if (!isRootRel(v)) return m;
    // poster — картинка, можно без проверки расширения
    return `poster=${q}${joinPrefix(v)}${q}`;
  });

  // inline style="...url('/x.webp')..."
  out = out.replace(/\bstyle=(['"])([\s\S]*?)\1/gi, (m, q, v) => {
    const next = rewriteCssUrls(v);
    return `style=${q}${next}${q}`;
  });

  // <style>...</style>
  out = out.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => {
    const nextCss = rewriteCssUrls(css);
    return m.replace(css, nextCss);
  });

  return out;
}

function listCmsHtmlFiles() {
  if (!fs.existsSync(CMS_DIR)) return [];
  return fs
    .readdirSync(CMS_DIR, {withFileTypes: true})
    .filter((d) => d.isFile() && d.name.endsWith(".html"))
    .map((d) => path.join(CMS_DIR, d.name));
}

const files = listCmsHtmlFiles();
if (files.length === 0) {
  console.log(`[rewrite-images] no html files in ${CMS_DIR}`);
  process.exit(0);
}

let changed = 0;

for (const file of files) {
  const prev = fs.readFileSync(file, "utf8");
  const next = rewriteHtmlImages(prev);

  if (next !== prev) {
    fs.writeFileSync(file, next);
    changed++;
    console.log(`[rewrite-images] updated: ${path.relative(ROOT, file)}`);
  } else {
    console.log(`[rewrite-images] unchanged: ${path.relative(ROOT, file)}`);
  }
}

console.log(`[rewrite-images] done. prefix="${PREFIX}", changed=${changed}/${files.length}`);
