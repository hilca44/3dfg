import fs from "fs";
import https from "https";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { Proj } from "./cad.js";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";
import vhost from "vhost";

const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30
});
const PROJECT_PART_LIMITS = {
  free: 80
};

function countProjectParts(pr) {
  return (pr?.alljj || []).reduce((sum, key) => {
    const p = pr?.allpa?.[key];
    if (!p) return sum;
    return sum + Math.max(1, Number(p.n) || 1);
  }, 0);
}

function assertProjectPartLimit(pr) {
  const count = countProjectParts(pr);
  const limit = PROJECT_PART_LIMITS.free;
  if (count > limit) {
    const err = new Error(`Dieses Projekt erzeugt ${count} Teile. Free ist auf ${limit} Teile begrenzt. Bitte weniger Wiederholungen/Teilungen verwenden oder mit Pro einloggen.`);
    err.status = 413;
    err.code = "PROJECT_PART_LIMIT";
    err.details = { count, limit, plan: "free" };
    throw err;
  }
}

function projectLimitOptions() {
  return {
    partLimit: PROJECT_PART_LIMITS.free,
    partLimitPlan: "free"
  };
}
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
/* Proxy / SSL korrekt behandeln                      */
/* -------------------------------------------------- */
app.set("trust proxy", 1);

/* -------------------------------------------------- */
/* Body Parser                                        */
/* -------------------------------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));




// statische Dateien
// app.use(express.static(path.join(__dirname, "public")));

/* -------------------------------------------------- */
/* SSL-Zertifikate                                    */
/* -------------------------------------------------- */
// const HTTPS_OPTIONS = {
//   key: fs.readFileSync("/etc/letsencrypt/live/c3cad.de/privkey.pem"),
//   cert: fs.readFileSync("/etc/letsencrypt/live/c3cad.de/fullchain.pem")
// };




// app.use((req, res, next) => {

//   const host = req.headers.host.split(":")[0];

//   if (host === "hilbertcnc.de" || host === "www.hilbertcnc.de") {
//     return express.static("public/hilbertcnc")(req, res, next);
//   }

//   if (host === "c3cad.de" || host === "www.c3cad.de") {
//     return express.static("public/c3cad")(req, res, next);
//   }

//   next();
// });

/* -------------------------------------------------- */
/* Markdown Rendering                                 */
/* -------------------------------------------------- */
function renderMD(site, mdFile, title = "") {

  const layout = fs.readFileSync(
    path.join(__dirname, `public/${site}/views/layout.html`),
    "utf8"
  );

  const md = fs.readFileSync(
    path.join(__dirname, `public/${site}/views/pages/${mdFile}.md`),
    "utf8"
  );

  const html = marked.parse(md);

  return layout
    .replace("{{title}}", title)
    .replace("{{content}}", html);
}



const c3cad = express();
c3cad.use(express.static(path.join(__dirname,"public","c3cad")));

/* -------------------------------------------------- */
/* API: GET /getProj                                  */
/* -------------------------------------------------- */
c3cad.get("/getProj", (req, res) => {
  try {
    logUrl(req)
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "missing text"
      });
    }

    const decoded = decodeURIComponent(text);
    console.log("inn: "+decoded)
    const pr = new Proj(decoded, projectLimitOptions()).getall();

    return res.json(pr);

  } catch (err) {
    console.error("❌ /getProj failed:", err.stack);
    return res.status(err?.status || 500).json({
      ok: false,
      error: err.message,
      code: err?.code,
      line: err?.line,
      token: err?.token,
      details: err?.details
    });
  }
});

c3cad.post(
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



c3cad.get("/gallery-data", (req, res) => {

  const q = req.query.q?.toLowerCase() || "";

  const db =
    JSON.parse(fs.readFileSync(dbPath, "utf8") || "[]"  );

  const result = db.filter(e =>
    e.description.toLowerCase().includes(q)
  );

  res.json(result.reverse());
});

c3cad.get("/gallery", (req, res) => {
  const galPath = path.join(
    __dirname,
    "public",
    "gallery.html"
  );
  res.sendFile(
    path.resolve(galPath)
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
c3cad.get("/ping", (_, res) => {
  res.json({ ok: true, pong: true });
});


/* -------------------------------------------------- */
/* Seiten                                             */
/* -------------------------------------------------- */
c3cad.get("/",        (_, res) => res.send(renderMD("c3cad", "index",     "Start")));
c3cad.get("/index",   (_, res) => res.send(renderMD("c3cad", "index",     "Start")));
c3cad.get("/help",    (_, res) => res.send(renderMD("c3cad", "help",      "Hilfe")));
c3cad.get("/examples",(_, res) => res.send(renderMD("c3cad", "examples",  "Beispiele")));
c3cad.get("/example", (_, res) => res.send(renderMD("c3cad", "example",   "Beispiele")));
c3cad.get("/tut",     (_, res) => res.send(renderMD("c3cad", "tut",       "Tutorial")));
c3cad.get("/commands",(_, res) => res.send(renderMD("c3cad", "commands",  "Befehle")));
c3cad.get("/impressum",(_, res)=> res.send(renderMD("c3cad", "impressum", "Impressum")));

/* -------------------------------------------------- */
/* DWG Count API                                      */
/* -------------------------------------------------- */
c3cad.get("/api/dwg/count", (req, res) => {
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

/* -------------------------------------------------- */
/* Save URL                                           */
/* -------------------------------------------------- */
c3cad.get("/save-url", (req, res) => {
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
      (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
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
// app.use(express.static(path.join(__dirname, "public")));

/* Domain verbinden */

app.use(vhost("c3cad.de", c3cad));
app.use(vhost("www.c3cad.de", c3cad));
app.use(vhost("localhost", c3cad));



/* ---------------------- */
/* HILBERT CNC DOMAIN     */
/* ---------------------- */

const hilbert = express();

hilbert.use(express.static(path.join(__dirname,"public","hilbertcnc")));

/* -------------------------------------------------- */
/* Seiten                                             */
/* -------------------------------------------------- */
hilbert.get("/",        (_, res) => res.send(renderMD("hilbertcnc", "index",     "Start")));
hilbert.get("/index",   (_, res) => res.send(renderMD("hilbertcnc", "index",     "Start")));
hilbert.get("/help",    (_, res) => res.send(renderMD("hilbertcnc", "help",      "Hilfe")));
hilbert.get("/examples",(_, res) => res.send(renderMD("hilbertcnc", "examples",  "Beispiele")));
hilbert.get("/gallery", (_, res) => res.send("gallery.html"));
hilbert.get("/tut",     (_, res) => res.send(renderMD("hilbertcnc", "tut",       "Tutorial")));
hilbert.get("/commands",(_, res) => res.send(renderMD("hilbertcnc", "commands",  "Befehle")));
hilbert.get("/impressum",(_, res)=> res.send(renderMD("hilbertcnc", "impressum", "Impressum")));

app.use(vhost("hilbertcnc.de", hilbert));
app.use(vhost("www.hilbertcnc.de", hilbert));



/* ---------------------- */
/* SERVER START           */
/* ---------------------- */

// app.listen(443, () => {
//   console.log("Server läuft");
// });






/* -------------------------------------------------- */
/* HTTPS Server Start                                 */
/* -------------------------------------------------- */
// https.createServer(HTTPS_OPTIONS, app).listen(443, "0.0.0.0", () => {
//   console.log("🔐 HTTPS SERVER RUNNING → https://c3cad.de");
// });


/* -------------------------------------------------- */
/* HTTP Server Start (LOCAL)                          */
/* -------------------------------------------------- */
const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌱 LOCAL SERVER RUNNING → http://localhost:${PORT}`);
});
