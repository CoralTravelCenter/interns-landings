import express from "express";
import path from "node:path";

const app = express();

const ROOT = process.cwd();
const PORT = Number(process.env.CDN_PORT || 3001);

// public = корень ассетов
const PUBLIC_DIR = path.resolve(ROOT, "public");

// CORS — чтобы ассеты грузились на любом домене
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// dev-cache off
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  next();
});

// static: "/" → public/
app.use(express.static(PUBLIC_DIR));

// healthcheck
app.get("/health", (_req, res) => {
  res.json({ok: true, publicDir: PUBLIC_DIR});
});

app.listen(PORT, () => {
  console.log(`[CDN] serving ${PUBLIC_DIR}`);
  console.log(`[CDN] http://localhost:${PORT}/hero-bg.jpg`);
});
