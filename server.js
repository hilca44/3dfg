import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { Proj } from "./cad.js";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-html";
import vhost from "vhost";
import crypto from "crypto";
import { expandAliases } from "./public/schreinertool/alias.js";

/* -------------------------------------------------- */
/* __dirname Ersatz (ESM)                             */
/* -------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* -------------------------------------------------- */
/* Pfade                                              */
/* -------------------------------------------------- */
const PUBLIC_GALLERY_DIR = path.join(__dirname, "public", "schreinertool", "gallery");
const SERVER_DATA_DIR = process.env.ST_DATA_DIR || path.join(__dirname, "data", "schreinertool");
const GALLERY_DATA_DIR = path.join(SERVER_DATA_DIR, "gallery");
const DB_PATH = path.join(GALLERY_DATA_DIR, "db.json");
const USER_GALLERY_DIR = path.join(GALLERY_DATA_DIR, "users");
const USER_DB_PATH = path.join(GALLERY_DATA_DIR, "users.json");
const PAID_EMAILS_PATH = path.join(GALLERY_DATA_DIR, "paid-emails.json");
const Q_PATH = path.join(GALLERY_DATA_DIR, ".q.json");
const SHORT_URLS_PATH = path.join(GALLERY_DATA_DIR, "short-urls.json");
const FREE_LIMITS_PATH = path.join(__dirname, "public", "schreinertool", "free-limits.json");
const DEFAULT_LANG = "de";
const SUPPORTED_LANGS = ["de", "en", "fr", "nl", "pl", "it"];
const FREE_LIMITS = readJSON(FREE_LIMITS_PATH, {
  projectParts: { free: 100, pro: 600 },
  holzliste: { freeLines: 100 },
  cutplan: { freePlates: 1 }
});
const PROJECT_PART_LIMITS = FREE_LIMITS.projectParts || { free: 100, pro: 600 };

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

/* -------------------------------------------------- */
/* Markdown Rendering                                 */
/* -------------------------------------------------- */
function normalizeLang(lang) {
  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

function getLang(req) {
  const fromPath = req.params?.lang;
  const fromRegexPath = Array.isArray(req.params) ? req.params[0] : undefined;
  const fromUrlSegment = req.path.split("/").filter(Boolean)[0];
  const fromQuery = req.query?.lang;
  const fromCookie = req.headers.cookie
    ?.split(";")
    .map(v => v.trim())
    .find(v => v.startsWith("st_lang="))
    ?.split("=")[1];

  return normalizeLang(fromPath || fromRegexPath || fromQuery || fromUrlSegment || fromCookie);
}

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function copyLegacyDataFile(name) {
  const source = path.join(PUBLIC_GALLERY_DIR, name);
  const target = path.join(GALLERY_DATA_DIR, name);
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyLegacyDataDir(name) {
  const source = path.join(PUBLIC_GALLERY_DIR, name);
  const target = path.join(GALLERY_DATA_DIR, name);
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.cpSync(source, target, { recursive: true });
}

function ensureServerDataFiles() {
  fs.mkdirSync(GALLERY_DATA_DIR, { recursive: true });
  fs.mkdirSync(USER_GALLERY_DIR, { recursive: true });
  for (const name of ["db.json", "users.json", "paid-emails.json", ".q.json"]) {
    copyLegacyDataFile(name);
  }
  copyLegacyDataDir("users");
}

function readCookie(req, name) {
  return req.headers.cookie
    ?.split(";")
    .map(v => v.trim())
    .find(v => v.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function safeGalleryKey(raw) {
  return normalizeEmail(raw).replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

const gallerySessions = new Map();

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto
    .pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256")
    .toString("hex");
  return `pbkdf2$${salt}$${digest}`;
}

function verifyPassword(password, stored) {
  if (String(stored || "").startsWith("plain:")) {
    return String(stored).slice("plain:".length) === String(password || "");
  }

  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const expected = passwordHash(password, parts[1]);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(stored));
}

function loadGalleryUsers() {
  const data = readJSON(USER_DB_PATH, null);
  if (data?.users && typeof data.users === "object") return data;

  const adminPassword = process.env.ST_ADMIN_PASSWORD || "admin";
  const adminEmail = normalizeEmail(process.env.ST_ADMIN_EMAIL || "admin@schreinertool.local");
  const initial = {
    users: {
      [adminEmail]: {
        password: passwordHash(adminPassword),
        email: adminEmail,
        role: "admin",
        created: new Date().toISOString().slice(0, 10)
      }
    }
  };
  fs.mkdirSync(path.dirname(USER_DB_PATH), { recursive: true });
  fs.writeFileSync(USER_DB_PATH, JSON.stringify(initial, null, 2));
  if (!process.env.ST_ADMIN_PASSWORD) {
    console.warn(`WARN: Galerie-Admin wurde mit Standardpasswort 'admin' angelegt. Bitte ${USER_DB_PATH} ändern.`);
  }
  return initial;
}

function findGalleryAccount(userDb, email) {
  const normalized = normalizeEmail(email);
  const users = userDb?.users || {};
  if (users[normalized]) return { key: normalized, account: users[normalized] };

  for (const [key, account] of Object.entries(users)) {
    if (normalizeEmail(account?.email) === normalized) return { key, account };
  }

  return { key: normalized, account: null };
}

function loadPaidEmails() {
  const data = readJSON(PAID_EMAILS_PATH, []);
  return Array.isArray(data) ? data : [];
}

function paidEmailInfo(email) {
  const e = normalizeEmail(email);
  if (!e) return null;

  const found = loadPaidEmails().find(entry => {
    if (typeof entry === "string") return normalizeEmail(entry) === e;
    return normalizeEmail(entry?.email) === e;
  });
  if (!found) return null;

  if (typeof found === "string") return { email: e, valid: true };

  const until = String(found.until || found.expires || "").trim();
  const valid = !until || until >= new Date().toISOString().slice(0, 10);
  return { ...found, email: e, valid };
}

function writeGalleryUsers(data) {
  fs.mkdirSync(path.dirname(USER_DB_PATH), { recursive: true });
  const tmp = USER_DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, USER_DB_PATH);
}

function currentGallerySession(req) {
  const token = readCookie(req, "st_session");
  return token ? gallerySessions.get(token) || null : null;
}

function currentGalleryUser(req) {
  return currentGallerySession(req)?.email || "";
}

function requestProjectPlan(req) {
  return currentGallerySession(req) ? "pro" : "free";
}

function countProjectParts(pr) {
  return (pr?.alljj || []).reduce((sum, key) => {
    const p = pr?.allpa?.[key];
    if (!p) return sum;
    return sum + Math.max(1, Number(p.n) || 1);
  }, 0);
}

function projectPartLimitMessage(count, plan, limit) {
  if (plan === "pro") {
    return `Dieses Projekt erzeugt ${count} Teile. Pro ist auf ${limit} Teile begrenzt, damit Browser und Server stabil bleiben. Bitte Wiederholungen oder Teilungen reduzieren.`;
  }
  return `Dieses Projekt erzeugt ${count} Teile. Free ist auf ${limit} Teile begrenzt, Pro auf ${PROJECT_PART_LIMITS.pro} Teile. Bitte weniger Wiederholungen/Teilungen verwenden oder mit Pro einloggen.`;
}

function assertProjectPartLimit(pr, plan = "free") {
  const limit = PROJECT_PART_LIMITS[plan] || PROJECT_PART_LIMITS.free;
  const count = countProjectParts(pr);
  if (count > limit) {
    const err = new Error(projectPartLimitMessage(count, plan, limit));
    err.status = 413;
    err.code = "PROJECT_PART_LIMIT";
    err.details = { count, limit, plan };
    throw err;
  }
}

function projectLimitOptions(plan = "free") {
  return {
    partLimit: PROJECT_PART_LIMITS[plan] || PROJECT_PART_LIMITS.free,
    partLimitPlan: plan
  };
}

function requireGalleryUser(req, res) {
  const user = currentGalleryUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "login required" });
    return "";
  }
  return user;
}

function qDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function qLoad() {
  const data = readJSON(Q_PATH, { a: 0, d: {} });
  if (!data.d || typeof data.d !== "object") data.d = {};
  data.a = Number(data.a || 0);
  return data;
}

function qSave(data) {
  if (!fs.existsSync(GALLERY_DATA_DIR)) fs.mkdirSync(GALLERY_DATA_DIR, { recursive: true });
  const tmp = Q_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, Q_PATH);
}

function loadI18n(site, lang) {
  const baseDir = path.join(__dirname, "public", site, "i18n");
  const fallback = readJSON(path.join(baseDir, `${DEFAULT_LANG}.json`), {});
  const current = readJSON(path.join(baseDir, `${normalizeLang(lang)}.json`), {});

  return {
    ...fallback,
    ...current,
    nav: { ...(fallback.nav || {}), ...(current.nav || {}) },
    pages: { ...(fallback.pages || {}), ...(current.pages || {}) },
    titles: { ...(fallback.titles || {}), ...(current.titles || {}) },
    ui: { ...(fallback.ui || {}), ...(current.ui || {}) }
  };
}

function pageUrl(page) {
  return page === "index" ? "/" : `/${page}`;
}

function withLang(pathname, lang) {
  const sep = pathname.includes("?") ? "&" : "?";
  return `${pathname}${sep}lang=${lang}`;
}

function pagePath(mdFile) {
  return pageUrl(mdFile);
}

function fixRenderedLinks(html) {
  return html
    .replaceAll('href="app.html', 'href="/app.html')
    .replaceAll("href='app.html", "href='/app.html");
}

function readMarkdownPage(site, mdFile, lang) {
  const pagesDir = path.join(__dirname, `public/${site}/views/pages`);
  const localized = path.join(pagesDir, `${mdFile}.${lang}.md`);
  const fallback = path.join(pagesDir, `${mdFile}.md`);

  return fs.readFileSync(fs.existsSync(localized) ? localized : fallback, "utf8");
}

function renderMD(site, mdFile, title = "", lang = DEFAULT_LANG) {
  lang = normalizeLang(lang);
  const i18n = loadI18n(site, lang);
  const layout = fs.readFileSync(
    path.join(__dirname, `public/${site}/views/layout.html`),
    "utf8"
  );

  const md = i18n.pages?.[mdFile] || readMarkdownPage(site, mdFile, lang);

  const html = fixRenderedLinks(marked.parse(md));
  const resolvedTitle = i18n.titles?.[mdFile] || title;

  return layout
    .replaceAll("{{lang}}", lang)
    .replaceAll("{{title}}", resolvedTitle)
    .replaceAll("{{nav.start}}", i18n.nav?.start || "Start")
    .replaceAll("{{nav.app}}", i18n.nav?.app || "schreinertool")
    .replaceAll("{{nav.tut}}", i18n.nav?.tut || "Tutorial")
    .replaceAll("{{nav.example}}", i18n.nav?.example || "Beispiele")
    .replaceAll("{{nav.commands}}", i18n.nav?.commands || "Befehle")
    .replaceAll("{{nav.spick}}", i18n.nav?.spick || "Spickzettel")
    .replaceAll("{{nav.getstart}}", i18n.nav?.getstart || "Schnelleinstieg")
    .replaceAll("{{nav.videos}}", i18n.nav?.videos || "YouTube")
    .replaceAll("{{nav.impressum}}", i18n.nav?.impressum || "Impressum")
    .replaceAll("{{ui.jumpPlaceholder}}", i18n.ui?.jumpPlaceholder || "Zu Abschnitt springen ...")
    .replaceAll("{{ui.quote}}", i18n.ui?.quote || "")
    .replaceAll("{{href.start}}", withLang(pageUrl("index"), lang))
    .replaceAll("{{href.app}}", withLang("/app.html", lang))
    .replaceAll("{{href.tut}}", withLang(pageUrl("tut"), lang))
    .replaceAll("{{href.example}}", withLang(pageUrl("example"), lang))
    .replaceAll("{{href.commands}}", withLang(pageUrl("commands"), lang))
    .replaceAll("{{href.spick}}", withLang(pageUrl("spick"), lang))
    .replaceAll("{{href.getstart}}", withLang(pageUrl("getstart"), lang))
    .replaceAll("{{href.videos}}", withLang(pageUrl("videos"), lang))
    .replaceAll("{{href.price}}", withLang(pageUrl("price"), lang))
    .replaceAll("{{href.ai}}", withLang(pageUrl("ai"), lang))
    .replaceAll("{{href.gallery}}", withLang("/gallery", lang))
    .replaceAll("{{href.login}}", withLang("/login", lang))
    .replaceAll("{{href.impressum}}", withLang(pageUrl("impressum"), lang))
    .replaceAll("{{href.current}}", withLang(pagePath(mdFile), lang))
    .replaceAll("{{href.de}}", withLang(pagePath(mdFile), "de"))
    .replaceAll("{{href.en}}", withLang(pagePath(mdFile), "en"))
    .replaceAll("{{href.fr}}", withLang(pagePath(mdFile), "fr"))
    .replaceAll("{{href.nl}}", withLang(pagePath(mdFile), "nl"))
    .replaceAll("{{href.pl}}", withLang(pagePath(mdFile), "pl"))
    .replaceAll("{{href.it}}", withLang(pagePath(mdFile), "it"))
    .replace("{{content}}", html);
}

function renderHTMLPage(site, title = "", content = "", lang = DEFAULT_LANG, currentPage = "/") {
  lang = normalizeLang(lang);
  const i18n = loadI18n(site, lang);
  const layout = fs.readFileSync(
    path.join(__dirname, `public/${site}/views/layout.html`),
    "utf8"
  );

  return layout
    .replaceAll("{{lang}}", lang)
    .replaceAll("{{title}}", title)
    .replaceAll("{{nav.start}}", i18n.nav?.start || "Start")
    .replaceAll("{{nav.app}}", i18n.nav?.app || "schreinertool")
    .replaceAll("{{nav.tut}}", i18n.nav?.tut || "Tutorial")
    .replaceAll("{{nav.example}}", i18n.nav?.example || "Beispiele")
    .replaceAll("{{nav.commands}}", i18n.nav?.commands || "Befehle")
    .replaceAll("{{nav.spick}}", i18n.nav?.spick || "Spickzettel")
    .replaceAll("{{nav.getstart}}", i18n.nav?.getstart || "Schnelleinstieg")
    .replaceAll("{{nav.videos}}", i18n.nav?.videos || "YouTube")
    .replaceAll("{{nav.impressum}}", i18n.nav?.impressum || "Impressum")
    .replaceAll("{{ui.jumpPlaceholder}}", i18n.ui?.jumpPlaceholder || "Zu Abschnitt springen ...")
    .replaceAll("{{ui.quote}}", i18n.ui?.quote || "")
    .replaceAll("{{href.start}}", withLang(pageUrl("index"), lang))
    .replaceAll("{{href.app}}", withLang("/app.html", lang))
    .replaceAll("{{href.tut}}", withLang(pageUrl("tut"), lang))
    .replaceAll("{{href.example}}", withLang(pageUrl("example"), lang))
    .replaceAll("{{href.commands}}", withLang(pageUrl("commands"), lang))
    .replaceAll("{{href.spick}}", withLang(pageUrl("spick"), lang))
    .replaceAll("{{href.getstart}}", withLang(pageUrl("getstart"), lang))
    .replaceAll("{{href.videos}}", withLang(pageUrl("videos"), lang))
    .replaceAll("{{href.price}}", withLang(pageUrl("price"), lang))
    .replaceAll("{{href.ai}}", withLang(pageUrl("ai"), lang))
    .replaceAll("{{href.gallery}}", withLang("/gallery", lang))
    .replaceAll("{{href.login}}", withLang("/login", lang))
    .replaceAll("{{href.impressum}}", withLang(pageUrl("impressum"), lang))
    .replaceAll("{{href.current}}", withLang(currentPage, lang))
    .replaceAll("{{href.de}}", withLang(currentPage, "de"))
    .replaceAll("{{href.en}}", withLang(currentPage, "en"))
    .replaceAll("{{href.fr}}", withLang(currentPage, "fr"))
    .replaceAll("{{href.nl}}", withLang(currentPage, "nl"))
    .replaceAll("{{href.pl}}", withLang(currentPage, "pl"))
    .replaceAll("{{href.it}}", withLang(currentPage, "it"))
    .replace("{{content}}", content);
}

/* -------------------------------------------------- */
/* Schreinertool App                                  */
/* -------------------------------------------------- */
const stt = express();

stt.use((req, res, next) => {
  if (/\.(?:html|js)$/i.test(req.path)) {
    res.set("Cache-Control", "no-store");
  }
  next();
});

stt.use(express.json({ limit: "10mb" }));
stt.use(express.urlencoded({ extended: true }));

stt.get(["/gallery", "/gallery/"], (req, res) => {
  res.send(renderHTMLPage("schreinertool", "Galerie", galleryPageContent(), getLang(req), "/gallery"));
});
stt.get(["/login", "/login/"], (req, res) => {
  res.send(renderHTMLPage("schreinertool", "Login", loginPageContent(), getLang(req), "/login"));
});

stt.get("/s/:id", (req, res) => {
  const id = String(req.params.id || "").trim().toLowerCase();
  res.redirect(`/app.html?s=${encodeURIComponent(id)}`);
});

stt.get("/short-url/:id", (req, res) => {
  const id = String(req.params.id || "").trim().toLowerCase();
  const links = readJSON(SHORT_URLS_PATH, {});
  const entry = links[id];
  if (!entry?.inn) return res.status(404).json({ ok: false, error: "Kurzlink nicht gefunden" });
  res.json({ ok: true, id, inn: entry.inn });
});

stt.post("/short-url", (req, res) => {
  const inn = String(req.body?.inn || req.body?.project || "").trim();
  if (!inn) return res.status(400).json({ ok: false, error: "missing project text" });

  try {
    new Proj(expandAliases(inn), projectLimitOptions(requestProjectPlan(req))).getall();
  } catch (err) {
    return res.status(err?.status || 400).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      details: err?.details
    });
  }

  const links = readJSON(SHORT_URLS_PATH, {});
  const id = shortProjectId(inn, links);
  links[id] = {
    id,
    inn,
    hash: hash(normalize(inn)),
    created: new Date().toISOString().slice(0, 10)
  };
  writeGalleryDB(SHORT_URLS_PATH, links);

  res.json({ ok: true, id, url: publicShortUrl(req, id) });
});

stt.use(express.static(path.join(__dirname,"public","schreinertool")));
stt.use(express.static(path.join(__dirname,"public","schreinertool","gallery")));

/* -------------------------------------------------- */
/* API                                                */
/* -------------------------------------------------- */
stt.get("/getProj", (req, res) => {
  try {
    const { text } = req.query;
    if (!text) return res.status(400).json({ ok: false, error: "missing text" });

    const decoded = expandAliases(decodeURIComponent(text));
    const plan = requestProjectPlan(req);
    const pr = new Proj(decoded, projectLimitOptions(plan)).getall();
    return res.json(pr);

  } catch (err) {
    console.error("/getProj failed\n" + (err?.stack || err));
    return res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      line: err?.line,
      token: err?.token,
      details: err?.details,
      stack: err?.stack
    });
  }
});

stt.get("/q", (req, res) => {
  try {
    const d0 = qDay();
    const d1 = qDay(-1);
    const seen = readCookie(req, "st_q") === d0;
    const data = qLoad();

    if (!seen) {
      data.a += 1;
      data.d[d0] = Number(data.d[d0] || 0) + 1;
      data.u = new Date().toISOString();
      qSave(data);
      res.cookie("st_q", d0, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure || req.headers["x-forwarded-proto"] === "https",
        maxAge: 400 * 24 * 60 * 60 * 1000
      });
    }

    const a = Number(data.a || 0);
    const b = Number(data.d[d1] || 0);
    const c = Number(data.d[d0] || 0);
    const r = Math.floor(Math.random() * 10);

    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, v: `${a}.${b}.${c}.${r}` });
  } catch (err) {
    console.error("/q failed\n" + (err?.stack || err));
    return res.status(500).json({ ok: false });
  }
});

/* -------------------------------------------------- */
/* Gallery                                            */
/* -------------------------------------------------- */
ensureServerDataFiles();
if (!fs.existsSync(PUBLIC_GALLERY_DIR)) {
  fs.mkdirSync(PUBLIC_GALLERY_DIR, { recursive: true });
}
if (!fs.existsSync(USER_GALLERY_DIR)) {
  fs.mkdirSync(USER_GALLERY_DIR, { recursive: true });
}

function hash(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function galleryPathForSession(session) {
  if (session?.role === "admin") return DB_PATH;
  return path.join(USER_GALLERY_DIR, `${safeGalleryKey(session?.email)}.json`);
}

function readGalleryDB(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8").trim();
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeGalleryDB(file, db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file);
}

function shortProjectId(inn, links) {
  const normalized = String(inn || "").trim();
  const project = normalized.split(/\s+/)[0] || "projekt";
  const slug = project
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "projekt";
  const digest = crypto.createHash("sha1").update(normalized).digest("base64url").toLowerCase();

  for (let len = 6; len <= 12; len++) {
    const id = `${slug}-${digest.slice(0, len)}`;
    if (!links[id] || links[id].inn === normalized) return id;
  }

  return `${slug}-${digest.slice(0, 12)}-${Date.now().toString(36)}`;
}

function publicShortUrl(req, id) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "3dfg.de";
  return `${proto}://${host}/s/${id}`;
}

function cleanGalleryText(value) {
  return sanitize(String(value || ""), { allowedTags: [], allowedAttributes: {} }).trim();
}

function makeGalleryEntry(body, owner = "") {
  const inn = String(body.inn || body.project || "").trim();
  return {
    id: Date.now(),
    txt: cleanGalleryText(body.txt || body.title || ""),
    inn,
    url: String(body.url || ""),
    img: String(body.img || ""),
    hash: hash(normalize(inn || body.url || body.txt || "")),
    owner,
    date: new Date().toISOString().slice(0, 10),
    views: 0,
    likes: 0
  };
}

function galleryPageContent() {
  return `
<style>
.galleryPage{max-width:1100px;margin:0 auto 40px;padding:0 20px}
.galleryPage .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.galleryPage .toolbar[hidden]{display:none}
.galleryPage .toolbar a,.galleryPage .toolbar button{padding:9px 12px;border-radius:8px;border:1px solid #c7ccd4;background:#fff;color:#222;text-decoration:none;cursor:pointer}
.galleryPage .toolbar .active{background:#20242a;color:#fff}
.galleryBack{display:inline-block;margin:10px 0 14px;padding:14px 20px;border-radius:8px;background:#20242a;color:#fff;text-decoration:none;font-size:18px;font-weight:700}
.galleryBack:hover{background:#343a42}
.galleryPage .full{width:100%;box-sizing:border-box;border-radius:8px;font-size:15px;padding:12px;border:1px solid #d0d5dd}
#gallery{margin-top:14px}
.row{display:flex;align-items:center;gap:20px;padding:14px;margin-bottom:12px;background:white;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.05)}
.thumb{width:130px;border-radius:8px;cursor:pointer;flex-shrink:0}
.desc{flex:1;font-size:14px}
.loadbtn{padding:10px 16px;border-radius:8px;border:0;background:#e6e9ee;color:#222;text-decoration:none;cursor:pointer}
.loadbtn:hover{background:#d8dde5}
.editbox{width:100%;min-height:72px;box-sizing:border-box;border:1px solid #c7ccd4;border-radius:8px;padding:8px;font:14px system-ui,sans-serif}
.rowActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.danger{background:#ffe9e9}
.galleryStatus{font-size:14px;color:#59615b;margin:6px 0 12px}
@media (max-width:600px){.row{gap:12px;padding:12px}.thumb{width:70px}.desc{font-size:13px}}
</style>
<section class="galleryPage">
  <h2>schreinertool Galerie</h2>
  <a class="galleryBack" href="/app.html">Zurück zur App</a>
  <div class="toolbar" id="galleryToolbar" hidden>
    <a href="/gallery" id="publicLink">Öffentliche Galerie</a>
    <a href="/login" id="loginLink">Login</a>
    <a href="/gallery?mine=1" id="mineLink">Meine Galerie</a>
    <button id="logoutBtn" type="button">Logout</button>
  </div>
  <div id="galleryStatus" class="galleryStatus"></div>
  <input id="search" class="full" placeholder="Projekt suchen...">
  <div id="gallery"></div>
</section>
<script src="/gallery.js"></script>`;
}

function loginPageContent() {
  return `
<style>
.loginPage{max-width:760px;margin:0 auto;padding:0 20px 34px}
.loginPage section{background:#fff;border:1px solid #d8ddd6;border-radius:8px;padding:18px;margin:14px 0}
.loginPage form{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}
.loginPage input,.loginPage button{font:inherit;border-radius:6px;padding:10px;border:1px solid #b9c0b7}
.loginPage button{background:#202420;color:white;cursor:pointer}
.loginPage code{background:#eef0ec;padding:1px 4px;border-radius:4px}
.loginPage .hint{color:#5b635a}
.loginPage .status{min-height:20px;margin-top:10px;font-size:14px}
.loginPage .paypalBox{border-color:#f0d98a;background:#fff9e8}
.loginPage .paypalButton{display:inline-block;background:#ffc439;color:#111;text-decoration:none;border:1px solid #e0aa00;border-radius:6px;padding:10px 14px;font-weight:700}
</style>
<section class="loginPage">
  <section class="paypalBox">
    <h2>Jahreszugang bezahlen</h2>
    <p>Der Zugang zur persönlichen Galerie kostet <strong>12 EUR pro Jahr</strong>. Bitte bezahle mit derselben E-Mail-Adresse, die du beim Login einträgst.</p>
    <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
      <input type="hidden" name="cmd" value="_xclick-subscriptions">
      <input type="hidden" name="business" value="carsten.hilbert@gmail.com">
      <input type="hidden" name="item_name" value="schreinertool Jahreszugang">
      <input type="hidden" name="currency_code" value="EUR">
      <input type="hidden" name="a3" value="12.00">
      <input type="hidden" name="p3" value="1">
      <input type="hidden" name="t3" value="Y">
      <input type="hidden" name="src" value="1">
      <input type="hidden" name="no_note" value="1">
      <button type="submit" class="paypalButton">Mit PayPal 12 EUR/Jahr bezahlen</button>
    </form>
    <p class="hint">Nach der Zahlung muss die PayPal-E-Mail serverseitig in <code>data/schreinertool/gallery/paid-emails.json</code> eingetragen sein. Erst dann ist der Login freigeschaltet.</p>
  </section>
  <section>
    <h2>Login</h2>
    <p>Dieses Login prüft E-Mail, Passwort und die bezahlte PayPal-E-Mail auf dem Server. Nach erfolgreicher Anmeldung bekommst du eine geschützte Sitzung als Cookie.</p>
    <form id="loginForm">
      <input id="email" name="email" type="email" autocomplete="email" placeholder="E-Mail / PayPal-E-Mail" required>
      <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Passwort" required>
      <button type="submit">einloggen</button>
    </form>
    <div class="status" id="status"></div>
  </section>
  <section>
    <h2>Was passiert nach dem Login?</h2>
    <ul>
      <li>Du wirst zu deiner persönlichen Galerie weitergeleitet.</li>
      <li>Dort kannst du deine Einträge laden, Beschreibung/Text ändern und Einträge löschen.</li>
      <li>Private Speichervorgänge landen in deiner eigenen Galerie.</li>
      <li>Nur Benutzer, die in der Server-Datei <code>data/schreinertool/gallery/users.json</code> angelegt sind, können sich anmelden.</li>
      <li>Für normale Benutzer muss die PayPal-E-Mail zusätzlich in <code>data/schreinertool/gallery/paid-emails.json</code> stehen.</li>
      <li>Neue Benutzer können serverseitig mit <code>plain:startpasswort</code> angelegt werden; nach dem ersten Login wird daraus automatisch ein Hash.</li>
    </ul>
  </section>
  <section>
    <h2>Admin-Modus</h2>
    <p>Wenn dein Benutzer in <code>data/schreinertool/gallery/users.json</code> die Rolle <code>admin</code> hat, bearbeitest du die öffentliche Galerie.</p>
    <p class="hint">Für normale Benutzer bleibt die öffentliche Galerie unverändert.</p>
  </section>
  <p><a href="/gallery">Zur öffentlichen Galerie</a></p>
</section>
<script src="/login.js"></script>`;
}

const publishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30
});

stt.get("/auth/me", (req, res) => {
  const session = currentGallerySession(req);
  const email = session?.email || "";
  res.json({ ok: true, user: email, email, isAdmin: session?.role === "admin" });
});

stt.post("/login", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich" });
  }

  const userDb = loadGalleryUsers();
  const { key, account } = findGalleryAccount(userDb, email);
  if (!account || !verifyPassword(password, account.password)) {
    return res.status(401).json({ ok: false, error: "Ungültige Zugangsdaten" });
  }

  const role = account.role === "admin" ? "admin" : "user";
  if (role !== "admin") {
    const paid = paidEmailInfo(email);
    if (!paid?.valid) {
      return res.status(402).json({ ok: false, error: "Für diese E-Mail ist keine gültige PayPal-Zahlung hinterlegt" });
    }
  }

  if (String(account.password || "").startsWith("plain:")) {
    account.password = passwordHash(password);
    if (!account.email) account.email = email;
    account.updated = new Date().toISOString().slice(0, 10);
    writeGalleryUsers(userDb);
  }

  const token = crypto.randomBytes(32).toString("hex");
  gallerySessions.set(token, {
    user: key,
    email,
    role,
    created: Date.now()
  });

  res.cookie("st_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: 14 * 24 * 60 * 60 * 1000
  });
  res.json({ ok: true, user: email, email, isAdmin: role === "admin" });
});

stt.post("/logout", (req, res) => {
  const token = readCookie(req, "st_session");
  if (token) gallerySessions.delete(token);
  res.clearCookie("st_session", { sameSite: "lax" });
  res.json({ ok: true });
});

stt.post("/publish", publishLimiter, (req, res) => {

  const { txt, inn, url, img } = req.body;

  if (!inn || inn.trim() === "") {
    return res.json({ ok: false, msg: "kein Inhalt" });
  }

  try {
    new Proj(expandAliases(inn), projectLimitOptions("free")).getall();
  } catch (err) {
    return res.status(err?.status || 400).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      details: err?.details
    });
  }

  let db = [];

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf8").trim();
      if (raw) db = JSON.parse(raw);
    }
  } catch {
    db = [];
  }

  const id = Date.now();

  const entry = {
    id,
    txt: txt || "",
    inn: inn || "",
    url: url || "",
    img: (img && !img.startsWith("data:image")) ? img : "",
    hash: hash(normalize(inn)),
    date: new Date().toISOString().slice(0, 10),
    views: 0,
    likes: 0
  };

  db.push(entry);

  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);

  res.json({ ok: true, id });
});



stt.post("/publish-image", (req, res) => {

    const { img } = req.body;

    // 🔹 prüfen
    if (!img || !img.startsWith("data:image")) {
      return res.status(400).json({
        ok: false,
        msg: "kein gültiges Bild"
      });
    }

    // 🔹 Ordner sicherstellen

    if (!fs.existsSync(PUBLIC_GALLERY_DIR)) {
      fs.mkdirSync(PUBLIC_GALLERY_DIR, { recursive: true });
    }

    // 🔹 ID
    const id = Date.now();

    // 🔹 Dateityp erkennen
    const match = img.match(/^data:image\/(\w+);base64,/);
    const ext = match ? match[1] : "png";

    // 🔹 Base64 extrahieren
    const base64 = img.replace(/^data:image\/\w+;base64,/, "");

    const fileName = `${id}.${ext}`;
    const filePath = path.join(PUBLIC_GALLERY_DIR, fileName);

    fs.writeFileSync(filePath, base64, "base64");

    return res.json({
      ok: true,
      imageUrl: "/gallery/" + fileName
    });


    

});


stt.get("/gallery-data", (req, res) => {
  try {
    let db = readGalleryDB(DB_PATH);
    const q = normalize(req.query.q || "").toLowerCase();
    if (q) {
      db = db.filter(e =>
        normalize(`${e.txt || ""} ${e.inn || ""} ${e.url || ""}`).toLowerCase().includes(q)
      );
    }

    db.sort((a, b) => b.id - a.id);
    res.json(db);

  } catch {
    res.json([]);
  }
});

stt.get("/my-gallery-data", (req, res) => {
  const user = requireGalleryUser(req, res);
  if (!user) return;
  const session = currentGallerySession(req);

  const q = normalize(req.query.q || "").toLowerCase();
  let db = readGalleryDB(galleryPathForSession(session));
  if (q) {
    db = db.filter(e =>
      normalize(`${e.txt || ""} ${e.inn || ""} ${e.url || ""}`).toLowerCase().includes(q)
    );
  }

  db.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  res.json({
    ok: true,
    user,
    isAdmin: session?.role === "admin",
    entries: db
  });
});

stt.post("/private-save", publishLimiter, (req, res) => {
  const user = requireGalleryUser(req, res);
  if (!user) return;
  const session = currentGallerySession(req);

  const entry = makeGalleryEntry(req.body || {}, user);
  if (!entry.inn && !entry.url) {
    return res.status(400).json({ ok: false, error: "missing project text or url" });
  }

  if (entry.inn) {
    try {
      new Proj(expandAliases(entry.inn), projectLimitOptions("pro")).getall();
    } catch (err) {
      return res.status(err?.status || 400).json({
        ok: false,
        error: err?.message || String(err),
        code: err?.code,
        details: err?.details
      });
    }
  }

  const file = galleryPathForSession(session);
  const db = readGalleryDB(file);
  db.push(entry);
  writeGalleryDB(file, db);
  res.json({ ok: true, id: entry.id, user, isAdmin: session?.role === "admin" });
});

stt.patch("/my-gallery/:id", (req, res) => {
  const user = requireGalleryUser(req, res);
  if (!user) return;
  const session = currentGallerySession(req);

  const id = Number(req.params.id);
  const file = galleryPathForSession(session);
  const db = readGalleryDB(file);
  const idx = db.findIndex(e => Number(e.id) === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: "entry not found" });

  if ("txt" in req.body) db[idx].txt = cleanGalleryText(req.body.txt);
  if ("inn" in req.body) {
    db[idx].inn = String(req.body.inn || "");
    db[idx].hash = hash(normalize(db[idx].inn));
  }
  if ("url" in req.body) db[idx].url = String(req.body.url || "");
  if ("img" in req.body) db[idx].img = String(req.body.img || "");
  db[idx].updated = new Date().toISOString().slice(0, 10);

  writeGalleryDB(file, db);
  res.json({ ok: true, entry: db[idx] });
});

stt.delete("/my-gallery/:id", (req, res) => {
  const user = requireGalleryUser(req, res);
  if (!user) return;
  const session = currentGallerySession(req);

  const id = Number(req.params.id);
  const file = galleryPathForSession(session);
  const db = readGalleryDB(file);
  const next = db.filter(e => Number(e.id) !== id);
  if (next.length === db.length) return res.status(404).json({ ok: false, error: "entry not found" });

  writeGalleryDB(file, next);
  res.json({ ok: true });
});

/* -------------------------------------------------- */
/* Seiten                                             */
/* -------------------------------------------------- */
stt.use((req, res, next) => {
  const queryString = req.originalUrl.split("?")[1] || "";

  if (
    queryString.length > 40 &&
    !req.path.startsWith("/app.html")
  ) {
    return res.redirect("/app.html?" + queryString);
  }

  next();
});
function sendSchreinerPage(page, title) {
  return (req, res) => res.send(renderMD("schreinertool", page, title, getLang(req)));
}

stt.get("/", sendSchreinerPage("index", "Start"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/?$/, sendSchreinerPage("index", "Start"));
stt.get("/index", sendSchreinerPage("index", "Start"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/index$/, sendSchreinerPage("index", "Start"));
stt.get("/app", (req, res) => res.redirect(withLang("/app.html", getLang(req))));
stt.get(/^\/(de|en|fr|nl|pl|it)\/app$/, (req, res) => res.redirect(withLang("/app.html", getLang(req))));
stt.get("/help", sendSchreinerPage("help", "Hilfe"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/help$/, sendSchreinerPage("help", "Hilfe"));
stt.get("/commands", sendSchreinerPage("commands", "Befehle"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/commands$/, sendSchreinerPage("commands", "Befehle"));
stt.get("/example", sendSchreinerPage("example", "Beispiele"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/example$/, sendSchreinerPage("example", "Beispiele"));
stt.get("/spick", sendSchreinerPage("spick", "Spickzettel"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/spick$/, sendSchreinerPage("spick", "Spickzettel"));
stt.get("/getstart", sendSchreinerPage("getstart", "Schnelleinstieg"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/getstart$/, sendSchreinerPage("getstart", "Schnelleinstieg"));
stt.get("/price", sendSchreinerPage("price", "Preise"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/price$/, sendSchreinerPage("price", "Preise"));
stt.get("/ai", sendSchreinerPage("ai", "AI"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/ai$/, sendSchreinerPage("ai", "AI"));
stt.get("/videos", sendSchreinerPage("videos", "YouTube"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/videos$/, sendSchreinerPage("videos", "YouTube"));
stt.get("/impressum", sendSchreinerPage("impressum", "Impressum"));
stt.get(/^\/(de|en|fr|nl|pl|it)\/impressum$/, sendSchreinerPage("impressum", "Impressum"));
/* -------------------------------------------------- */
/* Domains                                            */
/* -------------------------------------------------- */
const schreinertoolMoved = express();

function movedTargetUrl(req) {
  return `https://3dfg.de${req.originalUrl || "/"}`;
}

function htmlAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSchreinertoolMovedPage(targetUrl) {
  const escapedTargetUrl = htmlAttr(targetUrl);

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <title>schreinertool ist umgezogen</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8f4;
      --text: #252b2c;
      --muted: #5d6868;
      --line: #d9ded8;
      --accent: #d96f22;
      --accent-dark: #9f4813;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 28px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    main {
      width: min(100%, 680px);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: clamp(28px, 6vw, 54px);
      background: #fff;
    }

    .mark {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }

    h1 {
      margin: 12px 0 14px;
      font-size: clamp(34px, 8vw, 62px);
      line-height: .96;
      letter-spacing: 0;
    }

    p {
      margin: 0 0 24px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.55;
    }

    a.button {
      display: inline-flex;
      align-items: center;
      min-height: 46px;
      padding: 0 20px;
      border-radius: 6px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }

    a.button:focus,
    a.button:hover {
      background: var(--accent-dark);
    }
  </style>
</head>
<body>
  <main>
    <div class="mark">schreinertool.de</div>
    <h1>Die Seite ist umgezogen.</h1>
    <p>schreinertool laeuft jetzt unter dem Namen 3dfg. Es gibt keine automatische Weiterleitung; du kannst selbst entscheiden, ob du zur neuen Seite wechseln moechtest.</p>
    <a class="button" href="${escapedTargetUrl}">Zu 3dfg.de</a>
  </main>
</body>
</html>`;
}

schreinertoolMoved.use((req, res) => {
  const targetUrl = movedTargetUrl(req);
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, follow");

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.status(200).send(renderSchreinertoolMovedPage(targetUrl));
});

app.use(vhost("beta.schreinertool.de", stt));
app.use(vhost("www.beta.schreinertool.de", stt));
app.use(vhost("schreinertool.de", schreinertoolMoved));
app.use(vhost("www.schreinertool.de", schreinertoolMoved));
app.use(vhost("3dfg.de", stt));
app.use(vhost("www.3dfg.de", stt));




/* ---------------------- */
/* HILBERT CNC DOMAIN     */
/* ---------------------- */

const hilbert = express();

hilbert.use(express.static(path.join(__dirname,"public","hilbertcnc")));

/* -------------------------------------------------- */
/* Seiten                                             */
/* -------------------------------------------------- */
hilbert.get("/",        (_, res) => res.send(renderMD("hilbertcnc", "index",     "Start")));
hilbert.get("/index.html",   (_, res) => res.send(renderMD("hilbertcnc", "index",     "Start")));
hilbert.get("/tut",     (_, res) => res.send(renderMD("hilbertcnc", "tut",       "Tutorial")));
hilbert.get("/commands",(_, res) => res.send(renderMD("hilbertcnc", "commands",  "Befehle")));
hilbert.get("/impressum",(_, res)=> res.send(renderMD("hilbertcnc", "impressum", "Impressum")));
const ccc = express();

app.use(vhost("hilbertcnc.de", hilbert));
app.use(vhost("www.hilbertcnc.de", hilbert));
app.use("/ccc", ccc);



/* -------------------------------------------------- */
/* SERVER START                                       */
/* -------------------------------------------------- */
const IS_BETA_DEPLOY = path.basename(__dirname) === "3dfg";
const PORT = Number(process.env.PORT) || (IS_BETA_DEPLOY ? 3000 : 3001);

app.listen(PORT, () => {
  console.log("✅ Server läuft auf Port", PORT);
});
