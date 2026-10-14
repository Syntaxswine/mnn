// Tiny static server for public/ (dev only; Pages serves the real thing).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const PORT = Number(process.env.PORT || 4680);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(PUB, p);
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (fs.existsSync(file + "/index.html")) { res.writeHead(302, { Location: p + "/" }); return res.end(); }
    file = path.join(PUB, "404.html"); res.statusCode = 404;
  }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`MNN at http://127.0.0.1:${PORT}/`));
