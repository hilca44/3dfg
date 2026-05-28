// app.js – UI + Editor + State (kein Three!)

import { Proj } from "./proj-client.js?v=dockparse1";
import { DEFAULT_CORPUS, innToUrl } from "./fu.js?v=dockparse1";
import { urlToInn } from "./fu.js?v=dockparse1";
import { updateAndReloadURL } from "./fu.js?v=dockparse1";
import { ProjectEditor as pp} from "./project-editor.js?v=arrayparse34";
import { convertLegacyToModern } from "./legacy-converter.js?v=dockparse1";
let CURRENT_STATE = null;
const colors = window.colors || {};

const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
if (window.freeLimitsReady) await window.freeLimitsReady;
const FREE_LIMITS = window.FREE_LIMITS || {
  projectParts: { free: 100, pro: 600 },
  holzliste: { insideFreeLines: 60, exportFreeLines: 100, freeLines: 100 },
  cutplan: { freePlates: 1 }
};
const PROJECT_PART_LIMITS = FREE_LIMITS.projectParts || { free: 100, pro: 600 };
window.PROJECT_PART_LIMITS = PROJECT_PART_LIMITS;
let projectAccessPromise = null;
let projectAccessPlan = null;
var temp0
function stt(key, fallback = "") {
  const value = key.split(".").reduce((obj, part) => obj?.[part], window.ST_I18N);
  return value || fallback || key;
}

window.addEventListener("st:i18n", () => {
  if (window.currentState && STATES[window.currentState]) {
    setButtons(STATES[window.currentState].btn || [], "slot0");
    setButtons(STATES[window.currentState].buttons || []);
  }
});

class ProjectPartLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProjectPartLimitError";
    this.details = details;
  }
}

function countProjectParts(PR) {
  if (!isReadyPR(PR)) return 0;
  const names = PR.jj?.length ? PR.jj : Object.keys(PR.oks || {});
  return names.reduce((sum, name) => {
    const k = PR.oks?.[name];
    if (!k) return sum;
    if (k.type === "part") return sum + 1;
    if (/^(?:txt\d+_|.+_txt)\d+/i.test(String(k.nme || ""))) return sum + 1;
    if (!Array.isArray(k.jj)) return sum;
    return sum + k.jj.filter(partName => k[partName]).length;
  }, 0);
}

async function getProjectAccessPlan() {
  if (projectAccessPlan) return projectAccessPlan;
  if (!projectAccessPromise) {
    projectAccessPromise = fetch("/auth/me", { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then(auth => auth?.user || auth?.isAdmin ? "pro" : "free")
      .catch(() => "free");
  }
  projectAccessPlan = await projectAccessPromise;
  return projectAccessPlan;
}

function projectPartLimitMessage(count, plan, limit) {
  const proLimit = PROJECT_PART_LIMITS.pro;
  if (plan === "pro") {
    return `Dieses Projekt erzeugt ${count} Teile. Pro ist auf ${limit} Teile begrenzt, damit Browser und Server stabil bleiben. Bitte Wiederholungen oder Teilungen reduzieren.`;
  }
  return `Dieses Projekt erzeugt ${count} Teile. Free ist auf ${limit} Teile begrenzt, Pro auf ${proLimit} Teile. Bitte weniger Wiederholungen/Teilungen verwenden oder mit Pro einloggen.`;
}

function notifyProjectPartLimit(PR) {
  const hit = PR?.partLimitExceeded;
  if (!hit) return false;
  return true;
}

async function validateProjectPartLimit(PR, options = {}) {
  if (notifyProjectPartLimit(PR)) {
    return {
      count: PR.partLimitExceeded.count,
      limit: PR.partLimitExceeded.limit,
      plan: PR.partLimitExceeded.plan
    };
  }

  const plan = options.plan || await getProjectAccessPlan();
  const limit = PROJECT_PART_LIMITS[plan] || PROJECT_PART_LIMITS.free;
  const count = countProjectParts(PR);
  if (count > limit) {
    PR.partLimitExceeded = {
      count,
      limit,
      plan,
      rendered: limit,
      message: projectPartLimitMessage(count, plan, limit)
    };
    notifyProjectPartLimit(PR);
  }
  return { count, limit, plan };
}

window.validateProjectPartLimit = validateProjectPartLimit;
window.countProjectParts = countProjectParts;
window.notifyProjectPartLimit = notifyProjectPartLimit;
// c3cad command help dictionary
// keys: exactly 1 lowercase letter
// values: human readable help text

const UI_MODE_KEY = "c3cad.ui.mode";
function getUIMode() {
  return localStorage.getItem(UI_MODE_KEY) || "main";
}

function setUIMode(mode) {
  localStorage.setItem(UI_MODE_KEY, mode);
}

function onModeButtonClick(btn) {
  const mode = toggleUIMode(btn.to);
  applyUIMode(mode);
}


function toggleUIMode(target) {
  let cur = getUIMode();

  if (target === "main") {
    setUIMode("main");
    return "main";
  }

  // target z.B. "txtmod"
  if (cur === target) {
    setUIMode("main");
    return "main";
  } else {
    setUIMode(target);
    return target;
  }
}


let ohlp = {};
function describeToken(token) {
  if (/^-/.test(String(token))) {
    return {
      cmd: null,
      type: "aus",
      disabled: true,
      label: "aus: dieser Block wird vom Parser ignoriert"
    };
  }

  // 1. Korpusname (erstes Token, einzelnes Wort)
  // if (/^[a-z]$/.test(token) && token.length < 3) {
  //   return { type: "corpus", label: "Korpusname, z.B. b, b1 oder b.a1" };
  // }

  // 2. Parts (beginnt mit P oder nur Buchstaben)
  if (/^p/i.test(token)) {
    return { 
      cmd: "p",
      type: "parts", label: `Teile: zuerst genannte laufen  durch,
      pr- = re. Seite weg, pf1 = Front an Pos. 1 hinzufg.` };
  }

  // 3. Maße: Zahl,Zahl,Zahl
  if (/^\d+,\d+,\d+$/.test(token)) {
    return { type: "size", 
      cmd: "a",
      
      label: "Breite,Tiefe,Höhe" };
  }

  // 4. Material (MB, ML, MR …)
  if (/^m/i.test(token)) {
    const map = {
      mb: "Material Rückwand",
      ml: "Material links",
      mr: "Material rechts",
      mt: "Material Deckel",
      mg: "Material Boden"
    };
    const key = token.slice(0, 2).toLowerCase();
    return {
      type: "material",
      cmd: "m",
      label: map[key] || "Material"
    };
  }

  // 5. Split
  if (/^s/i.test(token)) {
    return { 
      cmd: "s",
      
      type: "split", label: "Split: <Teile><Richtung><Zahl> z.B. sfx2=Front in 2 Teile." };
  }

  // 6. Push / Pull
  if (/^u/i.test(token)) {
    return { 
      cmd: "u",
      
      type: "pushpull", label: "Push / Pull" };
  }

  // Fallback
  return { type: "unknown", label: "Unbekannt" };
}




function openHelpMenu() {
  toggleMenu("mdBox")
  document.getElementById("helpToggle").checked = true;
  showHelp();
}



function showHelpCommand(mark) {
  toggleMenu("mdBox")
  const box = document.getElementById("mdBox");
  const block = ohlp[mark];
  if (!block) return;
  showMark(mark)
}


async function loadHelp() {
  const res = await fetch("./views/pages/commands.md");
  const md  = await res.text();
  parseJumpMarkdown(md);
  console.log(ohlp)
}

// const box = document.getElementById("mdBox");

function showMark(mark) {
  const b = ohlp[mark];
  if (!b) {
    box.innerHTML = `<em>${stt("ui.noHelp", "Keine Hilfe vorhanden.")}</em>`;
    box.style.display = "block";
    return;
  }

  box.innerHTML = renderMarkdown(b.text);
  box.style.display = "block";
}


function parseJumpMarkdown(md) {
  const lines = md.split("\n");
  const blocks = [];

  let current = null;
  let i=0
  for (let line of lines) {
    const m = line.match(/^# (\w+)/);
    
    if (m) {
      let mm=line.split(" ")
      current=mm[1]
      ohlp[mm[1]] = { cmd: mm[1],nme:mm[2], text: "" };
    } else if (ohlp[current]) {
      ohlp[current].text += line + "\n";
    }
  }

  // if (current) blocks.push(current);
  // return blocks;
}


function renderMarkdown(md) {
  return md
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

const box = document.getElementById("mdBox");
let i = 0;

function showBlock(blocks) {
  if (i >= blocks.length) return;

  box.innerHTML = renderMarkdown(blocks[i].text);
  box.style.display = "block";
  i++;
}
function showHelp() {
  const box = document.getElementById("mdBox");
toggleMenu("mdBox")
  box.innerHTML = `
    <div class="help-title">${stt("ui.helpCommands", "Hilfe - Kommandos")}</div>
    ${ohlp.map(b => `
      <button class="help-item"
              onclick="showHelpCommand('${b.mark}')">
        ${b.mark}
      </button>
    `).join("")}
  `;
}



function renderHelpList(blocks) {
  window.showHelpCommand=showHelpCommand
  window.showHelp=showHelp
  return `
    <div class="help-list">
      <div class="help-title">${stt("ui.helpCommands", "Hilfe - Kommandos")}</div>
      ${blocks.map(b => `
        <button class="help-item" onclick="showHelpCommand('${b.mark}')">
          ${b.mark}
        </button>
      `).join("")}
    </div>
  `;
}




const STATES = {

  main: {
    slot1: "canvas",
    slot2: "lineButtons",
    btn: topToolbarButtons,
    buttons: []
  },

inn: {
    slot1: "canvas",
    slot2: "inn",
    btn: topToolbarButtons,
    buttons: []
  },

gallery: {
  slot1: "galleryView",
  slot2: null,
  buttons: [
    { label:"zurück", labelKey: "ui.back", to:"main" }
  ]
},
tree: {
  slot1: "canvas",
  slot2: "treeView",
  btn: [],
  buttons: [
    { label: "zurück", labelKey: "ui.back", to: "main" },
    { label: "X", action: () => setTreeViewDirection("x") },
    { label: "Y", action: () => setTreeViewDirection("y") },
    { label: "Z", action: () => setTreeViewDirection("z") },
    { label: "Maße", action: () => setTreeViewMode("dim") },
    { label: "reload (rctrl)", action: renderKorpusTreeView }
  ]
},
templates: {
  slot1: "templates",
  slot2: null,
  btn: [
    { label: "zurück", labelKey: "ui.back", to: "main" }
  ],
  buttons: []
},

  file: {
    slot1: "filepic",
    slot2: null,
    btn: [],

    buttons: [
      { label: "back", labelKey: "ui.back", to: "main" },
    ]
  },
  help: {
    slot1: "helpText",
    slot2: "inn",
    btn: [],

    buttons: [
      { label: "back", labelKey: "ui.back", to: "main" },
    ]
  },

  wood: {
    slot1: "woodOverview",
    slot2: null,
    btn: [],
    buttons: [
      { label: "back", labelKey: "ui.back", to: "main" },
      { label: "exp all",   action: downloadHolzlisteS },
      { label: "print", labelKey: "ui.print", action: printHolzliste },

    { label: "report", labelKey: "ui.report", action: projectReport }
    ]
  },





projectedit: {
  slot1: "projectEdit",
  slot2: "",
  btn: [],
  buttons: [
    { label: "←", to: "main" }
  ]
},


  // ✅ NEU: Project-Editor als eigener Modus
projectedi: {
  slot1: "projectEditor",
  slot2: null,

  btn: [
    { label: "cancel", labelKey: "ui.cancel", action: pp.closeProjectEditor },
    { label: "save", labelKey: "ui.save", action: pp.saveProjectEditor },
  ],

  buttons: [
    { label: "cancel", labelKey: "ui.cancel", action: pp.closeProjectEditor },
    { label: "save", labelKey: "ui.save", action: pp.saveProjectEditor },
  ]
}

};


function createColorPicker(current) {

  const wrap = document.createElement("div");
  wrap.className = "color-picker";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "color-btn";
  wrap.appendChild(btn);

  const menu = document.createElement("div");
  menu.className = "color-menu hidden";
  wrap.appendChild(menu);

  // Menü füllen
  Object.entries(window.colors || {}).forEach(([key, val]) => {

    const item = document.createElement("div");
    item.className = "color-item";

    const sw = document.createElement("span");
    sw.className = "color-swatch";
    sw.style.background = val.css;

    const label = document.createElement("span");
    label.textContent = key;

    item.append(sw, label);

    item.onclick = () => {
      btn.dataset.value = key;
      btn.style.background = val.css;
      menu.classList.add("hidden");
    };

    menu.appendChild(item);
  });

  // aktueller Wert
  if (current && window.colors[current]) {
    btn.dataset.value = current;
    btn.style.background = window.colors[current].css;
  }

  btn.onclick = () => {
    menu.classList.toggle("hidden");
  };

  return wrap;
}


function parseProjectHeader2(line) {

  const parts = line.split(/\s+/);

  const dims = parts[1].split(",");

  const vars = {
    W: Number(dims[0]),
    D: Number(dims[1]),
    H: Number(dims[2])
  };

  const box = parts.find(p => p.startsWith("box"));

  if (box) {

    const spec = box.slice(3).split(",");

    const w = spec[0].split("_");
    const h = spec[2].split("_");

    vars.box = {
      wmin: Number(w[0]),
      wmax: Number(w[1]),
      d: spec[1] === "D" ? vars.D : Number(spec[1]),
      hmin: Number(h[0]),
      hmax: Number(h[1])
    };

  }

  return vars;
}



function fillWidth(vars) {

  const res = [];
  let rest = vars.W;

  while (rest > vars.box.wmin) {

    const max = Math.min(vars.box.wmax, rest);

    const w = rand(vars.box.wmin, max);

    res.push({
      w,
      d: vars.box.d,
      h: rand(vars.box.hmin, vars.box.hmax)
    });

    rest -= w;
  }

  return res;
}





/* ======================================================
   URL / HISTORY
   ====================================================== */

function updateURL(text){

    const url=new URL(location)

    url.searchParams.set("t",encodeURIComponent(text))

    history.pushState({inn:text},"",url)
}



/* ======================================================
   HISTORY BACK SUPPORT
   ====================================================== */

window.addEventListener("popstate",e=>{

    if(e.state && e.state.inn){

        document.getElementById("inn").value=e.state.inn

        renderProject()

    }

})



/* ======================================================
   RENDER
   ====================================================== */

function renderProject(){

    const ta=document.getElementById("inn")

    if(typeof Proj==="function"){

        window.PR=new Proj(ta.value)

    }

}

function openProjectEditor() {

  const host = document.getElementById("projectEdit");
  if (!host) return;

  host.innerHTML = "";

  const ta = document.getElementById("inn");

  window.PR = new Proj(ta.value);

  const firstLine = PR.inn.split("\n")[0];
  const parsed = parseProjectLine(firstLine);

  const form = document.createElement("form");
  form.id = "projectEditForm";

  form.addEventListener("submit", e => {
    e.preventDefault();
    saveProjectEdit();
  });

  /* ---------- PROJEKTNAME ---------- */

  const rowName = document.createElement("div");
  rowName.className = "row";

  const labelName = document.createElement("label");
  labelName.textContent = "Projektname";

  const wrapName = document.createElement("div");
  wrapName.className = "field-wrap";

  const nameInput = document.createElement("input");
  nameInput.id = "proj-name";
  nameInput.value = firstLine.split(" ")[0];

  wrapName.appendChild(nameInput);

  rowName.appendChild(labelName);
  rowName.appendChild(wrapName);

  form.appendChild(rowName);

  /* ---------- MATERIALIEN ---------- */

  projectState.materials.forEach((mat, i) => {

    const row = document.createElement("div");
    row.className = "row material-box";

    const label = document.createElement("label");
    label.textContent = "Material " + (i + 1);

    const wrap = document.createElement("div");
    wrap.className = "field-wrap";

    const s = document.createElement("input");
    s.type = "number";
    s.className = "mat-s";
    s.value = mat.s;

    const picker = createColorPicker(mat.co);
    picker.classList.add("mat-co");

    const p = document.createElement("input");
    p.type = "number";
    p.step = "0.01";
    p.className = "mat-p";
    p.value = mat.p;

    const pu = document.createElement("input");
    pu.type = "number";
    pu.step = "0.01";
    pu.className = "mat-pu";
    pu.value = mat.pu;

    wrap.append("s ", s, " ", picker, " p ", p, " pu ", pu);

    row.appendChild(label);
    row.appendChild(wrap);

    form.appendChild(row);
  });

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.style.display = "none";

  form.appendChild(submit);

  host.appendChild(form);
}

function renderProjectEdit() {
return renderProjectEdit11111();
}
function renderProjectEdit11111() {
window.PR=new Proj(document.getElementById("inn").value)
  const container = document.createElement("div");
  container.style.padding = "20px";
  // Erste Zeile holen
  const firstLine = window.PR.inn.split("\n")[0];
  const parsed = parseProjectLine(firstLine);

  // ---------- Projektname ----------
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Projektname";

  const nameInput = document.createElement("input");
  nameInput.value = firstLine.split(" ")[0];

  container.append(nameLabel, nameInput);

  // ---------- Materialien ----------
projectState.materials.forEach(mat => {

    const box = document.createElement("div");
    box.className = "rowfl material-box";
    box.style.marginTop = "20px";

    // Stärke
    const s = document.createElement("input");
    s.type = "number";
    s.className="mat-s"
    s.value = mat.s;
    
    // Farbe
    const picker = createColorPicker(mat.co);
picker.classList.add("mat-co");
    // Preis
    const p = document.createElement("input");
    p.type = "number";
    p.step = "0.01";
    p.className="mat-p"
    p.value = mat.p;

    // Preis
    const puu = document.createElement("input");
    const br = document.createElement("br");
    puu.type = "number";
    puu.step = "0.01";
    puu.className="mat-pu"
    puu.value = mat.pu;
    box.append("Stärke ", s,);
    box.append(br);
    box.append("Farbe ", picker, " Preis ", p, "PreisUml", puu);
    container.appendChild(box);
  });

  // ---------- Speichern Button ----------
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Speichern";


saveBtn.onclick = () => {

  const mats = [];

  container.querySelectorAll(".material-box").forEach(box => {

    const s  = box.querySelector(".mat-s").value;
    const c  = box.querySelector(".mat-co .color-btn")?.dataset.value || "";
    const p  = box.querySelector(".mat-p").value;
    const pu = box.querySelector(".mat-pu").value;

    const values = [s, c || "white"];
    if (p || pu) values.push(p || "0");
    if (pu) values.push(pu);

    const m = "mat." + values.join(",");

    mats.push(m);
  });

  const newHeader = nameInput.value + " " + mats.join(" ");

  const ta = document.getElementById("inn");
  const lines = ta.value.split("\n");

  lines[0] = newHeader;

  ta.value = lines.join("\n");

  recordReloadHistory();
  updateAndReloadURL();
};




  container.appendChild(document.createElement("br"));
  container.appendChild(saveBtn);

  return container;
}


function parseProjectHeader(line) {

  const parts = line.trim().split(/\s+/);
  const name = parts[0];

  const materials = [];

  for (let i = 1; i < parts.length; i++) {

    const m = parts[i];
    if (!m.startsWith("m")) continue;

    const strength = m.match(/^m(\d+)/)?.[1] || "";
    const color = m.match(/[a-z]{2}/);
    const price = m.match(/[0-9,.]+/)
    let p=""
    let pu=""
    if(/[,]/.test(price)) { 
 const nums = price.split(",");
      p  = Number(nums[0] || 0);
       pu = Number(nums[1] || 0);
     }else{ p=price }

    materials.push({ strength, color, p, pu });
  }

  return { name, materials };
}
function initColorSelect(sel) {
  sel.innerHTML = "";

  for (const key in (window.colors || {})) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = window.colors[key].de;
    sel.appendChild(opt);
  }
}

const ACTIONS = {

  main: [
     { label: "☰", action: toggleHelpMenu },
      { label: "Battenholz", action: () => setState("wood") },
      { label: "holz", labelKey: "ui.wood", to: "wood" },
      { label: "Hilfe", action: toggleQuickHelpOverlay },
          // { label: "open",   action: openDWGPicker }, // ✅ HIER
      { label: "redraw",  action: onRenderClicked },
      // { label: "save",   action: downloadHolzliste }
  ],

  help: [
     // { label: "hoch",   action: helpUp },
      // { label: "runter", action: helpDown },
      { label: "zurück", labelKey: "ui.back", to: "main" },
      // { label: "mehr",   action: openHelp },
      null
  ],
 blockedi: [
     // { label: "hoch",   action: helpUp },
      // { label: "runter", action: helpDown },
      { label: "cancel", labelKey: "ui.cancel", to: "main" },
      { label: "save", labelKey: "ui.save", action: saveBlockEdit },
      // { label: "mehr",   action: openHelp },
      null
  ],
  wood: [
   // { label: "hoch",   action: openHelp },
      // { label: "runter", action: openHelp },
      { label: "zurück", labelKey: "ui.back", to: "main" },
      { label: "download", action: downloadHolzliste },
{
  label: "drucken",
  labelKey: "ui.print",
  action: printHolzliste
},
      null
  ]
};


/* =========================================================
   MATERIAL-ZEILE
========================================================= */
function createMaterialRow(idx) {

  const row = document.createElement("div");
  row.className = "row mat-row";
  row.dataset.idx = idx;

  row.innerHTML = `
    <span class="mat-prefix">M</span>

    <input class="mat-s" type="number" step="0.1" />

    <select class="mat-co"></select>

    <div class="mat-preview"></div>

    <input class="mat-p xx" type="number" step="0.01" />
    <input class="mat-pu" type="number" step="0.01" />
  `;

  // Farben ins Select
  initColorSelect(row.querySelector(".mat-co"));

  return row;
}

/* =========================================================
   STATE ↔ UI
========================================================= */
function bindMaterialRow(row) {

  const idx = Number(row.dataset.idx);

  const s  = row.querySelector(".mat-s");
  const co = row.querySelector(".mat-co");
  const pv = row.querySelector(".mat-preview");
  const p  = row.querySelector(".mat-p");
  const pu = row.querySelector(".mat-pu");

  // 🔒 Sicherheitsnetz (sehr wichtig beim Umbau)
  if (!s || !co || !pv || !p || !pu) {
    console.warn("bindMaterialRow: element fehlt", {
      s, co, pv, p, pu
    });
    return;
  }

  // ------------------------------------------------
  // 🔁 SYNC muss VOR Event-Registrierung existieren
  // ------------------------------------------------
  function sync() {
  const rawCo  = co.value;
  const normCo = normalizeColorKey(rawCo);

  if (rawCo !== normCo) {
    co.value = normCo;
  }

  if (colors[normCo]) {
    pv.style.background = colors[normCo].css;
    updateColorSelectStyle(co);
  }

  projectState.materials[idx] = {
    s:  Number(s.value || 0),
    co: normCo,
    p:  Number(p.value || 0),
    pu: Number(pu.value || 0)
  };
}


  // ------------------------------------------------
  // 🔔 EVENTS
  // ------------------------------------------------
  [s, p, pu].forEach(el =>
    el.addEventListener("input", sync)
  );

  co.addEventListener("input", sync);
  co.addEventListener("change", sync);

  // ------------------------------------------------
  // 🔁 Initialer Sync
  // ------------------------------------------------
  sync();
}


function normalizeColorKey(k) {
  if (!k) return "white";
  if (colors[k]) return k;

  const map = {
    w: "white",
    wh: "white",
    b: "cornflowerblue",
    bl: "cornflowerblue",
    bt: "wheat",
    r: "indianred",
    ro: "indianred",
    g: "gray",
    gr: "gray"
  };

  return map[k] || k;
}




//  function sync() {
//   const li = Number(l.value);
//   const lk = ABC[li];

//   // 🔧 Farbe normalisieren
//   const rawCo = co.value;
//   const normCo = normalizeColorKey(rawCo);

//   // Select ggf. korrigieren
//   if (normCo !== rawCo) {
//     co.value = normCo;
//   }

//   lb.textContent = lk;

//   // 🔐 Guard: Farbe existiert wirklich
//   if (colors[normCo]) {
//     pv.style.background = applyLight(colors[normCo].css, li);
//     updateColorSelectStyle(co);
//   }

//   projectState.materials[idx] = {
//     s:  Number(s.value || 0),
//     co: normCo,
//     l:  lk,
//     p:  Number(p.value || 0),
//     pu: Number(pu.value || 0)
//   };
// }






function parseProjectLine(line) {

  projectState.materials.length = 0;
  projectState.name = "";
  projectState.options = {};

  if (!line) return;
  line = line.trim();

  // -------------------------
  // Projektname (bis erstes m/M)
  // -------------------------
  const nameMatch = line.match(/^[^\sMm]+/);
  if (nameMatch) {
    projectState.name = nameMatch[0];
  }

  const gapRe = /\b(x[xyz])(?:\s*[=:])?\s*(-?\d+(?:\.\d+)?)/gi;
  let gap;
  while ((gap = gapRe.exec(line)) !== null) {
    projectState.options[gap[1].toLowerCase()] = Number(gap[2]);
  }

  // -------------------------
  // Materialien:
  // neu: mat.<staerke>,<farbe>,<preis>,<kantenpreis>
  // alt: m<staerke><farbe><helligkeit?><preis?,pu?>, Helligkeit wird verworfen
  // -------------------------
  const modernRe = /\b(?:m|mat)\.([\d.]+),([a-zäöüß_-][a-z0-9äöüß_-]*)(?:,([\d.]+))?(?:,([\d.]+))?/gi;
  let m;

  while ((m = modernRe.exec(line)) !== null) {
    const s = Number(m[1]);
    const co = normalizeColorKey(m[2]);

    projectState.materials.push({
      s,
      co,
      p: Number(m[3] || 0),
      pu: Number(m[4] || 0)
    });
  }

  const re = /[mM]([\d.]+)([a-z]{1,2})([a-z])?([\d.,]*)/g;

  while ((m = re.exec(line)) !== null) {

    const s  = Number(m[1]);
    const co = m[2];

    let p = 0, pu = 0;
    if (m[4]) {
      const nums = m[4].split(",");
      p  = Number(nums[0] || 0);
      pu = Number(nums[1] || 0);
    }

    projectState.materials.push({ s, co: normalizeColorKey(co), p, pu });
  }
}





export function openProjectEditorFromLine(line) {

  // 1) Text → State
  parseProjectLine(line);
console.log(JSON.stringify(projectState, null, 2));
  // 2) Formularfelder setzen
  document.getElementById("projName").value = projectState.name;

  // 3) State → UI
  pp.renderProjectEditor(projectState);

  // 4) Mode setzen
  pp.openProjectEditor();
}


function addMaterial() {
  projectState.materials.push({
    s:0, co:Object.keys(colors)[0] || "white", p:0, pu:0
  });
  renderProjectEditor();
}


function syncMaterialRow(row) {
  row.querySelectorAll("input,select").forEach(el =>
    el.dispatchEvent(new Event("input"))
  );
}



function closeProjectEditor() {
  setState("main");

  const pe = document.getElementById("projectEditor");
  pe.style.display = "none";
}

function saveProjectEdit() {

  const mats = [];

  document.querySelectorAll(".material-box").forEach(box => {

    const s  = box.querySelector(".mat-s").value;
    const c  = box.querySelector(".mat-co .color-btn")?.dataset.value || "";
    const p  = box.querySelector(".mat-p").value;
    const pu = box.querySelector(".mat-pu").value;

    let m = "m" + s;
    if (c) m += c;
    if (p) m += p;
    if (pu) m += "," + pu;

    mats.push(m);
  });

  const name = document.getElementById("proj-name").value;

  const opts = ["xx", "xy", "xz"]
    .map(key => {
      const value = projectState.options?.[key];
      return Number.isFinite(value) && value !== 0 ? key + value : "";
    })
    .filter(Boolean);

  const newHeader = [name, ...opts, ...mats].filter(Boolean).join(" ");

  const ta = document.getElementById("inn");
  const lines = ta.value.split("\n");

  lines[0] = newHeader;

  ta.value = lines.join("\n");

  recordReloadHistory();
  updateAndReloadURL();
}


function setActions(state) {
  const defs  = ACTIONS[state] || [];
  const cells = document.querySelectorAll("#slot3 .cell");

  cells.forEach((cell, i) => {
    const d = defs[i];

    if (!d) {
      cell.textContent = "";
      cell.onclick = null;
      cell.style.visibility = "hidden";
      return;
    }

    cell.textContent = d.labelKey ? stt(d.labelKey, d.label) : d.label;
    cell.style.visibility = "visible";

    cell.onclick = d.to
      ? () => setState(d.to)
      : d.action || null;
  });
}

function saveViaNode(project, value) {
  const img = new Image();
  img.src =
    "/save-url" +
    "?project=" + encodeURIComponent(project || "projekt") +
    "&data=" + encodeURIComponent(value) +
    "&t=" + Date.now(); // Cache-Buster
}


function saveCurrentUrlToServer_noFetch() {
  const form = document.getElementById("dwgUrlForm");
  if (!form) return;

  form.projectName.value = (window.PR?.nme || "projekt");
  form.url.value = window.location.href.split("#")[0];

  form.submit();   // 🔥 DAS ist der entscheidende Punkt
}

// Block Editor entfernt - nicht mehr benötigt



function bootState() {

  const url = new URL(location.href);

  // ✅ Wenn DSL-URL vorhanden → INN bevorzugen
  if (url.searchParams.size > 0) {
    setState("inn");
    return;
  }

  // ✅ Sonst zuletzt gespeicherten State holen, Texteditor ist Standard
  const saved = localStorage.getItem("c3cad_state");
  const cur = saved && saved !== "main" && saved !== "blockedi" ? saved : "inn";
  setState(cur);
}

// document.addEventListener("DOMContentLoaded", () => {
//   bootState();
// });

function lineNumberFromTextareaSelection(ta) {
  const pos = Number(ta?.selectionStart || 0);
  return String(ta?.value || "").slice(0, pos).split(/\r?\n/).length;
}

function lineNumberFromError(err) {
  const direct = err?.line || err?.lineNumber || err?.data?.line || err?.data?.lineNumber;
  if (Number(direct) > 0) return Number(direct);

  const text = [
    err?.message,
    err?.data?.error,
    err?.data?.stack,
    err?.stack
  ].filter(Boolean).join("\n");
  const match = text.match(/\b(?:line|zeile)\s*:?\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function tokenFromError(err) {
  return err?.token || err?.data?.token || err?.details?.token || "";
}

function firstLikelySyntaxLine(inn, err, ta) {
  const fromError = lineNumberFromError(err);
  if (fromError) return fromError;

  const lines = String(inn || "").split(/\r?\n/);
  const suspicious = [
    /\.[a-z]{3}\.$/i,
    /(?:^|\s)(?:cut|teilen|tei|dre|reihe|wid|copy|kop|dock|verbinden|vbn|connect|con|sta|aus|zen|push)\.$/i,
    /(?:^|\s)(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.$/i,
    /(?:^|\s)(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.[a-z]{3}\.$/i,
    /(?:^|\s)(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:cut|teilen|tei|dre)\.[^xyz\s]/i,
    /(?:^|\s)(?:reihe|wid|copy|kop|dre)\.[^xyz\s]/i
  ];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && suspicious.some(re => re.test(line))) return i + 1;
  }

  return Math.min(Math.max(lineNumberFromTextareaSelection(ta), 1), Math.max(lines.length, 1));
}

function friendlyProjectErrorMessage(err) {
  const message = err?.message || String(err || "");
  if (/Invalid or unexpected token/i.test(message)) {
    return "Ungültiger Ausdruck: Bitte Zahlen, Kommas, Punkte und Klammern in dieser Zeile prüfen.";
  }
  return message || "Syntaxfehler";
}

function showInnProjectError(inn, err) {
  const ta = document.getElementById("inn");
  if (ta && inn != null) ta.value = String(inn);

  const line = firstLikelySyntaxLine(inn || ta?.value || "", err, ta);
  const message = friendlyProjectErrorMessage(err);
  const token = tokenFromError(err);
  window.pendingInnSyntaxError = { line, message, token };
  setState("inn");
  window.syncInnEditorFromTextarea?.();
  window.setInnSyntaxError?.(line, message, token);
}



async function applyInnTextChanges() {
  const ta = document.getElementById("inn");
  if (!ta) return true;

  const inn = convertLegacyToModern(ta.value);
  if (inn !== ta.value) {
    ta.value = inn;
    window.syncInnEditorFromTextarea?.();
  }

  try {
    window.PR = await new Proj(inn).getall();
    window.PR.inn = inn;
    await validateProjectPartLimit(window.PR);
    history.replaceState({ inn }, "", innToUrl(inn));

    if (typeof window.magie === "function") {
      await window.magie(window.PR);
    } else {
      window.renderLineButtonsFromInn?.();
    }

    updateToolbarStatus();
    window.clearInnSyntaxError?.();
    return true;
  } catch (err) {
    console.error("Textmodus konnte nicht angewendet werden:", err);
    if (err?.name === "ProjectPartLimitError") {
      showInnProjectError(inn, err);
      setState("inn");
      return false;
    }
    const line = firstLikelySyntaxLine(inn, err, ta);
    window.setInnSyntaxError?.(line, friendlyProjectErrorMessage(err), tokenFromError(err));
    setState("inn");
    return false;
  }
}

async function convertInnTextToModern() {
  const ta = document.getElementById("inn");
  if (!ta) return;

  const next = convertLegacyToModern(ta.value);
  if (next === ta.value) return;

  ta.value = next;
  window.syncInnEditorFromTextarea?.();
  await applyInnTextChanges();
}

async function toggleInnMain() {

  // aktuellen State aus localStorage lesen
  const cur = window.CURRENT_STATE || localStorage.getItem("c3cad_state") || "inn";

  const next = (cur === "inn") ? "main" : "inn";

  if (cur === "inn" && !await applyInnTextChanges()) return;

  // State wechseln
  setState(next);

  // optional direkt speichern (falls setState es nicht selbst macht)
  localStorage.setItem("c3cad_state", next);
}

function setState(name) {

  
  if (!STATES[name]) {
    console.warn("Unknown state:", name);
    return;
  }

  const prevState = window.CURRENT_STATE;
  CURRENT_STATE = name;
  window.CURRENT_STATE = name;
  document.body.dataset.state = name;

  // ✅ merken
  // localStorage.setItem("c3cad_state", name);

  const cfg = STATES[name];
  if (!cfg) return;
setActions(name);

  document.querySelectorAll(".view")
    .forEach(v => v.style.display = "none");

if (cfg.slot1)  document.getElementById(cfg.slot1).style.display = "block";
if (cfg.slot2) {
  document.getElementById(cfg.slot2).style.display = "block";
}else{ 
  // document.getElementById(cfg.slot2).style.display = "none";

}

if (cfg.slot2 === "inn") {
  window.showInnEditor?.();
} else {
  window.hideInnEditor?.();
}

  setButtons(cfg.btn, "slot0")
  setButtons(cfg.buttons)

  if (name === "projectedit") {

  const slot = document.getElementById("projectEdit");
  slot.innerHTML = "";

  const ui = renderProjectEdit();
  slot.appendChild(ui);
}

  if (name === "help") {
    loadHelpMD();
  }

  if (name   === "templates") {
  renderTemplatesFromMD();
}

  if (name === "wood") {
  renderHolzlisteReport(window.PR);
}

  if (name === "tree") {
  renderKorpusTreeView();
}

  if (prevState === "tree" && name !== "tree") {
  window.restoreKorpusPerspectiveRender?.();
}

  if (name === "blockedi") {
  renderHolzliste(window.PR);
}

  requestAnimationFrame(positionQuickHelpOverlay);



  window.currentState = name;
}


async function renderTemplatesFromMD() {

  const slot = document.getElementById("slot1");
  slot.innerHTML = "Lade Vorlagen...";

  const res = await fetch("/example.md");
  const md = await res.text();

  slot.innerHTML = "";

  // Regex: [Name](Link)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(md)) !== null) {

    const name = match[1];
    const url  = match[2];

    const link = document.createElement("a");
    link.textContent = name;
    link.href = url;
    link.style.display = "block";
    link.style.padding = "6px 0";

    slot.appendChild(link);
  }
}

const EDIT_HISTORY_MAX = 23;
const EDIT_HISTORY_KEY = "c3cad.editHistory";
let editHistory = [];
let editHistoryIndex = 0;
let editHistoryApplying = false;
let editHistoryTimer = null;
let visitorCounterText = "--";
let editHistoryRendering = false;

function getInnValue() {
  return document.getElementById("inn")?.value || "";
}

function currentProjectHistoryUrl() {
  const inn = getInnValue();
  return inn ? innToUrl(inn) : location.href.split("#")[0];
}

function normalizeHistoryUrl(value) {
  const raw = String(value || "");
  if (!raw || /\s/.test(raw)) return "";

  try {
    return new URL(raw, location.href).toString();
  } catch {
    return "";
  }
}

function storeEditHistory() {
  sessionStorage.setItem(EDIT_HISTORY_KEY, JSON.stringify({
    index: editHistoryIndex,
    items: editHistory
  }));
}

function restoreEditHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(EDIT_HISTORY_KEY) || "null");
    if (saved?.items?.length) {
      editHistory = saved.items
        .map(normalizeHistoryUrl)
        .filter(Boolean);
      editHistoryIndex = Math.min(saved.index || 0, editHistory.length - 1);
      if (editHistory.length) return;
    }
  } catch {}

  editHistory = [currentProjectHistoryUrl()];
  editHistoryIndex = 0;
  storeEditHistory();
}

function recordEditHistory() {
  if (editHistoryApplying) return;

  const value = currentProjectHistoryUrl();
  if (editHistory.length === 1 && !editHistory[0] && value) {
    editHistory[0] = value;
    editHistoryIndex = 0;
    storeEditHistory();
    updateToolbarStatus();
    return;
  }

  if (editHistory[editHistoryIndex] === value) {
    updateToolbarStatus();
    return;
  }

  editHistory = editHistory.slice(0, editHistoryIndex + 1);
  editHistory.push(value);

  if (editHistory.length > EDIT_HISTORY_MAX) {
    editHistory.shift();
  }

  editHistoryIndex = editHistory.length - 1;
  storeEditHistory();
  updateToolbarStatus();
}

function queueEditHistoryRecord() {
  clearTimeout(editHistoryTimer);
  editHistoryTimer = setTimeout(recordEditHistory, 500);
}

function syncEditHistoryToCurrent() {
  clearTimeout(editHistoryTimer);
  const value = currentProjectHistoryUrl();

  if (!editHistory.length) {
    editHistory = [value];
    editHistoryIndex = 0;
  } else {
    editHistory[editHistoryIndex] = value;
  }

  storeEditHistory();
  updateToolbarStatus();
}

function recordReloadHistory() {
  clearTimeout(editHistoryTimer);
  recordEditHistory();
}

async function applyEditHistoryIndex(index) {
  if (editHistoryRendering || index < 0 || index >= editHistory.length) return;

  const url = normalizeHistoryUrl(editHistory[index]);
  if (!url) return;

  editHistoryRendering = true;
  editHistoryApplying = true;
  editHistoryIndex = index;
  storeEditHistory();
  updateToolbarStatus();

  location.href = url;
}

function undoProjectText() {
  applyEditHistoryIndex(editHistoryIndex - 1);
}

function redoProjectText() {
  applyEditHistoryIndex(editHistoryIndex + 1);
}

function undoStepCount() {
  return Math.max(0, editHistoryIndex);
}

function redoStepCount() {
  return Math.max(0, editHistory.length - 1 - editHistoryIndex);
}

function currentLanguageCode() {
  return String(window.ST_LANG || document.documentElement.lang || "de").slice(0, 2).toUpperCase();
}

function currentProjectPriceText() {
  const value = Number(window.PR?.eur);
  if (!Number.isFinite(value)) return "--";
  return String(Math.round(value));
}

function currentProjectPartsText() {
  const pr = window.PR;
  if (!isReadyPR(pr)) return "-- Teile";

  const hit = pr.partLimitExceeded;
  if (hit) {
    const count = Number(hit.count || countProjectParts(pr) || 0);
    const limit = Number(hit.limit || count || 0);
    const rendered = Number(hit.rendered || limit || 0);
    const edgeOnly = Number(hit.edgeOnly || 0);
    return edgeOnly > 0
      ? `${rendered}+${edgeOnly} Kanten/${count} Teile`
      : `${rendered}/${count} Teile`;
  }

  return `${countProjectParts(pr)} Teile`;
}

function toolbarStatusText() {
  return `${visitorCounterText} | ${currentLanguageCode()} | ${currentProjectPartsText()} | ${currentProjectPriceText()}`;
}

function updateToolbarStatus() {
  const status = document.getElementById("toolbarStatus");
  if (status) status.textContent = toolbarStatusText();

  const topStatus = document.getElementById("topStatus");
  if (topStatus) {
    topStatus.innerHTML = `<a class="top-status-home" href="/">3dfg</a><span>${toolbarStatusText()}</span>`;
  }

  const undo = document.getElementById("toolbarUndo");
  if (undo) {
    undo.textContent = `< ${undoStepCount()}`;
    undo.disabled = editHistoryRendering || undoStepCount() <= 0;
  }

  const redo = document.getElementById("toolbarRedo");
  if (redo) {
    redo.textContent = `${redoStepCount()} >`;
    redo.disabled = editHistoryRendering || redoStepCount() <= 0;
  }
}

function topToolbarButtons() {
  return [
    { label: "☰", action: toggleHelpMenu },
    { labelKey: "ui.share", label: "📤 Teilen", titleKey: "ui.shareTooltip", title: "Projekt-Link per E-Mail senden", action: shareProjectByMail },
    { label: "Hilfe", labelKey: "ui.help", action: toggleQuickHelpOverlay },
    { label: "Baum", label: "Baum", to: "tree" },
    { label: "Holz", label: "Holz", to: "wood" }
  ];
}

function setButtons(defs, nuu="slot3") {
  if (typeof defs === "function") defs = defs();
  const slot = document.getElementById(nuu);
  slot.innerHTML = "";

  (defs || []).forEach(d => {
    if (d?.kind === "status") {
      const status = document.createElement("div");
      status.id = d.id || "";
      status.className = "toolbar-status";
      status.textContent = toolbarStatusText();
      slot.appendChild(status);
      return;
    }

    const btn = document.createElement("button");
    if (d.id) btn.id = d.id;
    btn.textContent = d.labelKey ? stt(d.labelKey, d.label) : d.label;
    btn.title = d.titleKey ? stt(d.titleKey, d.title) : (d.title || "");
    btn.onclick = d.to
      ? () => setState(d.to)
      : d.action || null;
    slot.appendChild(btn);
  });

  updateToolbarStatus();
}

function treeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function treeFmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.round(n * 10) / 10;
}

function treeFmtMm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.round(n * 10);
}

function treeEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function treeNodeLetter(index) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index % 26];
}

function getKorpusTreeGroups(pr) {
  const nodes = Object.values(pr?.oks || {})
    .filter(k => k?.nme)
    .map(k => ({
      key: k.nme,
      letter: "",
      items: [k],
      xLocal: treeNum(k.x),
      yLocal: treeNum(k.y),
      x: null,
      y: null,
      parentName: k.tar?.[0] || ""
    }));

  const byName = new Map(nodes.map(node => [node.key, node]));

  function place(node, stack = new Set()) {
    if (!node || node.x !== null) return;

    const parent = byName.get(node.parentName);
    if (!parent || parent === node || stack.has(node.key)) {
      node.x = node.xLocal;
      node.y = node.yLocal;
      return;
    }

    stack.add(node.key);
    place(parent, stack);
    stack.delete(node.key);

    node.x = treeNum(parent.x) + node.xLocal;
    node.y = treeNum(parent.y) + node.yLocal;
  }

  nodes.forEach(node => place(node));

  const list = nodes.sort((a, b) => a.y - b.y || a.x - b.x || a.key.localeCompare(b.key));

  list.forEach((group, index) => {
    group.letter = treeNodeLetter(index);
  });

  list.byName = byName;
  return list;
}

function getTreeEdges(groups) {
  const byName = groups.byName || new Map();
  const seen = new Set();
  const edges = [];

  for (const group of groups) {
    const parent = byName.get(group.parentName);
    if (!parent || parent === group) continue;
    const key = parent.key + ">" + group.key;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: parent.key, to: group.key });
  }

  return edges;
}

function getTreeAlignedDistances(groups) {
  const EPS = 1;
  const out = [];
  const seen = new Set();
  const seenValue = new Set();

  const bucketKey = value => String(Math.round(treeNum(value) / EPS));

  function addAdjacent(list, axis) {
    const sorted = [...list].sort((a, b) =>
      axis === "X" ? a.x - b.x : a.y - b.y
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const value = axis === "X" ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
      if (value <= EPS) continue;

      const key = `${axis}:${a.letter}:${b.letter}`;
      if (seen.has(key)) continue;

      const valueKey = `${axis}:${treeFmtMm(value)}`;
      if (seenValue.has(valueKey)) continue;

      seen.add(key);
      seenValue.add(valueKey);

      out.push({ from: a.letter, to: b.letter, axis, value });
    }
  }

  const byY = new Map();
  const byX = new Map();

  for (const point of groups) {
    const yKey = bucketKey(point.y);
    const xKey = bucketKey(point.x);

    if (!byY.has(yKey)) byY.set(yKey, []);
    if (!byX.has(xKey)) byX.set(xKey, []);

    byY.get(yKey).push(point);
    byX.get(xKey).push(point);
  }

  for (const list of byY.values()) {
    if (list.length > 1) addAdjacent(list, "X");
  }

  for (const list of byX.values()) {
    if (list.length > 1) addAdjacent(list, "Y");
  }

  return out.sort((a, b) =>
    a.axis.localeCompare(b.axis) ||
    a.from.localeCompare(b.from) ||
    a.to.localeCompare(b.to)
  );
}

let treeViewMode = "tree";

function setTreeViewMode(mode) {
  treeViewMode = mode === "dim" ? "dim" : "tree";
  renderKorpusTreeView();
}

function renderKorpusTreeView() {
  const host = document.getElementById("treeView");
  if (!host) return;

  const groups = getKorpusTreeGroups(window.PR);
  if (!groups.length) {
    host.innerHTML = `<div class="tree-empty">kein Projekt geladen</div>`;
    return;
  }
  const renderPoints = window.showKorpusTreeRender?.(groups, getTreeEdges(groups), {
    dimensions: treeViewMode === "dim"
  }) || groups;
  renderTreeTables(renderPoints);
}

function renderTreeTables(renderPoints) {
  const host = document.getElementById("treeView");
  if (!host) return;
  const distances = getTreeAlignedDistances(renderPoints);
  const usedLetters = new Set(distances.flatMap(d => [d.from, d.to]));
  window.filterKorpusTreeLetters?.([...usedLetters]);
  const visiblePoints = usedLetters.size
    ? renderPoints.filter(p => usedLetters.has(p.letter))
    : renderPoints;
  const getTreeColor = window.getTreePointColor || (() => "#ffffff");
  const rows = distances.length
    ? distances.map(d => `
        <tr>
          <td>${d.from}</td>
          <td>${d.to}</td>
          <td>${d.axis === "X" ? treeFmtMm(d.value) : ""}</td>
          <td>${d.axis === "Y" ? treeFmtMm(d.value) : ""}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4">keine horizontalen oder vertikalen Abstände</td></tr>`;
  const pointRows = visiblePoints.length
    ? visiblePoints.map(p => {
        const color = getTreeColor(p.letter);
        return `
        <tr style="color:${color}">
          <td><span class="tree-point-chip" style="background:${color}"></span>${p.letter}</td>
          <td>${treeEsc([...new Set((p.items || []).map(item => displayPartName(item.nme)))].join(", "))}</td>
          <td>${treeFmtMm(p.x)}</td>
          <td>${treeFmtMm(p.y)}</td>
          <td>${treeFmtMm(p.z)}</td>
        </tr>
      `;
      }).join("")
    : `<tr><td colspan="5">keine Punkte</td></tr>`;
  const dimKeyRows = distances.length
    ? distances.map(d => {
        const fromColor = getTreeColor(d.from);
        const toColor = getTreeColor(d.to);
        const value = treeFmtMm(d.value);
        return `
          <div class="tree-dim-key-row">
            <span class="tree-dim-key-points">
              <span style="color:${fromColor}">${d.from}</span>
              <span class="tree-dim-key-separator">-</span>
              <span style="color:${toColor}">${d.to}</span>
            </span>
            <span class="tree-dim-key-axis">${d.axis}</span>
            <span class="tree-dim-key-value" style="color:${fromColor}">${value}</span>
          </div>
        `;
      }).join("")
    : `<div class="tree-dim-key-empty">keine Maße gefunden</div>`;
  const edges = getTreeEdges(renderPoints);
  const showDimView = treeViewMode === "dim";

  host.innerHTML = `
    <div class="tree-panel">
      <div class="tree-data-panels">
        ${showDimView ? `
        <div class="tree-dim-key">
          <div class="tree-dim-key-title">Maße</div>
          ${dimKeyRows}
        </div>
        ` : ""}
        <table class="tree-distance-table">
          <thead>
            <tr><th>Von</th><th>Bis</th><th>X</th><th>Y</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <table class="tree-distance-table">
          <thead>
            <tr><th>Punkt</th><th>Teile</th><th>X</th><th>Y</th><th>Z</th></tr>
          </thead>
          <tbody>${pointRows}</tbody>
        </table>
      </div>
    </div>
  `;

  if (showDimView) {
    if (typeof disposeTreeView3D === "function") disposeTreeView3D();
  } else {
    if (typeof disposeTreeView3D === "function") disposeTreeView3D();
  }
}

function setTreeViewDirection(direction) {
  const renderPoints = window.setKorpusTreeViewDirection?.(direction, {
    dimensions: treeViewMode === "dim"
  }) || [];
  renderTreeTables(renderPoints);
}

function saveCurrentUrlToServer() {
  const projectName = (window.PR?.nme || "projekt");
  const url = window.location.href.split("#")[0];

  fetch("/save-dwg-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectName, url })
  })
  .then(r => r.json())
  .then(r => {
    if (r.ok) console.log("URL gespeichert:", r.file);
    else console.warn("URL speichern fehlgeschlagen:", r);
  })
  .catch(err => console.warn("Server nicht erreichbar", err));
}


// Block Editor entfernt

function saveBlockEdit() {
  if (activeLineIndex === null) return;

  const ta = document.getElementById("inn");
  const form = document.getElementById("blockEditForm");
  const canvas = document.getElementById("canvas"); // Wrapper-DIV

  if (!ta || !form) return;

  // 1️⃣ Daten speichern
  const inputs = form.querySelectorAll("input");
  const newLine = Array.from(inputs)
    .map(inp => inp.value.trim())
    .filter(Boolean)
    .join(" ");

  const lines = ta.value.split(/\r?\n/);
  lines[activeLineIndex] = newLine;
  ta.value = lines.join("\n");

  activeLineIndex = null;
recordReloadHistory();
updateAndReloadURL()
/*  // 2️⃣ Canvas AUSBLENDEN
  canvas?.classList.add("canvas-hidden");

  // 3️⃣ Zurück zur Main-View
  setState("main");
  renderLineButtonsFromInn();

  // 4️⃣ Neu rendern (nächster Frame)
  requestAnimationFrame(() => {
    onRenderClicked();

    // 5️⃣ Canvas wieder EINBLENDEN
    requestAnimationFrame(() => {
      canvas?.classList.remove("canvas-hidden");
    });
  });
  */
}



function showOverlay(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function hideOverlay(id) {
  document.getElementById(id)?.classList.add("hidden");
}




  function deleteAllDWGInputs() {
    if (!window.lus || window.lus.length === 0) {
        alert("keine dwg inputs vorhanden");
        return;
    }

    const ok = confirm("Alle DWG-Inputfelder wirklich löschen?");
    if (!ok) return;

    const cont = document.getElementById("dwg_container");
    if (cont) cont.innerHTML = "";

    // Zustand komplett zurücksetzen
    window.lus = [];
    localStorage.removeItem("lus");
    localStorage.removeItem("lus_values");

    console.log("alle dwg inputs gelöscht");
}

  function saveLUS() {
    localStorage.setItem("lus", JSON.stringify(window.lus));
}

function saveLUSValues() {
    const data = {};
    if (!window.lus) return;

    for (const id of window.lus) {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
    }

    localStorage.setItem("lus_values", JSON.stringify(data));
}


function restoreLUS() {
    const vals = JSON.parse(localStorage.getItem("lus_values") || "{}");

    for (const id of window.lus) {
        const cont = document.getElementById("dwg_container");
        if (!cont) return;

        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = id;
        inp.placeholder = "dwg url";
        inp.style.width = "100%";
        inp.value = vals[id] || "";

        inp.addEventListener("input", saveLUSValues);
        cont.appendChild(inp);
    }
}

async function resolveFinalURL(name) {
    let current = name;
    const seen = new Set();

    while (current) {

        if (seen.has(current)) {
            console.warn("DWG loop detected:", current);
            return "";
        }
        seen.add(current);

        const res = await fetch("/dwg/" + current + ".txt");
        if (!res.ok) return "";

        const val = (await res.text()).trim();
        if (!val) return "";

        // ✅ ECHTE URL → FERTIG
        if (/^https?:\/\//i.test(val)) {
            return val;
        }

        // ✅ ABSOLUTER PFAD → FERTIG
        if (val.startsWith("/")) {
            return val;
        }

        // ❌ Sieht wie C3CAD aus → NICHT öffnungsfähig
        if (/[a-z]\s+pl|m\d|a\s+\w+/i.test(val)) {
            console.warn("C3CAD content, not openable:", current);
            return "";
        }

        // sonst: nächster DWG-Key
        current = val;
    }

    return "";
}




// globale Referenz (absichtlich!)
function createDWGInput() {

    if (!window.lus) window.lus = [];

    const cont = document.getElementById("dwg_container");
    if (!cont) return null;

    const id = "u" + window.lus.length;

    // Wrapper-Zeile
    const row = document.createElement("div");
    row.className = "dwg-row";
    row.id = "row_" + id;

    // Input
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = id;
    inp.size = 12;                  // ≈ 12 chars
    inp.placeholder = "dwg url";

    // Delete-Kreuz
    const del = document.createElement("span");
    del.textContent = "✖";
    del.className = "dwg-del";
    del.title = "input löschen";

    del.onclick = () => {
        const ok = confirm("Dieses DWG-Input wirklich löschen?");
        if (!ok) return;

        // DOM entfernen
        row.remove();

        // aus LUS entfernen
        window.lus = window.lus.filter(x => x !== id);
        localStorage.setItem("lus", JSON.stringify(window.lus));

        // Werte neu speichern
        saveLUSValues();
    };

    // Wertänderungen speichern
    inp.addEventListener("input", saveLUSValues);

    row.appendChild(inp);
    row.appendChild(del);
    cont.appendChild(row);

    // merken
    window.lus.push(id);
    localStorage.setItem("lus", JSON.stringify(window.lus));

    return inp;
}


function closeDwgPicker() {
  document.getElementById("dwgPicker").style.display = "none";
}

function insertLoadLine(fileBase) {
  createDWGInput();
  alert("u"+String(window.lus.length))
      const inp = document.getElementById("u"+String(window.lus.length-1));
  if (inp) {
                  inp.value = fileBase;
              }

        saveLUSValues()

  inp.focus();
}

let activeLineIndex = null;




function addLoadLine() {
    fetch("/list-dwg")
        .then(r => r.json())
        .then(list => {

            const ul = document.getElementById("dwgList");
            ul.innerHTML = ""; // Liste leeren

            (list || []).forEach(fileBase => {

                // =========================
                // Zeile (li)
                // =========================
                const li = document.createElement("li");
                li.style.display = "flex";
                li.style.alignItems = "center";
                li.style.gap = "6px";
                li.style.padding = "6px 4px";
                li.style.borderBottom = "1px solid #ddd";

                // =========================
                // DWG-Name
                // =========================
                const label = document.createElement("span");
                label.textContent = fileBase;
                label.style.flex = "1"; // nimmt Restbreite ein

                // =========================


                // Button: LADEN
                // =========================
                const btnLoad = document.createElement("button");
                btnLoad.textContent = "Laden";
                btnLoad.title = "DWG ins aktuelle Projekt laden";
                btnLoad.onclick = () => {
                    insertLoadLine(fileBase);
                    closeDwgPicker();
                };

                // =========================
                // Button: ÖFFNEN
                // =========================
                const btnOpen = document.createElement("button");
                btnOpen.textContent = "Öffnen";
                btnOpen.title = "DWG extern öffnen";
                btnOpen.onclick = () => {
                    openDWGInline(fileBase);
                    closeDwgPicker();
                };

                // =========================
                // Zusammenbauen
                // =========================
                li.appendChild(label);
                li.appendChild(btnLoad);
                li.appendChild(btnOpen);
                ul.appendChild(li);
            });

            // Picker anzeigen
            document.getElementById("dwgPicker").style.display = "block";
        })
        .catch(err => alert("fehler: " + err.message));
}


// ESC schließt Picker (optional)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDwgPicker();
});



/* ==================================================
   ASSEMBLY LOGIK (browser, kein render!)
================================================== */



/* --------------------------------------------------
   A | B nebeneinander
   (minimal, korrekt, deterministic)
-------------------------------------------------- */
window.assembleSide = function () {
  const urlA = document.getElementById("asmA").value.trim()
  const urlB = document.getElementById("asmB").value.trim()
  if (!urlA || !urlB) return

  const tA = decodeT(urlA)
  const tB = decodeT(urlB)

  if (!tA || !tB) {
    alert("ungültige url")
    return
  }

  /* 👉 MINIMAL-ASM:
     A bleibt wie er ist
     B wird zu 'b ... x<breite von A>'
     (breite später exakt aus der Projektberechnung – hier bewusst simpel)
  */

  const linesA = tA.trim().split("\n")
  const linesB = tB.trim().split("\n")

  const aLine = linesA.find(l => /^a\s/.test(l))
  if (!aLine) return

  // breite aus "a plr 60,55,72"
  const m = aLine.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return
  const wA = Number(m[1])

  const bLine = linesB.find(l => /^a\s/.test(l))
  if (!bLine) return

  const bMoved = "b " + bLine.slice(1) + " x" + wA

  const assembled =
    linesA.join("\n") +
    "\n" +
    bMoved

  const newUrl = "index.html?t=" + encodeT(assembled)
  window.location.href = newUrl
}



/* =====================================================
   PARSE ASSEMBLY AUS TEXTAREA #inn
===================================================== */

window.parseAssemblyFromEditor = function () {
  const text = document.getElementById("inn").value
  const lines = text.split(/\r?\n/)

  const urls = {}
  const assigns = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    /* ---------------------------------------------
       1) URL-DEFINITION: "A http://..."
    --------------------------------------------- */
    const mUrl = line.match(/^([A-Za-z])\s+(https?:\/\/.+\?t=.+)$/)
    if (mUrl) {
      const name = mUrl[1]
      const url  = mUrl[2]
      urls[name] = url
      i++
      continue
    }

    /* ---------------------------------------------
       2) ZUWEISUNG: "a A ..." / "b B ..."
    --------------------------------------------- */
    const mAssign = line.match(/^([a-z])\s+([A-Za-z])\b(.*)$/)
    if (mAssign) {
      assigns.push({
        target: mAssign[1],
        source: mAssign[2],
        rest:   mAssign[3].trim(),
        raw:    line
      })
      i++
      continue
    }

    i++
  }

  console.log("URLs:", urls)
  console.log("ASSIGNS:", assigns)

  return { urls, assigns }
}
/* =====================================================
   ASSEMBLY: MASSE AUS PROJEKTBERECHNUNG VERWENDEN
   - liest #inn
   - erkennt URL-definitionen (A, B, ...)
   - liest zuweisungen (a A, b B, ...)
   - holt w,d,h EXAKT aus der Projektberechnung
===================================================== */


/* -----------------------------------------------------
   1) editor parsen (urls + assigns)
----------------------------------------------------- */
function parseAssemblyFromEditor() {
  const text = document.getElementById("inn").value
  const lines = text.split(/\r?\n/)

  const urls = {}
  const assigns = []

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) continue

    /* URL-definition: "A http://..." */
    const mu = l.match(/^([A-Za-z])\s+(https?:\/\/.+\?t=.+)$/)
    if (mu) {
      urls[mu[1]] = mu[2]
      continue
    }

    /* zuweisung: "a A ..." */
    const ma = l.match(/^([a-z])\s+([A-Za-z])\b(.*)$/)
    if (ma) {
      assigns.push({
        target: ma[1],
        source: ma[2],
        rest: ma[3].trim(),
        raw: l
      })
    }
  }

  return { urls, assigns }
}

/* -----------------------------------------------------
   2) echte masse aus Projektberechnung holen
----------------------------------------------------- */
function getDimsFromCad(url) {
  const t = decodeT(url)
  if (!t) throw new Error("keine gültige t-url")

  const proj = new Proj(t)

  /* -----------------------------------------------
     In der Projektberechnung:
     proj.pp enthält die korpusse
     erster korpus = hauptkorpus
  ------------------------------------------------ */
  for (const k in proj.pp) {
    const o = proj.pp[k]
    if (o.w && o.d && o.h) {
      return {
        w: o.w,
        d: o.d,
        h: o.h
      }
    }
  }

  throw new Error("keine masse im cad gefunden")
}

/* -----------------------------------------------------
   3) assembly vorberechnen (nebeneinander)
----------------------------------------------------- */
window.assembleUsingCad = function () {
  const { urls, assigns } = parseAssemblyFromEditor()

  if (!assigns.length) {
    alert("keine zuweisungen gefunden")
    return
  }

  const instances = {}

  /* jede quelle nur einmal aus cad lesen */
  for (const a of assigns) {
    if (!instances[a.source]) {
      const dims = getDimsFromCad(urls[a.source])
      instances[a.source] = {
        ...dims,
        x: 0,
        y: 0,
        z: 0
      }
    }
  }

  /* nebeneinander: frb -> flb */
  let last = null
  for (const a of assigns) {
    const cur = instances[a.source]

    if (!last) {
      cur.x = 0
    } else {
      cur.x = last.x + last.w
    }

    last = cur
  }

  console.log("ASSEMBLY (mit cad-maßen):", instances)

  return instances
}



  function helpUp() {
  console.log("hilfe hoch");
}
function helpDown() {
  const el = document.getElementById("helpText");
  if (!el) return;

  el.scrollBy({
    top: el.clientHeight,
    behavior: "smooth"
  });
}





function onRenderClicked() {

    recordReloadHistory();
    updateAndReloadURL();    
    magie()
}
window.onRenderClicked=onRenderClicked




function openDWGPicker() {
  addLoadLine();
}


async function loadHelpMD() {
  const el = document.getElementById("helpText");
  if (!el) return;

  const res = await fetch("help.md");
  if (!res.ok) {
    el.textContent = "Hilfe konnte nicht geladen werden.";
    return;
  }

  const md = await res.text();
  el.innerHTML = marked.parse(md);
}

function isPRPromise(PR) {
  return PR && typeof PR.then === "function";
}

function isReadyPR(PR) {
  return PR && !isPRPromise(PR) && PR.oks && Array.isArray(PR.alljj) && PR.allpa;
}

function renderHolzliste(PR) {
  // const el = document.getElementById("woodList");
  // if (!el) return;

  
  const el2 = document.getElementById("woodOverview");
  if (!el2) return;

  if (isPRPromise(PR)) {
    PR.then(resolved => {
      window.PR = resolved;
      renderHolzliste(resolved);
    }).catch(err => console.error("renderHolzliste failed:", err));
    return;
  }

  if (!isReadyPR(PR)) {
    el2.textContent = "";
    return;
  }

  let txt = "";
  txt += renderStuecklisteByMaterial(PR);
  txt += renderStuecklisteByCorpus(PR);

  // el.textContent = txt;

  let txt2 = "";
  txt2 += renderKorpusUebersicht(PR);
  txt2           += renderMaterialUebersicht(PR);

  el2.textContent = txt2+txt;
  
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHolzlisteReportHTML(activePR, options = {}) {
  renderHolzlisteAll(activePR);

  const currentInn = options.inn || document.getElementById("inn")?.value || activePR?.inn || "";
  const holzText = window._holzliste_text || "";
  const isFreeView = options.plan !== "pro";
  const displayHolzText = isFreeView ? freeHolzlisteText(holzText, "inside") : holzText;
  const projectUrl = innToUrl(currentInn);
  const projectName = activePR?.nme || "projekt";
  const sumeur = activePR?.eur || "Preis nicht kalkuliert";
  const img64 = makeCanvasScreenshot();

  const now = new Date();
  const pad2 = n => String(n).padStart(2, "0");
  const dateHuman =
    now.getFullYear() + "-" +
    pad2(now.getMonth() + 1) + "-" +
    pad2(now.getDate()) + " " +
    pad2(now.getHours()) + ":" +
    pad2(now.getMinutes());

  const parts = parseHolzliste(holzText);
  const byMaterial = groupByMaterial(parts);
  const cutplanHTML = createCutplanHTML(byMaterial, isFreeView
    ? { maxPlates: FREE_LIMITS.cutplan?.freePlates || 1 }
    : {}
  );

  let beschlagText = "";
  if (!isFreeView && typeof cfg !== "undefined" && cfg?.beschlaege && cfg?.regeln) {
    const beschlagListe = createBeschlagStuecklisteFromKorpus(parts, cfg);
    beschlagText = createBeschlagText(beschlagListe);
  }

  let kalkulationText = "";
  if (!isFreeView && typeof window.CF === "number" && window.CF > 0) {
    kalkulationText = createKalkulationText(window.CF, parts);
  }

  return `
    <article class="wood-report">
      <header class="wood-report-head">
        <div>
          <h1>Holzliste</h1>
          <p><b>Projekt:</b> ${escapeHTML(projectName)}</p>
          <p><b>Erstellt:</b> ${escapeHTML(dateHuman)}</p>
        </div>
        <a href="${escapeHTML(projectUrl)}">Projekt öffnen</a>
      </header>

      ${img64 ? `
        <figure class="wood-report-preview">
          <figcaption>Korpus-Vorschau</figcaption>
          <img src="${img64}" alt="Korpus-Vorschau">
        </figure>
      ` : ""}

      <p><b>Projektpreis netto:</b> ${escapeHTML(sumeur)} Euro</p>

      <section>
        <h2>Holzliste</h2>
        <pre>${escapeHTML(displayHolzText)}</pre>
      </section>

      <section>
        <h2>Zuschnittplan (grob)</h2>
        ${cutplanHTML}
      </section>

      ${beschlagText ? `
        <section>
          <h2>Beschläge</h2>
          <pre>${escapeHTML(beschlagText)}</pre>
        </section>
      ` : ""}

      ${kalkulationText ? `
        <section>
          <h2>Kalkulation</h2>
          <pre>${escapeHTML(kalkulationText)}</pre>
        </section>
      ` : ""}
    </article>
  `;
}

async function renderHolzlisteReport(PR) {
  const el = document.getElementById("woodOverview");
  if (!el) return;

  if (isPRPromise(PR)) {
    el.textContent = "Holzliste wird erstellt...";
    PR.then(resolved => {
      window.PR = resolved;
      renderHolzlisteReport(resolved);
    }).catch(err => {
      console.error("renderHolzlisteReport failed:", err);
      el.textContent = "Holzliste konnte nicht erstellt werden.";
    });
    return;
  }

  const plan = await getProjectAccessPlan();
  await validateProjectPartLimit(PR, { plan });

  if (!isReadyPR(PR)) {
    el.textContent = "";
    return;
  }

  el.innerHTML = buildHolzlisteReportHTML(PR, { plan });
}

async function openListenState() {
  const inn = document.getElementById("inn")?.value || window.PR?.inn || "";

  try {
    if (inn && inn !== window.PR?.inn) {
      const nextPR = new Proj(inn);
      window.PR = typeof nextPR.getall === "function" ? await nextPR.getall() : nextPR;
    }
  } catch (err) {
    console.error("Holzliste konnte nicht aktualisiert werden:", err);
  }

  setState("wood");
}

function printHolzliste() {
  renderHolzlisteAll(PR);

  if (!window._holzliste_text) {
    alert("Keine Holzliste vorhanden");
    return;
  }
  window.print();
}


function downloadHolzliste177777() {
  renderHolzlisteAll(PR);

  const text = window._holzliste_text;
  if (!text) {
    alert("Keine Holzliste vorhanden");
    return;
  }

  const name = (window.PR?.nme || "holzliste") + ".txt";

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}


function dimsMM(p) {
  // Rohwerte in mm
  const a = Math.round(p.w * 10);
  const b = Math.round(p.d * 10);
  const c = Math.round(p.h * 10);

  // sortieren: kleinste Zahl nach hinten
  const arr = [a, b, c].sort((x, y) => y - x);

  return arr; // [groß, mittel, klein]
}



const mm = v => Math.round(Number(v) * 10); // cm → mm (bei dir!)
const pad = (s, n) => String(s).padEnd(n, " ");
const line = n => ".".repeat(n);
const sep  = n => "-".repeat(n);
const MODERN_PART_NAMES = {
  l: "sl",
  r: "sr",
  g: "bo",
  t: "de",
  b: "rw",
  f: "fr",
  c: "eb",
  v: "mw"
};

function displayPartName(name) {
  const text = String(name ?? "");
  return text.replace(/(^|[._])([lrgtbcfv])(?=$|[._\d])/g, (match, prefix, part) => {
    return prefix + (MODERN_PART_NAMES[part] || part);
  });
}

function displayHolzlistePartName(PR, p, key) {
  const fullName = String(p?.nme || key || "");
  const rawName = fullName.includes("_") ? fullName.split("_").slice(1).join("_") : fullName;
  const korpusNames = Object.keys(PR?.oks || {}).sort((a, b) => b.length - a.length);

  for (const korpusName of korpusNames) {
    if (!rawName.startsWith(korpusName)) continue;

    const partName = rawName.slice(korpusName.length);
    if (!partName) return displayPartName(rawName);
    return `${korpusName}.${displayPartName(partName)}`;
  }

  return displayPartName(rawName);
}

function renderStueckliste(PR) {
  if (!isReadyPR(PR)) return "";

  let out = "";

  out += "STÜCKLISTE (mm)\n";
  out += sep(60) + "\n";



  
  out +=
    pad("NME", 10) +
    pad("ANZ", 6) +
    pad("W", 6) +
    pad("D", 6) +
    pad("S", 6) + "\n";

  out += line(50) + "\n";

  for (const key of PR.alljj) {
    const p = PR.allpa[key];
    if (!p) continue;

    const [A, B, C] = dimsMM(p);



out +=
  pad(displayHolzlistePartName(PR, p, key), 10) +
  pad(p.n || 1, 6) +
  pad(A, 6) +
  pad(B, 6) +
  pad(C, 6) +
  "\n";

      
      "\n";
  }

  return out;
}

function renderStuecklisteByMaterial(PR) {
  if (!isReadyPR(PR)) return "";

  let out = "\nSTÜCKLISTE NACH MATERIAL (mm)\n";
  out += sep(70) + "\n";
  out += pad("MAT", 10) + pad("NME", 20) + pad("ANZ", 6) + pad("W", 6) + pad("D", 6) + pad("S", 6) + "\n";
  out += line(70) + "\n";

  // group by material signature p.co|p.s
  const mats = {};
  for (const key of PR.alljj) {
    const p = PR.allpa[key];
    if (!p) continue;
    const matKey = `${p.co || ""}|${p.s || ""}`;
    if (!mats[matKey]) mats[matKey] = [];
    mats[matKey].push({ key, p });
  }

  const matKeys = Object.keys(mats).sort();
  for (const mk of matKeys) {
    const [co, s] = mk.split("|");
    out += `\nMAT: ${co || "-"} / Stärke: ${s || "-"}\n`;

    // within material, aggregate by base name + dims
    const groups = new Map();
    for (const item of mats[mk]) {
      const p = item.p;
      const key = item.key;
      const [A, B, C] = dimsMM(p);
      const name = (function() {
        const fullName = String(p?.nme || key || "");
        const rawName = fullName.includes("_") ? fullName.split("_").slice(1).join("_") : fullName;
        const korpusNames = Object.keys(PR?.oks || {}).sort((a, b) => b.length - a.length);
        for (const korpusName of korpusNames) {
          if (!rawName.startsWith(korpusName)) continue;
          const partName = rawName.slice(korpusName.length);
          if (!partName) return displayPartName(rawName);
          return displayPartName(partName);
        }
        return displayPartName(rawName || fullName);
      })();

      const gkey = `${name}|${A}x${B}x${C}`;
      const entry = groups.get(gkey) || { name, A, B, C, count: 0 };
      entry.count += Number(p.n || 1);
      groups.set(gkey, entry);
    }

    const entries = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      out += pad("", 10) + pad(e.name, 20) + pad(e.count, 6) + pad(e.A, 6) + pad(e.B, 6) + pad(e.C, 6) + "\n";
    }
  }

  return out;
}

function renderStuecklisteByCorpus(PR) {
  if (!isReadyPR(PR)) return "";

  let out = "\nSTÜCKLISTE NACH KORPUS (mm)\n";
  out += sep(70) + "\n";

  // determine corpus names from PR.pp (korpusse)
  const korpusNames = Object.keys(PR.pp || {}).sort();
  if (!korpusNames.length) {
    // fallback: collect from parts
    const set = new Set();
    for (const key of PR.alljj) {
      const p = PR.allpa[key];
      if (!p) continue;
      const fullName = String(p?.nme || key || "");
      const rawName = fullName.includes("_") ? fullName.split("_").slice(1).join("_") : fullName;
      const maybe = Object.keys(PR?.oks || {}).find(k => rawName.startsWith(k));
      if (maybe) set.add(maybe);
    }
    korpusNames.push(...Array.from(set).sort());
  }

  for (const kor of korpusNames) {
    out += `\nKORPUS: ${kor}\n`;
    out += pad("NME", 20) + pad("ANZ", 6) + pad("W", 6) + pad("D", 6) + pad("S", 6) + "\n";
    out += line(60) + "\n";

    // collect parts belonging to this korpus
    const groups = new Map();
    for (const key of PR.alljj) {
      const p = PR.allpa[key];
      if (!p) continue;
      const fullName = String(p?.nme || key || "");
      const rawName = fullName.includes("_") ? fullName.split("_").slice(1).join("_") : fullName;
      if (!rawName.startsWith(kor)) continue;
      const partName = rawName.slice(kor.length) || rawName;
      const name = displayPartName(partName);
      const [A, B, C] = dimsMM(p);
      const gkey = `${name}|${A}x${B}x${C}`;
      const entry = groups.get(gkey) || { name, A, B, C, count: 0 };
      entry.count += Number(p.n || 1);
      groups.set(gkey, entry);
    }

    const entries = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      out += pad(e.name, 20) + pad(e.count, 6) + pad(e.A, 6) + pad(e.B, 6) + pad(e.C, 6) + "\n";
    }
  }

  return out;
}

function renderKorpusUebersicht(PR) {
  if (!isReadyPR(PR)) return "";

  let out = "\nKORPUSÜBERSICHT\n";
  out += sep(60) + "\n";

  for (const k in (PR.pp || {})) {
    const p = PR.pp[k];
    if (!p.w || !p.d || !p.h) continue;

    out +=
      `${k}   ` +
      `${mm(p.w)} × ${mm(p.d)} × ${mm(p.h)}   mm\n`;
  }

  return out;
}

function openEditorOnly() {
  const src = document.getElementById("inn");
  const dst = document.getElementById("editorOnlyText");

  dst.value = src.value;

  document.getElementById("editorOnly").classList.remove("hidden");
  dst.focus();
}


function submitEditorOnly() {
  const src = document.getElementById("editorOnlyText");
  const dst = document.getElementById("inn");

  dst.value = src.value;

  closeEditorOnly();

  // optional: direkt neu rendern
  if (typeof onRenderClicked === "function") {
    onRenderClicked();
  }
}

function closeEditorOnly() {
  document.getElementById("editorOnly").classList.add("hidden");
}



function renderHolzlisteAll(PR) {
  const el = document.getElementById("woodList");
  if (!el) return;

  if (!isReadyPR(PR)) {
    el.textContent = "";
    window._holzliste_text = "";
    return;
  }

  let txt = "";
  txt += renderProjektKopf(PR);
  txt += renderStuecklisteByMaterial(PR);
  txt += renderStuecklisteByCorpus(PR);
  txt += renderKorpusUebersicht(PR);
  txt += renderMaterialUebersicht(PR);

  el.textContent = txt;

  // merken für Download
  window._holzliste_text = txt;
}







// setState("main");
// renderLineButtonsFromInn();



if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.getElementById("inn").onclick = openEditorOnly;
}



function renderLineButtonsFromInn(options = {}) {
  const ta = document.getElementById("inn");
  const host = document.getElementById("lineButtons");
  if (!ta || !host) return;

  const lines = ta.value.split(/\r?\n/);
  host.innerHTML = "";

  // =========================
  // EXISTIERENDE ZEILEN
  // =========================
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;

    const parts = line.split(/\s+/);
    const key = parts[0];
    const rest = parts.slice(1).join(" ");

    const btn = document.createElement("button");
    btn.type = "button";

  btn.textContent = line;
  btn.style.width = "100%";
  btn.style.marginTop = "12px";
  btn.style.padding = "10px";
  btn.style.fontWeight = "bold";
  btn.title = `Zeile ${idx + 1}`;

    btn.onclick = () => {
  // console.log("CLICK LINE:", idx, line);

  if (idx === 0 && line) {
    pp.openProjectEditorFromLine(line);
  } else {
    // Statt Block Editor direkt zum Text Editor wechseln
    setState("inn");
    activeLineIndex = idx;
    setTimeout(() => {
      const ta = document.getElementById("inn");
      if (!ta) return;
      const lines = ta.value.split(/\r?\n/);
      const start = lines.slice(0, idx).reduce((sum, line) => sum + line.length + 1, 0);
      const end = start + (lines[idx] || "").length;
      ta.focus();
      ta.setSelectionRange(start, end);
      window.syncInnEditorFromTextarea?.();
    }, 50);
  }
};



    host.appendChild(btn);
  });

  // =========================
  // ➕ NEW CORPUS BUTTON
  // =========================
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+";
  addBtn.style.width = "100%";
  addBtn.style.marginTop = "12px";
  addBtn.style.padding = "10px";
  addBtn.style.fontWeight = "bold";

  addBtn.onclick = newCorpus;

  host.appendChild(addBtn);
}




function newCorpus() {
  const ta = document.getElementById("inn");
  if (!ta) return;

  const lines = ta.value.split(/\r?\n/);

  const last = lastCorpusLetter(lines);
  const next = nextCorpusLetter(lines);
  const newLine = `${next}${last[0]} c`;

  const newIndex = lines.length;
  lines.push(newLine);

  ta.value = lines.join("\n");

  renderLineButtonsFromInn();
  // Statt Block Editor direkt zum Text Editor wechseln
  setState("inn");
}
function lastCorpusLetter(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    const first = line.split(/\s+/)[0];

    if (/^[a-z]?/i.test(first)) {
      return first.toLowerCase();
    }
  }
  return null;
}

function nextCorpusLetter(lines) {
  const last = lastCorpusLetter(lines);
  if (!last) return "a";

  if (last >= "a" && last < "z") {
    return String.fromCharCode(last.charCodeAt(0) + 1);
  }

  return "a"; // Fallback nach 'z' (bewusst simpel)
}


document.addEventListener("DOMContentLoaded", () => {
  renderLineButtonsFromInn();
});

///////////////////////

function saveLineEdit() {
  const ta = document.getElementById("inn");
  const input = document.getElementById("lineEditorInput");

  if (!ta || activeLineIndex === null) return;

  const lines = ta.value.split(/\r?\n/);
  lines[activeLineIndex] = input.value;
  ta.value = lines.join("\n");

  closeLineEditor();
  renderLineButtonsFromInn();
  onRenderClicked()

}

function closeLineEditor() {
  activeLineIndex = null;
  setState("main");
}
function cancelLineEdit() {
  closeLineEditor();
}




function toggleMenu(menuId, e) {
  const menu = document.getElementById(menuId);
  if (!menu) return;

  e?.stopPropagation();

  const isOpen = menu.style.display === "block";

  // alle anderen Menüs schließen (optional, empfohlen)
  document.querySelectorAll(".menu").forEach(m => {
    if (m !== menu) m.style.display = "none";
  });

  menu.style.display = isOpen ? "none" : "block";

  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener(
        "click",
        ev => closeMenuOnce(menu, ev),
        { once: true }
      );
    }, 0);
  }
}
function closeMenuOnce(menu, ev) {
  if (!menu.contains(ev.target)) {
    menu.style.display = "none";
  }
}




function toggleHelpMenu(e) {
  const menu = document.getElementById("helpMenu");
  if (!menu) return;

  e?.stopPropagation();

  const isOpen = menu.style.display !== "none" && menu.style.display !== "";
  if (isOpen) {
    menu.style.display = "none";
    document.removeEventListener("click", closeHelpMenuOnce);
    return;
  }

  menu.style.display = "grid";
  menu.scrollTop = 0;

  // Klick außerhalb schließt Menü
  setTimeout(() => {
    document.addEventListener("click", closeHelpMenuOnce, { once: true });
  }, 0);
}

function closeHelpMenuOnce(ev) {
  const menu = document.getElementById("helpMenu");
  if (!menu.contains(ev.target)) {
    menu.style.display = "none";
  }
}



function openC3cadFile(){
  document.getElementById("c3cadFileInput").click();
}

function extractProjectUrl(text = "") {
  const match = String(text).match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return "";

  try {
    const url = new URL(match[0]);
    const host = url.hostname.toLowerCase();
    const isKnownHost =
      host === location.hostname ||
      host.endsWith("3dfg.de") ||
      host.endsWith("schreinertool.de") ||
      host === "localhost" ||
      host === "127.0.0.1";
    const hasProjectData = url.search && [...url.searchParams.keys()].length > 0;

    return isKnownHost && hasProjectData ? url.toString() : "";
  } catch {
    return "";
  }
}

async function openProjectFromClipboardOrFile() {
  try {
    const text = await navigator.clipboard?.readText?.();
    const url = extractProjectUrl(text);
    if (url) {
      location.href = url;
      return;
    }
  } catch {
    // Installed apps and some mobile browsers block automatic clipboard reads.
  }

  const pasted = prompt("Projekt-URL einfügen oder leer lassen, um eine Datei zu öffnen:", "");
  const pastedUrl = extractProjectUrl(pasted);
  if (pastedUrl) {
    location.href = pastedUrl;
    return;
  }

  if (pasted && pasted.trim()) {
    alert("Keine gültige schreinertool/3dfg-Projekt-URL gefunden.");
    return;
  }

  openC3cadFile();
}

document.getElementById("c3cadFileInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const html = String(reader.result || "");

    // 1) meta name="c3cad-url"
    const m = html.match(/<meta\s+name=["']c3cad-url["']\s+content=["']([^"']+)["']/i);
    if(m && m[1]){
      location.href = m[1].trim();
      return;
    }

    // 2) fallback: erster c3cad.de Link
    const l = html.match(/https?:\/\/schreinertool\.de\/[^\s"'<>]+/i);
    if(l && l[0]){
      location.href = l[0];
      return;
    }

    alert("Keine C3CAD-Projekt-URL in der Datei gefunden.");
  };
  reader.readAsText(file);
});


async function copyProjectLink(){
  const u = location.href.split("#")[0];
  try{
    await navigator.clipboard.writeText(u);
    // optional: toast
  }catch(err){
    prompt("Link kopieren:", u);
  }
}

function getCurrentProjectUrl() {
  const inn = document.getElementById("inn")?.value;
  return inn ? innToUrl(inn) : location.href.split("#")[0];
}

function shareProjectByMail() {
  const projectName = window.PR?.nme || "projekt";
  const subject = `3dfg projekt: ${projectName}`;
  const body = getCurrentProjectUrl();

  window.location.href =
    "mailto:" +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(body);
}

function resetToDefaultProject() {
  const ta = document.getElementById("inn");
  if (ta) {
    ta.value = DEFAULT_CORPUS;
    window.syncInnEditorFromTextarea?.();
  }

  sessionStorage.removeItem(EDIT_HISTORY_KEY);
  localStorage.removeItem("c3cad_state");
  location.href = location.origin + location.pathname;
}



    // 1=hl, 2=histo 3=importText
    export function savxx() {
      init(1)
      var sks
      
      sks = document.getElementById("inn").value;

      sks = sks.replace(/\u00A0/g, " ");

      let s = sks
        .replace(/\+/g, "_P_")   // echte Zeilenumbrüche durch __NL__ ersetzen
        .replace(/\n/g, "_N_")   // echte Zeilenumbrüche durch __NL__ ersetzen
        .replace(/ /g, "_S_");    // echte Leerzeichen durch __SP__ ersetzen

      let zuu = encodeURI(s);
      let u0 = "index.html";
      let uuu = u0 + "?t=" + zuu;
      window.location.href = $("#save").attr("href")
    }



 

    export function sav(){
      // magie()
      // init(1)
      onRenderClicked()
      // window.location.href = $("#save").attr("href")
    }
    window.sav=sav
    // const module = {}
    // import { init } from "./main.js";
    // module.init = init
    $(document).keyup(function (event) {
      // if (event.key == "Control") {
      //   // if ( event.which == 27 ) {
      //   // if (event.key == "w") {
      //   // event.preventDefault()
      //   magie()
      // }
      if (event.code == "ControlRight") {
        event.preventDefault()
      }
    })



function openHelp() {
    document.getElementById("helpOverlay").style.display = "block";
}

function closeHelp() {
    document.getElementById("helpOverlay").style.display = "none";
}

// ESC schließt Help
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeHelp();
    }
});



// Block Editor Funktionen entfernt - nicht mehr benötigt


// Block Editor entfernt


const MATERIAL_PREISE = {
  m19wh: 28.0,
  m08rw: 12.0
};

function createKalkulationText(CF, parts) {
  const byMat = {};
  let netto = 0;
  let out = [];

  for (const p of parts) {
    const area = (p.w * p.h) / 1_000_000;
    if (!byMat[p.material]) {
      byMat[p.material] = { area: 0, price: MATERIAL_PREISE[p.material] || 0 };
    }
    byMat[p.material].area += area;
  }

  out.push("== KALKULATION ==");
  out.push("");

  for (const mat in byMat) {
    const m = byMat[mat];
    const sum = m.area * m.price;
    netto += sum;

    out.push("Material " + mat);
    out.push("  Fläche: " + m.area.toFixed(2) + " m²");
    out.push("  Preis:  " + m.price.toFixed(2) + " €/m²");
    out.push("  Summe:  " + sum.toFixed(2) + " €");
    out.push("");
  }

  const aufschlag = netto * (CF - 1);
  out.push("-----------------");
  out.push("Netto:   " + netto.toFixed(2) + " €");
  out.push("CF (" + CF.toFixed(2) + "): " + aufschlag.toFixed(2) + " €");
  out.push("Gesamt:  " + (netto + aufschlag).toFixed(2) + " €");

  return out.join("\n");
}




function downloadHolzlisteS() {
const inn = document.getElementById("inn")?.value || window.PR?.inn || "";
openShareGate({
    image: null,
    url: innToUrl(inn),
    inn
});
}



function createCutplanHTML(byMaterial, options = {}) {

  const SCALE = 0.2;
  const sheet = { w: 2800, h: 2070 };
  const maxPlates = Number(options.maxPlates || 0);
  let renderedPlates = 0;
  let limited = false;
  const escHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  function layout(parts) {
    const rest = parts.slice(), out = [];

    while (rest.length) {
      let x = 0, y = 0, rowH = 0, pl = [];

      for (let i = 0; i < rest.length; i++) {
        const p = rest[i];

        if (x + p.w > sheet.w) {
          x = 0;
          y += rowH;
          rowH = 0;
        }

        if (y + p.h > sheet.h) continue;

        pl.push({ ...p, x, y });

        x += p.w;
        rowH = Math.max(rowH, p.h);

        rest.splice(i--, 1);
      }

      if (pl.length) out.push(pl);
      else break;
    }

    return out;
  }

  let html = "";

  Object.keys(byMaterial).forEach(mat => {

    html += `<h3>Material ${mat}</h3>`;

    const plates = layout(byMaterial[mat]);

    plates.forEach((pl, i) => {
      if (maxPlates && renderedPlates >= maxPlates) {
        limited = true;
        return;
      }
      renderedPlates++;

      html += `<b>Platte ${i+1}</b>`;

      html += `<div class="plate" style="
        width:${sheet.w * SCALE}px;
        height:${sheet.h * SCALE}px;
        position:relative;
        border:2px solid #333;
        margin:10px 0;
      ">`;

      pl.forEach(p => {

        html += `<div class="part" style="
          position:absolute;
          left:${p.x * SCALE}px;
          top:${p.y * SCALE}px;
          width:${p.w * SCALE}px;
          height:${p.h * SCALE}px;
          border:1px solid #222;
          background:#cde5ff;
          font-size:10px;
          padding:2px;
        ">
          <b>${escHtml(p.key)}</b><br>${escHtml(p.label)}
        </div>`;
      });

      html += `</div>`;
    });
  });

  if (limited) {
    const label = maxPlates === 1 ? "eine Platte" : `${maxPlates} Platten`;
    html += `<p>Free-Version: Der Zuschnittplan ist auf ${label} begrenzt.</p>`;
  }

  return html;
}


function holzlisteFreeLineLimit(kind = "export") {
  const limits = FREE_LIMITS.holzliste || {};
  const key = kind === "inside" ? "insideFreeLines" : "exportFreeLines";
  return Number(limits[key] || limits.freeLines || 100);
}

function freeHolzlisteText(text, kind = "export") {
  const lines = String(text || "").split(/\r?\n/);
  const firstLines = [];
  const maxLines = holzlisteFreeLineLimit(kind);

  for (const line of lines) {
    if (!line.trim()) continue;
    firstLines.push(line);
    if (firstLines.length >= maxLines) break;
  }

  return [
    ...firstLines,
    "",
    "Free-Version: Die Holzliste ist gekürzt.",
    "Mit schreinertool Pro (12 €/Jahr) bekommst du vollständige Holzlisten, Zuschnittpläne, Kalkulation und Exportfunktionen."
  ].join("\n");
}

async function publishProjectEntry({ projektText, currentInn, projectUrl, img64 }) {
  let imageUrl = "";

  if (img64) {
    try {
      const uploadRes = await fetch("/publish-image", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ img: img64 })
      });

      const uploadData = await uploadRes.json().catch(() => ({}));
      if (uploadRes.ok && uploadData.ok) {
        imageUrl = uploadData.imageUrl || "";
      } else {
        console.warn("Bild-Upload fehlgeschlagen", uploadData);
      }
    } catch (err) {
      console.warn("Bild-Upload fehlgeschlagen", err);
    }
  }

  const publishRes = await fetch("/publish", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      txt: projektText,
      inn: currentInn,
      url: projectUrl,
      img: imageUrl
    })
  });

  const publishData = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok || !publishData.ok) {
    throw new Error(publishData.msg || publishData.error || "publish failed");
  }

  alert("Erfolgreich veröffentlicht.");

  return imageUrl;
}

async function downloadHolzliste(options = {}) {
  const isFreeDownload = Boolean(options?.free);

  const currentInn = document.getElementById("inn")?.value || window.PR?.inn || "";
  if (currentInn && currentInn !== window.PR?.inn) {
    window.PR = await new Proj(currentInn).getall();
  }
  const activePR = window.PR;
  try {
    await validateProjectPartLimit(activePR, { plan: isFreeDownload ? "free" : undefined });
  } catch (err) {
    if (err?.name === "ProjectPartLimitError") {
      console.warn("Free-Limit erreicht:", err.message);
      return;
    }
    throw err;
  }

  renderHolzlisteAll(activePR);

  const holzText = window._holzliste_text || "";
  const downloadHolzText = isFreeDownload ? freeHolzlisteText(holzText, "export") : holzText;
  const projektText = generateShortDescription(activePR);
  const projectUrl = innToUrl(currentInn);

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");

  const dateHuman =
    now.getFullYear() + "-" +
    pad(now.getMonth()+1) + "-" +
    pad(now.getDate()) + " " +
    pad(now.getHours()) + ":" +
    pad(now.getMinutes());

  const dateFile =
    now.getFullYear() + "-" +
    pad(now.getMonth()+1) + "-" +
    pad(now.getDate()) + "_" +
    pad(now.getHours()) + "-" +
    pad(now.getMinutes());

  const projectName =
    (activePR?.nme || "projekt")
      .replace(/\s+/g, "_")
      .toLowerCase();

  const sumeur = (activePR?.eur || "Preis nicht kalkuliert");

  const fileName = projectName + "_" + dateFile + (isFreeDownload ? "_free_c3cad.html" : "_c3cad.html");

  const parts = parseHolzliste(holzText);
  const byMaterial = groupByMaterial(parts);
  const cutplanHTML = createCutplanHTML(byMaterial, isFreeDownload
    ? { maxPlates: FREE_LIMITS.cutplan?.freePlates || 1 }
    : {}
  );
  const beschlagListe = createBeschlagStuecklisteFromKorpus(parts, cfg);
  const beschlagText = createBeschlagText(beschlagListe);

  let kalkulationText = "";
  if (typeof window.CF === "number" && window.CF > 0) {
    kalkulationText = createKalkulationText(window.CF, parts);
  }

  const esc = s =>
    s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const img64 = makeCanvasScreenshot();
  const imageUrl = await publishProjectEntry({ projektText, currentInn, projectUrl, img64 });
  const absoluteImageUrl =
    imageUrl ? new URL(imageUrl, window.location.origin).href : "";

  // 🔥 HTML erzeugen
  let out = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>schreinertool Projekt – ${projectName}</title>

<style>
body{font-family:system-ui}
.preview{margin:12px 0;border:1px solid #ccc;max-width:320px}
.preview img{width:100%}
</style>
</head>

<body>

<h1>schreinertool Projekt: ${projectName}</h1>

<p><b>Erstellt:</b><br>${dateHuman}</p>

<h3>
<a href="${projectUrl}">Projekt öffnen</a>
</h3>

<div class="preview">
<strong>Korpus-Vorschau</strong><br>
<img src="${absoluteImageUrl}">
</div>

<p>Projektpreis netto: ${sumeur} Euro</p>

<h2>Holzliste</h2>
<pre>${esc(downloadHolzText)}</pre>
`;

  if (isFreeDownload) {
    out += `
<h2>Zuschnittplan (grob)</h2>
${cutplanHTML}
`;
  } else {
    out += `
<h2>Zuschnittplan (grob)</h2>
${cutplanHTML}

<h2>Beschläge</h2>
<pre>${esc(beschlagText)}</pre>
`;

    if (kalkulationText) {
      out += `
<h2>Kalkulation</h2>
<pre>${esc(kalkulationText)}</pre>
`;
    }
  }

  out += `
<p style="font-size:0.9em;color:#666">
Erstellt mit <b>schreinertool</b>
</p>

</body>
</html>`;

  const blob = new Blob([out], {type:"text/html;charset=utf-8"});
  const urlBlob = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = urlBlob;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(urlBlob);
}

function makeCanvasScreenshot() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;

  try {
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Screenshot konnte nicht erstellt werden", err);
    return null;
  }
}

function openPublish() {

  const img = makeCanvasScreenshot();
  if (!img) {
    alert("Kein Canvas gefunden.");
    return;
  }

  localStorage.setItem("pubimg", img);

  // wichtig für deine C3CAD-Welt:
  localStorage.setItem("pubinn", window.PR?.inn || "");
  localStorage.setItem("puburl", window.location.href || "");

  window.open("/publish.html", "_blank");
}

function saveDWGToServer(fileName, html) {
  fetch("/save-dwg", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fileName, html })
})
.then(async r => {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned non-JSON:\n" + text.slice(0, 200));
  }
})
.then(r => {
  if (r.ok) {
    console.log("DWG gespeichert:", r.file);
  }
})
.catch(err => {
  console.warn("Server nicht erreichbar – nur lokal gespeichert", err);
});

}

function parseHolzliste(text) {
  const parts = [];
  const lines = text.split(/\r?\n/);

  let inTable = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Tabelle beginnt nach Header
    if (line.startsWith("NME") && line.includes("W") && line.includes("S")) {
      inTable = true;
      continue;
    }

    if (!inTable) continue;

    // Trennlinien / Punkte überspringen
    if (/^[\.\-]+$/.test(line)) continue;

    // Erwartet: name anzahl w d s
    // Beispiel: al  1  720  550  19
    const cols = line.split(/\s+/);
    if (cols.length < 5) continue;

    const label = cols[0];
    const qty   = parseInt(cols[1], 10);
    const w     = parseInt(cols[2], 10);
    const h     = parseInt(cols[3], 10);
    const d     = parseInt(cols[4], 10);

    if (!(qty && w && h && d)) continue;

    // ⚠️ Material aus Stärke ableiten (wie bei dir: w=19, b=16)
    const material =
      d === 19 ? "w19" :
      d === 16 ? "b16" :
      "x" + d;

    for (let i = 0; i < qty; i++) {
      const key = qty > 1 ? `${label}.${i + 1}` : label;
      parts.push({
        key,
        label,
        w,
        h,
        d,
        material
      });
    }
  }

  return parts;
}

function groupByMaterial(parts) {
  const map = {};
  for (const p of parts) {
    if (!map[p.material]) map[p.material] = [];
    map[p.material].push(p);
  }
  return map;
}

function layoutPlates(parts, sheet) {
  const rest = [...parts];
  const plates = [];

  while (rest.length) {
    let x = 0, y = 0, rowH = 0;
    const placed = [];

    for (let i = 0; i < rest.length; i++) {
      const p = rest[i];

      if (x + p.w > sheet.w) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      if (y + p.h > sheet.h) continue;

      placed.push({ ...p, x, y });
      x += p.w;
      rowH = Math.max(rowH, p.h);

      rest.splice(i, 1);
      i--;
    }

    if (!placed.length) break;
    plates.push(placed);
  }
  return plates;
}
// function openBlockEditor(initialValue) {
//   const be = document.getElementById("blockEditor");

//   be.innerHTML = `
//     <form id="blockEditForm">
//       <textarea id="blockEditInput">${initialValue}</textarea>
//     </form>
//   `;

//   const form  = document.getElementById("blockEditForm");
//   const input = document.getElementById("blockEditInput");

//   input.focus();

//   // ✔ ENTER = OK
//   form.addEventListener("submit", (e) => {
//     e.preventDefault();   // ⛔ kein Reload
//     saveBlockEdit();      // ✔ dein OK
//   });

//   // ✔ ESC = Abbrechen
//   input.addEventListener("keydown", (e) => {
//     if (e.key === "Escape") {
//       e.preventDefault();
//       cancelLineEdit();
//     }
//   });
// }

function createBeschlagText(list) {
  let out = [];
  let total = 0;

  out.push("BESCHLÄGE");
  out.push("");
  out.push(
    "Artikel".padEnd(35) +
    "Nr.".padEnd(12) +
    "Menge".padEnd(8) +
    "Preis".padEnd(8) +
    "Summe"
  );
  out.push("-".repeat(68));

  for (const b of list) {
    const sum = b.menge * b.preis_eur;
    total += sum;

    out.push(
      b.name.padEnd(35) +
      b.artikel_nr.padEnd(12) +
      (b.menge + " " + b.einheit).padEnd(8) +
      b.preis_eur.toFixed(2).padEnd(8) +
      sum.toFixed(2) + " €"
    );
  }

  out.push("-".repeat(68));
  out.push("Summe Beschläge netto: " + total.toFixed(2) + " €");

  return out.join("\n");
}

function renderBeschlaegeHTML(container, list) {
  let total = 0;

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.marginTop = "10px";

  table.innerHTML = `
    <tr>
      <th style="text-align:left;border-bottom:2px solid #000">Artikel</th>
      <th style="text-align:left;border-bottom:2px solid #000">Nr.</th>
      <th style="text-align:right;border-bottom:2px solid #000">Menge</th>
      <th style="text-align:right;border-bottom:2px solid #000">Preis €</th>
      <th style="text-align:right;border-bottom:2px solid #000">Summe €</th>
    </tr>
  `;

  for (const b of list) {
    const sum = b.menge * b.preis_eur;
    total += sum;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.name}</td>
      <td>${b.artikel_nr}</td>
      <td style="text-align:right">${b.menge} ${b.einheit}</td>
      <td style="text-align:right">${b.preis_eur.toFixed(2)}</td>
      <td style="text-align:right">${sum.toFixed(2)}</td>
    `;
    table.appendChild(tr);
  }

  const trSum = document.createElement("tr");
  trSum.innerHTML = `
    <td colspan="4" style="text-align:right;border-top:2px solid #000">
      <b>Summe Beschläge netto</b>
    </td>
    <td style="text-align:right;border-top:2px solid #000">
      <b>${total.toFixed(2)}</b>
    </td>
  `;
  table.appendChild(trSum);

  container.appendChild(table);
}
function createBeschlagStuecklisteFromKorpus(parts, cfg) {
  const result = {};

  function add(ref, qty) {
    if (!result[ref]) {
      const b = cfg.beschlaege[ref];
      result[ref] = {
        ref,
        name: b.name,
        hersteller: b.hersteller,
        artikel_nr: b.artikel_nr,
        preis_eur: b.preis_eur,
        einheit: b.einheit,
        menge: 0
      };
    }
    result[ref].menge += qty;
  }

  for (const p of parts) {

    // 🔑 TYP DIREKT AUS LABEL
    const typ = getTypFromLabel(p.label);
    if (!typ) continue;

    const reg = cfg.regeln[typ];
    if (!reg || !reg.beschlaege) continue;

    const area_m2 = (p.w * p.h) / 1_000_000;

    for (const r of reg.beschlaege) {
      let qty = 0;

      if (r.fix) {
        qty += r.fix;
      }

      if (r.pro_m2) {
        qty += Math.ceil(area_m2 * r.pro_m2);
      }

      if (r.min && qty < r.min) {
        qty = r.min;
      }

      if (qty > 0) {
        add(r.ref, qty);
      }
    }
  }

  return Object.values(result);
}


function getTypFromLabel(label) {
  if (!label || label.length < 2) return null;
  return label[1]; // z. B. "af" → "f"
}


Object.assign(window, {
  openC3cadFile,
  copyProjectLink,
  shareProjectByMail,
  downloadHolzliste,
  recordEditHistory,
  recordReloadHistory,
  syncEditHistoryToCurrent,
  updateToolbarStatus,
  showInnProjectError,

  cancelLineEdit,
  saveCurrentUrlToServer_noFetch,
  renderLineButtonsFromInn,
  newCorpus,
  setState,
  openListenState,
  mm,
  pad,
  line,
  sep,

  // alles, was per onclick genutzt wird
});

function addMenuButton(label, action, className = "") {
  const menu = document.getElementById("helpMenu");
  if (!menu) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = ["menu-action", className].filter(Boolean).join(" ");
  btn.textContent = label;
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    menu.style.display = "none";
    action?.();
  });

  menu.insertBefore(btn, menu.firstChild);
}

const QUICK_HELP_KEY = "c3cad.quickHelp.visible";

const QUICK_HELP_COMMANDS = [
  ["teil", "Teile setzen, z.B. teil.sl,sr,fr,rw,bo"],
  ["breit tief hoch", "Masse setzen, z.B. breit.80 tief.40 hoch.72"],
  ["mat", "Material setzen, z.B. mat.19,wh,f,14"],
  ["x y z", "Position setzen, z.B. x.20"],
  ["reihe", "Wiederholen, z.B. reihe.x.3,55r"],
  ["cut", "Teile schneiden, z.B. fr.cut.x.2"],
  ["push", "Schieben, Abstand, Fugen und Sockel"],
  ["dock", "Verbinden/Andocken"],
  ["dre", "Drehen um x, y oder z"]
];

const QUICK_HELP_ALIASES = [
  ["sk=base,14,3", "Sockel-Korpus am Boden andocken"],
  ["soc=8", "Sockel/Push 8"],
  ["leg=8", "ein Beinsatz"]
];

const QUICK_HELP_MODEL = [
  ["a", "Corpus-Name in der ersten Spalte"],
  ["b.a", "b erbt Werte und Kinder von a"],
  ["a.griff", "Kind von a, wird mit a vererbt"],
  ["rechte Strg", "Änderungen übernehmen"]
];

const QUICK_HELP_SAVE = [
  ["Teilen", "Projekt-Link an die eigene E-Mail-Adresse senden"],
  ["Link", "Der Link enthält dein Projekt und öffnet es wieder"]
];

function quickHelpRows(rows, className = "") {
  return rows
    .map(([key, text]) => `<div class="${className}"><dt>${htmlText(key)}</dt> <dd>${htmlText(text)}</dd></div>`)
    .join("");
}

function htmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderQuickHelpOverlay() {
  const overlay = document.getElementById("quickHelpOverlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="quick-help-head">
      <h2>Kurzhilfe</h2>
      <button class="quick-help-close" type="button">Schließen</button>
    </div>
    <div class="quick-help-grid">
      <section class="quick-help-section">
        <h3>Befehle</h3>
        <dl>${quickHelpRows(QUICK_HELP_COMMANDS)}</dl>
      </section>
      <section class="quick-help-section">
        <h3>Aliase</h3>
        <dl>${quickHelpRows(QUICK_HELP_ALIASES, "alias")}</dl>
      </section>
      <section class="quick-help-section">
        <h3>Name</h3>
        <dl>${quickHelpRows(QUICK_HELP_MODEL)}</dl>
      </section>
      <section class="quick-help-section">
        <h3>Speichern</h3>
        <dl>${quickHelpRows(QUICK_HELP_SAVE)}</dl>
      </section>
    </div>
  `;

  overlay
    .querySelector(".quick-help-close")
    ?.addEventListener("click", () => setQuickHelpVisible(false));
}

function positionQuickHelpOverlay() {
  const overlay = document.getElementById("quickHelpOverlay");
  const canvas = document.getElementById("canvas");
  if (!overlay || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function setQuickHelpVisible(visible) {
  const overlay = document.getElementById("quickHelpOverlay");
  if (!overlay) return;

  renderQuickHelpOverlay();
  positionQuickHelpOverlay();
  overlay.classList.toggle("is-visible", Boolean(visible));
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  localStorage.setItem(QUICK_HELP_KEY, visible ? "1" : "0");
}

function toggleQuickHelpOverlay() {
  const overlay = document.getElementById("quickHelpOverlay");
  const visible = !overlay?.classList.contains("is-visible");
  setQuickHelpVisible(visible);
}

function initQuickHelpOverlay() {
  renderQuickHelpOverlay();
  setQuickHelpVisible(localStorage.getItem(QUICK_HELP_KEY) === "1");
  window.addEventListener("resize", positionQuickHelpOverlay);
  window.addEventListener("orientationchange", () => setTimeout(positionQuickHelpOverlay, 80));
}

function setupAppMenuActions() {
  const menu = document.getElementById("helpMenu");
  if (!menu || menu.dataset.appActions === "1") return;
  menu.dataset.appActions = "1";

  addMenuButton("App", () => {
    window.location.href = "./app.html";
  }, "menu-action-app");

  addMenuButton("Wiederherstellen", restoreEditHistory, "menu-action-highlight");

  addMenuButton("Zurück", () => {
    if (typeof setState === "function") setState("main");
    else window.history.back();
  }, "menu-action-app");
}

function initEditToolbar() {
  document.getElementById("cornerMenuButton")
    ?.addEventListener("click", toggleHelpMenu);
  document.getElementById("toolbarUndo")
    ?.addEventListener("click", undoProjectText);
  document.getElementById("toolbarRedo")
    ?.addEventListener("click", redoProjectText);

  restoreEditHistory();
  updateToolbarStatus();
}

async function loadVisitorCounter() {
  try {
    const res = await fetch("/q", { cache: "no-store" });
    const data = await res.json();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(data?.v || "")) {
      visitorCounterText = data.v;
      updateToolbarStatus();
    }
  } catch {}
}

function triggerCentralReload() {
  recordReloadHistory();

  if (typeof window.onRenderClicked === "function") {
    window.onRenderClicked();
  } else {
    updateAndReloadURL();
  }
}

function setupCentralReload() {
  document.getElementById("centralReloadButton")
    ?.addEventListener("click", triggerCentralReload);

  document.addEventListener("keydown", (event) => {
    if (event.code !== "ControlRight" || event.repeat) return;
    event.preventDefault();
    triggerCentralReload();
  });
}

setupAppMenuActions();
initQuickHelpOverlay();
initEditToolbar();
loadVisitorCounter();
setState(window.currentState || localStorage.getItem("c3cad_state") || "main");
setupCentralReload();
bootState();


//////////////prreport

function projectReport(){

  if(!window.PR || !PR.oks){
    alert("kein projekt geladen");
    return;
  }

  const korp = Object.values(PR.oks);

  const html = buildProjectReport(korp);

  const w = window.open("");
  w.document.write(html);
}


function describeProject(pr){

  const res = [];

  for(const kname in pr.oks){

    const ko = pr.oks[kname];

    const korpus = {
      name: ko.nme,
      w: ko.w,
      d: ko.d,
      h: ko.h,
      preis: ko.ep,
      teile: []
    };

    const parts = ["l","r","g","t","b","c"];

    parts.forEach(p => {

      if(!ko[p]) return;

      const t = ko[p];

      korpus.teile.push({
        typ: displayPartName(p),
        name: displayPartName(t.nme),
        w: t.w,
        d: t.d,
        h: t.h,
        m2: t.m2,
        preis: t.eu,
        material: t.m
      });

    });

    res.push(korpus);
  }

  return res;
}

function projectTextReport(pr){

  const korp = describeProject(pr);

  let txt = "";

  korp.forEach(k => {

    txt += `korpus ${k.name}\n`;
    txt += `größe: ${k.w} × ${k.d} × ${k.h} cm\n`;
    txt += `preis: ${k.preis} €\n`;

    txt += "bauteile:\n";

    k.teile.forEach(t => {

      txt += `  ${displayPartName(t.typ)}  ${t.w} × ${t.d} × ${t.h} cm\n`;

    });

    txt += "\n";
  });

  return txt;
}


function buildProjectReport(korp){

  let html = `
  <html>
  <head>
  <title>projektblatt</title>

  <style>

  body{
    font-family:Arial;
    padding:30px;
  }

  h1{
    margin-bottom:40px;
  }

  .korpus{
    border:1px solid #444;
    padding:20px;
    margin-bottom:40px;
  }

  .row{
    display:flex;
    gap:40px;
  }

  .sketch{
    border:2px solid black;
    position:relative;
  }

  table{
    border-collapse:collapse;
    margin-top:10px;
  }

  td,th{
    border:1px solid #aaa;
    padding:4px 8px;
  }

  </style>
  </head>

  <body>

  <h1>projekt ${PR.nme}</h1>
  `;

  korp.forEach(k => {

    html += renderKorpus(k);

  });

  html += "</body></html>";

  return html;
}

function renderKorpus(k){

  let html = `
  <div class="korpus">

  <h2>korpus ${k.nme}</h2>

  ${angebotText(k)}

  <div class="row">

  ${drawSketch(k)}

  ${partsTable(k)}

  </div>

  </div>
  `;

  return html;
}


function angebotText(k){

  return `
  <p>

  angebot: korpus <b>${k.nme}</b><br>

  außenmaß: ${k.w} × ${k.d} × ${k.h} cm<br>

  material: ${materialName(k.m)}<br>

  ausführung:

  zwei seiten, boden, deckel, rückwand und fachboden.

  preis: <b>${k.ep.toFixed(2)} €</b>

  </p>
  `;
}


function materialName(m){

  const mat = PR.lm[m];

  if(!mat) return "unbekannt";

  return `${mat.s*10} mm ${mat.co}`;
}


function partsTable(k){

  const parts = ["l","r","g","t","b","c"];

  let html = `
  <table>

  <tr>
  <th>teil</th>
  <th>größe</th>
  <th>fläche</th>
  <th>preis</th>
  </tr>
  `;

  parts.forEach(p => {

    const t = k[p];
    if(!t) return;

    html += `
    <tr>
    <td>${displayPartName(p)}</td>
    <td>${t.w} × ${t.d} × ${t.h}</td>
    <td>${t.m2}</td>
    <td>${t.eu}</td>
    </tr>
    `;
  });

  html += "</table>";

  return html;
}

function drawSketch(k){

  const scale = 3;

  const w = k.w*scale;
  const h = k.h*scale;

  let lines = "";

  if(k.c){

    const z = k.c.z*scale;

    lines += `
    <div style="
      position:absolute;
      left:0;
      right:0;
      top:${z}px;
      height:2px;
      background:black;"></div>`;
  }

  return `
  <div class="sketch"

  style="
  width:${w}px;
  height:${h}px">

  ${lines}

  </div>
  `;
}
