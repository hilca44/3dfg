const params = new URLSearchParams(location.search);
const personalMode = params.get("mine") === "1";
let auth = { user: "", isAdmin: false };

async function loadAuth() {
  try {
    const res = await fetch("/auth/me", { cache: "no-store" });
    auth = await res.json().catch(() => ({ user: "", isAdmin: false }));
  } catch {
    auth = { user: "", isAdmin: false };
  }
  updateToolbar();
}

function updateToolbar() {
  const toolbar = document.getElementById("galleryToolbar");
  if (toolbar) toolbar.hidden = !auth.user && !personalMode;

  document.getElementById("publicLink")?.classList.toggle("active", !personalMode);
  document.getElementById("mineLink")?.classList.toggle("active", personalMode);

  const loginLink = document.getElementById("loginLink");
  const logoutBtn = document.getElementById("logoutBtn");
  const mineLink = document.getElementById("mineLink");
  if (loginLink) loginLink.style.display = auth.user ? "none" : "";
  if (mineLink) mineLink.style.display = auth.user ? "" : "none";
  if (logoutBtn) logoutBtn.style.display = auth.user ? "" : "none";

  const status = document.getElementById("galleryStatus");
  if (!status) return;

  if (!personalMode) {
    status.textContent = auth.user ? `Angemeldet als ${auth.user}.` : "";
    return;
  }

  if (!auth.user) {
    status.innerHTML = `Bitte <a href="/login">einloggen</a>, um deine persönliche Galerie zu sehen.`;
    return;
  }

  status.textContent = auth.isAdmin
    ? "Admin-Modus: Du bearbeitest die öffentliche Galerie."
    : `Persönliche Galerie von ${auth.user}.`;
}

async function load() {
  const q = document.getElementById("search").value;
  const host = document.getElementById("gallery");
  host.innerHTML = "";

  if (personalMode && !auth.user) {
    updateToolbar();
    return;
  }

  const url = personalMode
    ? "/my-gallery-data?q=" + encodeURIComponent(q)
    : "/gallery-data?q=" + encodeURIComponent(q);

  let entries = [];
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => personalMode ? { entries: [] } : []);
    entries = personalMode ? (data.entries || []) : data;
  } catch (err) {
    console.warn("Galerie konnte nicht geladen werden", err);
  }

  renderGallery(entries);
}

function entryUrl(e) {
  if (e.url) return e.url;
  if (e.inn) return "app.html?" + encodeURIComponent(e.inn.split(/\s+/)[0] || "schrank") + "=" + encodeURIComponent(e.inn);
  return "#";
}

function createRow(e) {
  const row = document.createElement("div");
  row.className = "row";

  const imgLink = document.createElement("a");
  imgLink.href = entryUrl(e);
  imgLink.target = "_blank";

  const img = document.createElement("img");
  img.className = "thumb";
  img.src = e.img || "logo.svg";
  img.alt = e.txt || "Galerieeintrag";
  imgLink.appendChild(img);

  const desc = personalMode ? createEditableDesc(e) : document.createElement("div");
  desc.className = "desc";
  if (!personalMode) desc.textContent = e.txt || "";

  const link = document.createElement("a");
  link.className = "loadbtn";
  link.href = entryUrl(e);
  link.textContent = "Laden";

  row.append(imgLink, desc, link);
  return row;
}

function createEditableDesc(e) {
  const wrap = document.createElement("div");

  const txt = document.createElement("textarea");
  txt.className = "editbox";
  txt.value = e.txt || "";

  const actions = document.createElement("div");
  actions.className = "rowActions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "loadbtn";
  save.textContent = "Text speichern";
  save.addEventListener("click", async () => {
    save.disabled = true;
    await updateEntry(e.id, { txt: txt.value });
    save.disabled = false;
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "loadbtn danger";
  del.textContent = "Löschen";
  del.addEventListener("click", async () => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    await deleteEntry(e.id);
  });

  actions.append(save, del);
  wrap.append(txt, actions);
  return wrap;
}

function renderGallery(data) {
  const host = document.getElementById("gallery");
  host.innerHTML = "";
  data = Array.isArray(data) ? data : [];
  if (!data.length) {
    host.textContent = personalMode ? "Noch keine Einträge." : "Keine Einträge gefunden.";
    return;
  }
  data.forEach(e => host.appendChild(createRow(e)));
}

async function updateEntry(id, patch) {
  const res = await fetch(`/my-gallery/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) alert("Speichern fehlgeschlagen.");
}

async function deleteEntry(id) {
  const res = await fetch(`/my-gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    alert("Löschen fehlgeschlagen.");
    return;
  }
  await load();
}

function loadModel(encoded) {
  const pr = decodeURIComponent(encoded);
  localStorage.setItem("c3_import", pr);
  window.location.href = "/";
}

function goBack() {
  window.location.href = "/";
}

document.getElementById("search")?.addEventListener("input", load);
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  location.href = "/gallery";
});

load();
loadAuth().then(() => {
  if (personalMode) load();
});
