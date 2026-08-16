import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "kv.json");
const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // generous limit — chat messages can carry base64 images

// ---------- Claude API proxy ----------
// Keeps ANTHROPIC_API_KEY on the server; the browser never sees it.
app.post("/api/claude", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server. Add it to your .env file." });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    res.status(502).json({ error: "Failed to reach Claude API." });
  }
});

// ---------- Key/value storage ----------
// Simple flat JSON-file store. The app itself already scopes shop data by
// prefixing keys (e.g. "shopId::threads-index"), so this just needs to be a
// plain key -> {value, shared} map.

app.get("/api/kv", (req, res) => {
  const store = readStore();
  const prefix = req.query.prefix || "";
  const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
  res.json({ keys });
});

app.get("/api/kv/:key", (req, res) => {
  const store = readStore();
  const entry = store[req.params.key];
  if (!entry) return res.status(404).json({ error: "not found" });
  res.json({ value: entry.value, shared: !!entry.shared });
});

app.post("/api/kv", (req, res) => {
  const { key, value, shared } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  const store = readStore();
  store[key] = { value, shared: !!shared };
  writeStore(store);
  res.json({ key, value, shared: !!shared });
});

app.delete("/api/kv/:key", (req, res) => {
  const store = readStore();
  delete store[req.params.key];
  writeStore(store);
  res.json({ deleted: true });
});

// ---------- Serve the built frontend in production ----------
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  // Hashed asset files (JS/CSS with content-hash filenames) are safe to
  // cache aggressively — the filename itself changes whenever the content
  // does. index.html must NEVER be cached, or browsers keep referencing
  // JS/CSS files from a previous build that no longer exist after a deploy.
  app.use(
    express.static(distDir, {
      index: false, // don't auto-serve index.html here; handled explicitly below
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Throttle Tech server running on http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY is not set — chat features will not work until you add it to .env");
  }
});
