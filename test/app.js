import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import { fileURLToPath } from "url";

/* ----------------------------------
   Basis
---------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = 3000;

/* ----------------------------------
   FORM parser (entscheidend!)
---------------------------------- */

app.use(express.urlencoded({ extended: false }));

/* ----------------------------------
   Route: URL speichern
   POST /save-url
---------------------------------- */

app.post("/save-url", (req, res) => {
  const url = req.body.url;
  const project = req.body.project || "projekt";

  if (!url) {
    return res.status(400).send("Bad Request");
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

  const dir = path.join(__dirname, "DWG");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const file = `${ts}_${safeProject}_${ip}.txt`;

  fs.writeFileSync(
    path.join(dir, file),
    url + "\n",
    "utf8"
  );

  res.send("OK");
});

/* ----------------------------------
   Testseite
---------------------------------- */

app.get("/", (req, res) => {
  res.send(`
    <form method="POST" action="/save-url">
      <input name="project" value="testprojekt">
      <input name="url" value="${req.protocol}://${req.headers.host}${req.originalUrl}">
      <button type="submit">URL speichern</button>
    </form>
  `);
});

/* ----------------------------------
   Server starten
---------------------------------- */

http.createServer(app).listen(PORT, () => {
  console.log("Server läuft auf http://localhost:" + PORT);
});
