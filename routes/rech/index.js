import fs from "fs";
import path from "path";
import express from "express";

function safeUserKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "user";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function cleanText(value, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMultiline(value, max = 1200) {
  return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeInvoice(input = {}, fallbackNumber = "") {
  const items = Array.isArray(input.items) ? input.items : [];
  const normalizedItems = items
    .slice(0, 80)
    .map(item => ({
      description: cleanText(item.description, 500),
      qty: Math.max(0, cleanNumber(item.qty, 1)),
      unit: cleanText(item.unit, 40) || "Stk.",
      price: Math.max(0, cleanNumber(item.price, 0)),
      tax: Math.max(0, cleanNumber(item.tax, 19))
    }))
    .filter(item => item.description || item.qty || item.price);

  return {
    id: cleanText(input.id, 80),
    number: cleanText(input.number, 80) || fallbackNumber,
    date: cleanText(input.date, 20) || today(),
    dueDate: cleanText(input.dueDate, 20),
    status: cleanText(input.status, 40) || "Entwurf",
    sender: cleanMultiline(input.sender),
    recipient: cleanMultiline(input.recipient),
    subject: cleanText(input.subject, 300),
    notes: cleanMultiline(input.notes, 1600),
    payment: cleanMultiline(input.payment, 1200),
    items: normalizedItems.length
      ? normalizedItems
      : [{ description: "", qty: 1, unit: "Stk.", price: 0, tax: 19 }]
  };
}

function totals(invoice) {
  const lines = invoice.items.map(item => {
    const net = item.qty * item.price;
    const taxAmount = net * item.tax / 100;
    return { net, taxAmount, gross: net + taxAmount };
  });

  return lines.reduce((sum, line) => ({
    net: sum.net + line.net,
    tax: sum.tax + line.taxAmount,
    gross: sum.gross + line.gross
  }), { net: 0, tax: 0, gross: 0 });
}

function sortInvoices(invoices) {
  return invoices.sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")) ||
    String(b.updated || b.created || "").localeCompare(String(a.updated || a.created || ""))
  );
}

export function createRechRouter(options = {}) {
  const {
    publicDir,
    dataDir,
    currentUser
  } = options;

  const router = express.Router();
  const indexFile = path.join(publicDir, "index.html");

  function userFromReq(req) {
    return cleanText(currentUser?.(req), 200);
  }

  function requireUser(req, res) {
    const user = userFromReq(req);
    if (!user) {
      res.status(401).json({ ok: false, error: "login required" });
      return "";
    }
    return user;
  }

  function userFile(user) {
    return path.join(dataDir, `${safeUserKey(user)}.json`);
  }

  function readInvoices(user) {
    const data = readJSON(userFile(user), { invoices: [] });
    return Array.isArray(data.invoices) ? data.invoices : [];
  }

  function writeInvoices(user, invoices) {
    writeJSON(userFile(user), { user, updated: new Date().toISOString(), invoices });
  }

  function nextNumber(invoices) {
    const year = new Date().getFullYear();
    const max = invoices.reduce((highest, invoice) => {
      const match = String(invoice.number || "").match(/^R-(\d{4})-(\d+)$/);
      if (!match || Number(match[1]) !== year) return highest;
      return Math.max(highest, Number(match[2]) || 0);
    }, 0);
    return `R-${year}-${String(max + 1).padStart(4, "0")}`;
  }

  router.get(["/", ""], (req, res) => {
    if (!userFromReq(req)) return res.redirect("/login?next=/rech");
    res.sendFile(indexFile);
  });

  router.use(express.static(publicDir));

  router.get("/api/me", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ ok: true, user });
  });

  router.get("/api/invoices", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const invoices = sortInvoices(readInvoices(user)).map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      date: invoice.date,
      recipient: invoice.recipient,
      subject: invoice.subject,
      status: invoice.status,
      totals: totals(invoice)
    }));
    res.json({ ok: true, invoices });
  });

  router.get("/api/invoices/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const invoice = readInvoices(user).find(entry => entry.id === req.params.id);
    if (!invoice) return res.status(404).json({ ok: false, error: "invoice not found" });
    res.json({ ok: true, invoice: { ...invoice, totals: totals(invoice) } });
  });

  router.post("/api/invoices", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const invoices = readInvoices(user);
    const now = new Date().toISOString();
    const invoice = normalizeInvoice(req.body || {}, nextNumber(invoices));
    invoice.id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    invoice.created = now;
    invoice.updated = now;
    invoices.push(invoice);
    writeInvoices(user, invoices);
    res.status(201).json({ ok: true, invoice: { ...invoice, totals: totals(invoice) } });
  });

  router.put("/api/invoices/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const invoices = readInvoices(user);
    const idx = invoices.findIndex(entry => entry.id === req.params.id);
    if (idx < 0) return res.status(404).json({ ok: false, error: "invoice not found" });

    const invoice = normalizeInvoice({ ...req.body, id: req.params.id }, invoices[idx].number);
    invoice.id = req.params.id;
    invoice.created = invoices[idx].created || new Date().toISOString();
    invoice.updated = new Date().toISOString();
    invoices[idx] = invoice;
    writeInvoices(user, invoices);
    res.json({ ok: true, invoice: { ...invoice, totals: totals(invoice) } });
  });

  router.delete("/api/invoices/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const invoices = readInvoices(user);
    const next = invoices.filter(entry => entry.id !== req.params.id);
    if (next.length === invoices.length) return res.status(404).json({ ok: false, error: "invoice not found" });

    writeInvoices(user, next);
    res.json({ ok: true });
  });

  return router;
}
