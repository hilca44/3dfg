const state = {
  user: "",
  invoices: [],
  currentId: "",
  items: []
};

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const form = document.getElementById("invoiceForm");
const itemsTable = document.getElementById("itemsTable");
const invoiceList = document.getElementById("invoiceList");
const statusLine = document.getElementById("statusLine");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text) {
  statusLine.textContent = text;
}

async function api(path, options = {}) {
  const res = await fetch(`/rech/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Anfrage fehlgeschlagen");
  return data;
}

function emptyInvoice() {
  return {
    number: "",
    date: today(),
    dueDate: dueDate(),
    status: "Entwurf",
    sender: "",
    recipient: "",
    subject: "",
    payment: "",
    notes: "",
    items: [{ description: "", qty: 1, unit: "Stk.", price: 0, tax: 19 }]
  };
}

function readForm() {
  return {
    number: form.number.value,
    date: form.date.value,
    dueDate: form.dueDate.value,
    status: form.status.value,
    sender: form.sender.value,
    recipient: form.recipient.value,
    subject: form.subject.value,
    payment: form.payment.value,
    notes: form.notes.value,
    items: state.items.map(item => ({
      description: item.description,
      qty: Number(item.qty) || 0,
      unit: item.unit,
      price: Number(item.price) || 0,
      tax: Number(item.tax) || 0
    }))
  };
}

function fillForm(invoice) {
  form.number.value = invoice.number || "";
  form.date.value = invoice.date || today();
  form.dueDate.value = invoice.dueDate || "";
  form.status.value = invoice.status || "Entwurf";
  form.sender.value = invoice.sender || "";
  form.recipient.value = invoice.recipient || "";
  form.subject.value = invoice.subject || "";
  form.payment.value = invoice.payment || "";
  form.notes.value = invoice.notes || "";
  state.items = (invoice.items && invoice.items.length ? invoice.items : emptyInvoice().items).map(item => ({ ...item }));
  renderItems();
  renderPreview();
}

function calcTotals(invoice = readForm()) {
  return invoice.items.reduce((sum, item) => {
    const net = (Number(item.qty) || 0) * (Number(item.price) || 0);
    const tax = net * ((Number(item.tax) || 0) / 100);
    sum.net += net;
    sum.tax += tax;
    sum.gross += net + tax;
    return sum;
  }, { net: 0, tax: 0, gross: 0 });
}

function renderTotals() {
  const totals = calcTotals();
  document.getElementById("totalsBox").innerHTML = `
    <p class="totalLine"><span>Netto</span><strong>${money.format(totals.net)}</strong></p>
    <p class="totalLine"><span>USt.</span><strong>${money.format(totals.tax)}</strong></p>
    <p class="totalLine final"><span>Gesamt</span><strong>${money.format(totals.gross)}</strong></p>
  `;
}

function renderItems() {
  itemsTable.innerHTML = "";
  state.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "itemRow";
    row.innerHTML = `
      <label>Beschreibung <input data-field="description" value="${escapeHTML(item.description)}"></label>
      <label>Menge <input data-field="qty" type="number" min="0" step="0.01" value="${escapeHTML(item.qty)}"></label>
      <label>Einheit <input data-field="unit" value="${escapeHTML(item.unit || "Stk.")}"></label>
      <label>Preis <input data-field="price" type="number" min="0" step="0.01" value="${escapeHTML(item.price)}"></label>
      <label>USt. % <input data-field="tax" type="number" min="0" step="0.01" value="${escapeHTML(item.tax)}"></label>
      <button class="dangerBtn" type="button" title="Position entfernen">×</button>
    `;

    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => {
        state.items[index][input.dataset.field] = input.value;
        renderPreview();
      });
    });

    row.querySelector("button").addEventListener("click", () => {
      state.items.splice(index, 1);
      if (!state.items.length) state.items.push({ description: "", qty: 1, unit: "Stk.", price: 0, tax: 19 });
      renderItems();
      renderPreview();
    });

    itemsTable.appendChild(row);
  });
  renderTotals();
}

function renderList() {
  invoiceList.innerHTML = "";
  if (!state.invoices.length) {
    invoiceList.innerHTML = '<p class="userBox">Noch keine Rechnungen gespeichert.</p>';
    return;
  }

  state.invoices.forEach(invoice => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `invoiceItem${invoice.id === state.currentId ? " active" : ""}`;
    btn.innerHTML = `
      <strong>${escapeHTML(invoice.number || "Ohne Nummer")}</strong>
      <span>${escapeHTML(invoice.date || "")} · ${money.format(invoice.totals?.gross || 0)}</span>
      <span>${escapeHTML(firstLine(invoice.recipient) || invoice.subject || "Kein Empfaenger")}</span>
    `;
    btn.addEventListener("click", () => loadInvoice(invoice.id));
    invoiceList.appendChild(btn);
  });
}

function firstLine(value) {
  return String(value || "").split("\n").map(line => line.trim()).find(Boolean) || "";
}

function renderPreview() {
  const invoice = readForm();
  const totals = calcTotals(invoice);
  const rows = invoice.items.map(item => {
    const net = (Number(item.qty) || 0) * (Number(item.price) || 0);
    return `
      <tr>
        <td>${escapeHTML(item.description)}</td>
        <td>${escapeHTML(item.qty)} ${escapeHTML(item.unit)}</td>
        <td>${money.format(Number(item.price) || 0)}</td>
        <td>${escapeHTML(item.tax)}%</td>
        <td>${money.format(net)}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("preview").innerHTML = `
    <div class="previewHeader">
      <div class="previewAddress">${escapeHTML(invoice.sender)}</div>
      <div>
        <h2>Rechnung</h2>
        <p class="muted">${escapeHTML(invoice.number || "Neue Rechnung")}</p>
        <p>Datum: ${escapeHTML(invoice.date)}</p>
        <p>Faellig: ${escapeHTML(invoice.dueDate || "-")}</p>
      </div>
    </div>
    <div class="previewAddress">${escapeHTML(invoice.recipient)}</div>
    <h3>${escapeHTML(invoice.subject || "Rechnung")}</h3>
    <table class="previewTable">
      <thead>
        <tr>
          <th>Position</th>
          <th>Menge</th>
          <th>Preis</th>
          <th>USt.</th>
          <th>Netto</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="totalLine"><span>Netto</span><strong>${money.format(totals.net)}</strong></p>
    <p class="totalLine"><span>USt.</span><strong>${money.format(totals.tax)}</strong></p>
    <p class="totalLine final"><span>Gesamt</span><strong>${money.format(totals.gross)}</strong></p>
    <div class="previewNotes">${escapeHTML(invoice.payment)}</div>
    <div class="previewNotes">${escapeHTML(invoice.notes)}</div>
  `;
  renderTotals();
}

async function loadMe() {
  const data = await api("/me");
  state.user = data.user || "";
  document.getElementById("userBox").textContent = `Angemeldet als ${state.user}`;
}

async function loadInvoices() {
  const data = await api("/invoices");
  state.invoices = data.invoices || [];
  renderList();
}

async function loadInvoice(id) {
  const data = await api(`/invoices/${encodeURIComponent(id)}`);
  state.currentId = data.invoice.id;
  fillForm(data.invoice);
  renderList();
  setStatus(`Rechnung ${data.invoice.number} geladen.`);
}

async function saveInvoice(event) {
  event.preventDefault();
  setStatus("Speichere ...");
  const invoice = readForm();
  const method = state.currentId ? "PUT" : "POST";
  const path = state.currentId ? `/invoices/${encodeURIComponent(state.currentId)}` : "/invoices";
  const data = await api(path, {
    method,
    body: JSON.stringify(invoice)
  });
  state.currentId = data.invoice.id;
  fillForm(data.invoice);
  await loadInvoices();
  setStatus("Gespeichert.");
}

async function deleteInvoice() {
  if (!state.currentId) {
    newInvoice();
    return;
  }
  if (!confirm("Diese Rechnung wirklich loeschen?")) return;
  await api(`/invoices/${encodeURIComponent(state.currentId)}`, { method: "DELETE" });
  await loadInvoices();
  newInvoice();
  setStatus("Geloescht.");
}

function newInvoice() {
  state.currentId = "";
  fillForm(emptyInvoice());
  renderList();
  setStatus("Neue Rechnung.");
}

form.addEventListener("submit", saveInvoice);
form.addEventListener("input", renderPreview);
document.getElementById("newBtn").addEventListener("click", newInvoice);
document.getElementById("addItemBtn").addEventListener("click", () => {
  state.items.push({ description: "", qty: 1, unit: "Stk.", price: 0, tax: 19 });
  renderItems();
  renderPreview();
});
document.getElementById("deleteBtn").addEventListener("click", deleteInvoice);
document.getElementById("printBtn").addEventListener("click", () => window.print());

try {
  await loadMe();
  await loadInvoices();
  newInvoice();
} catch (err) {
  document.getElementById("userBox").textContent = "Bitte erst einloggen.";
  setStatus(err.message || "Fehler beim Laden.");
}
