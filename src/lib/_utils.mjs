import fs from "node:fs";
import path from "node:path";

/** project root = process.cwd() */
export const ROOT = process.cwd();

/** resolve from ROOT */
export function r(...parts) {
  return path.resolve(ROOT, ...parts);
}

export function readJsonSafe(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readBlocks(orderFilePath) {
  const json = readJsonSafe(orderFilePath, null);
  const blocks = json?.blocks;
  return Array.isArray(blocks) ? blocks.filter(Boolean) : [];
}

export function existsFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function ensureDir(p) {
  fs.mkdirSync(p, {recursive: true});
}

export function cleanDir(p) {
  if (!fs.existsSync(p)) return;
  for (const name of fs.readdirSync(p)) {
    fs.rmSync(path.join(p, name), {recursive: true, force: true});
  }
}

/** write only if content differs */
export function writeIfChanged(filePath, next, logLabel = "") {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(filePath, next);
    if (logLabel) console.log(logLabel);
    return true;
  }
  return false;
}

export function normalizeHtml(html) {
  return String(html || "").replace(/\r\n/g, "\n").trim();
}

export function absEq(a, b) {
  return path.resolve(a) === path.resolve(b);
}
