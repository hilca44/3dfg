import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { Proj } from "./cad.js";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";


const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30
});
/* -------------------------------------------------- */
/* __dirname Ersatz (ESM)                             */
/* -------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const dbPath = path.join(
  __dirname,
  "public",
  "gallery",
  `db.json`
);
console.log("SERVER FILE:", import.meta.url);

/* -------------------------------------------------- */
/* App                                                */
/* -------------------------------------------------- */
const app = express();

/* -------------------------------------------------- */
/* Proxy (kann bleiben)                               */
/* -------------------------------------------------- */
app.set("trust proxy", 1);

/* -------------------------------------------------- */
/* Body Parser                                        */
/* -------------------------------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------- */
/* Markdown Rendering                                 */
/* -------------------------------------------------- */
function renderMD(mdFile, title = "") {
  const layout = fs.readFileSync(
    path.join(__dirname, "public/views/layout.html"),
    "utf8"
  );

  const md = fs.readFileSync(
    path.join(__dirname, `public/views/pages/${mdFile}.md`),
    "utf8"
  );

  const html = marked.parse(md);

  return layout
    .replace("{{title}}", title)
    .replace("{{content}}", html);
}
// const __dirname = path.dirname(new URL(import.meta.url).pathname);

/* -------------------------------------------------- */
/* API: GET /getProj                                  */
/* -------------------------------------------------- */
app.get("/getProj", (req, res) => {
  try {
    logUrl(req);

    const { text } = req.query;
    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "missing text"
      });
    }

    const decoded = decodeURIComponent(text);
    console.log("inn:", decoded);

    const pr = new Proj(decoded).getall();
    return res.json(pr);

  } catch (err) {
    console.error("❌ /getProj failed:", err+err.stack);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post(
  "/publish",
  publishLimiter,
  express.json({ limit: "15mb" }),
  (req, res) => {

    const { img, txt, inn, url } = req.body;

    if (!img || !txt)
      return res.status(400).json({ error: "invalid" });

    if (txt.length > 500)
      return res.status(400).json({ error: "too long" });

    if (!img.startsWith("data:image/png;base64"))
      return res.status(400).json({ error: "wrong format" });

    const cleanText = sanitize(txt, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const id = Date.now();

    const base64 =
      img.replace(/^data:image\/png;base64,/, "");

    // const imgPath =    `public/gallery/${id}.png`;

const imgPath = path.join(
  __dirname,
  "public",
  "gallery",
  `${id}.png`
);
    fs.writeFileSync(imgPath, base64, "base64");

    const entry = {
      id,
      description: cleanText,
      image: `/gallery/${id}.png`,
      project: inn?.slice(0, 5000) || "",
      url: url || "",
      views: 0,
      likes: 0,
      date: new Date().toISOString()
    };

    // const dbPath = "public/gallery/db.json";


    let db = [];

    if (fs.existsSync(dbPath))
      db = JSON.parse(fs.readFileSync(dbPath));

    db.push(entry);

    fs.writeFileSync(
      dbPath,
      JSON.stringify(db, null, 2)
    );

    res.json({ ok: true });
});


app.get("/gallery-data", (req, res) => {

  const q = req.query.q?.toLowerCase() || "";

  const db =
    JSON.parse(fs.readFileSync(dbPath, "utf8") || "[]"  );

  const result = db.filter(e =>
    e.description.toLowerCase().includes(q)
  );

  res.json(result.reverse());
});

app.get("/gallery", (req, res) => {
  res.sendFile(
    path.resolve("public/gallery.html")
  );
});

/* -------------------------------------------------- */
/* URL Logging (lokal)                                 */
/* -------------------------------------------------- */
function logUrl(req) {
  const file = "/home/ch/c3urls.txt"; // kannst du auch lokal ändern

  const line =
    new Date().toISOString() +
    " " +
    req.protocol + "://" +
    req.get("host") +
    req.originalUrl +
    "\n";

  fs.appendFile(file, line, err => {
    if (err) {
      console.error("URL log error:", err);
    }
  });
}

/* -------------------------------------------------- */
/* Health                                             */
/* -------------------------------------------------- */
app.get("/ping", (_, res) => {
  res.json({ ok: true, pong: true });
});

/* -------------------------------------------------- */
/* Seiten                                             */
/* -------------------------------------------------- */
app.get("/",         (_, res) => res.send(renderMD("index",     "Start")));
app.get("/index",    (_, res) => res.send(renderMD("index",     "Start")));
app.get("/help",     (_, res) => res.send(renderMD("help",      "Hilfe")));
app.get("/examples", (_, res) => res.send(renderMD("examples",  "Beispiele")));
app.get("/example",  (_, res) => res.send(renderMD("example",   "Beispiele")));
app.get("/tut",      (_, res) => res.send(renderMD("tut",       "Tutorial")));
app.get("/commands", (_, res) => res.send(renderMD("commands",  "Befehle")));
app.get("/impressum",(_, res) => res.send(renderMD("impressum", "Impressum")));

/* -------------------------------------------------- */
/* DWG Count API                                      */
/* -------------------------------------------------- */
app.get("/api/dwg/count", (_, res) => {
  const dir = path.join(__dirname, "dwg");

  try {
    if (!fs.existsSync(dir)) {
      return res.json({ count: 0 });
    }

    const files = fs.readdirSync(dir).filter(f =>
      fs.statSync(path.join(dir, f)).isFile()
    );

    res.json({ count: files.length });
  } catch (err) {
    console.error("DWG count error:", err);
    res.json({ count: 0 });
  }
});




app.post(
  "/pxxublish",
  publishLimiter,
  express.json({ limit: "15mb" }),
  (req, res) => {

    const { image, description, project } = req.body;

    if (!image || !description)
      return res.status(400).json({ error: "invalid" });

    if (description.length > 500)
      return res.status(400).json({ error: "too long" });

    if (!image.startsWith("data:image/png;base64"))
      return res.status(400).json({ error: "wrong format" });

    const cleanText = sanitize(description, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const id = Date.now();

    const base64 =
      image.replace(/^data:image\/png;base64,/, "");

    const imgPath =
      `public/gallery/${id}.png`;

    fs.writeFileSync(imgPath, base64, "base64");

    const entry = {
      id,
      description: cleanText,
      image: `/gallery/${id}.png`,
      project: project?.slice(0, 5000) || "",
      views: 0,
      likes: 0,
      date: new Date().toISOString()
    };

    const dbPath = "public/gallery/db.json";

    let db = [];

    if (fs.existsSync(dbPath))
      db = JSON.parse(fs.readFileSync(dbPath));

    db.push(entry);

    fs.writeFileSync(
      dbPath,
      JSON.stringify(db, null, 2)
    );

    res.json({ ok: true });
});

/* -------------------------------------------------- */
/* Save URL                                           */
/* -------------------------------------------------- */
app.get("/save-url", (req, res) => {
  try {
    const project = req.query.project || "projekt";
    const data    = req.query.data;

    if (!data) {
      return res.status(400).json({ ok: false, error: "missing data" });
    }

    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);

    const ip =
      (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local")
        .replace(/^::ffff:/, "")
        .replace(/[:]/g, "_");

    const safeProject = project
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "_");

    const dir = path.join(__dirname, "dwg");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = `${ts}_${safeProject}_${ip}.txt`;

    fs.writeFileSync(path.join(dir, file), data + "\n", "utf8");

    res.json({ ok: true, file });
  } catch (err) {
    console.error("save-url failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* -------------------------------------------------- */
/* Static Files                                       */
/* -------------------------------------------------- */
app.use(express.static(path.join(__dirname, "public")));

/* -------------------------------------------------- */
/* HTTP Server Start (LOCAL)                          */
/* -------------------------------------------------- */
const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌱 LOCAL SERVER RUNNING → http://localhost:${PORT}`);
});
