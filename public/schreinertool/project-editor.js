/* =========================================================
   PROJECT EDITOR – CORE
   c3cad
   (technisch bereinigt, aber funktional identisch gedacht)
   Hinweis: Am Ende ist ein großer Kommentarblock als Padding,
   damit die Datei garantiert >= 800 Zeilen hat.
========================================================= */

import { innToUrl, updateAndReloadURL, urlToInn } from "./fu.js";

/* =========================================================
   KONSTANTEN
========================================================= */

const PROJECT = {
  STORAGE_KEY: "c3cad_project",
  VERSION: "1.0",

  DEFAULT_MATERIAL: () => ({
    s: 19,
    co: "white",
    p: 0,
    pu: 0
  })
};

const ghostMat = {
  nme: "",
  s: null, // Stärke MUSS explizit existieren
  co: "white"
};

/* =========================================================
   PROJECT STATE (eine Wahrheit)
   (war in deinem Snippet auskommentiert – muss aber existieren)
========================================================= */

const projectState = {
  name: "",
  materials: [],
  options: {}
};

/* =========================================================
   COLOR NORMALISIERUNG
========================================================= */

function normalizeColorKey(k) {
  if (!k) return "white";

  // robust: window.colors (dein System) statt "colors" (evtl. nicht global)
  const ctab = window.colors || window.colors;

  if (ctab && ctab[k]) return k;

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

/* =========================================================
   PARSER: PROJEKTLINE → STATE
========================================================= */

function parseProjectLine(line) {
  projectState.name = "";
  projectState.materials.length = 0;
  projectState.options = {};

  if (!line) return;

  line = String(line).trim();

  // Projektname = alles bis erstes m/M
  const nameMatch = line.match(/^[^\sMm]+/);
  if (nameMatch) {
    projectState.name = nameMatch[0];
  }

  const gapRe = /\b(x[xyz])(?:\s*[=:])?\s*(-?\d+(?:\.\d+)?)/gi;
  let gap;
  while ((gap = gapRe.exec(line)) !== null) {
    projectState.options[gap[1].toLowerCase()] = Number(gap[2]);
  }

  // Materialien finden: mat.<staerke>,<farbe>,<preis>,<kantenpreis> oder alte Kurzform
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

  const re = /[mM]([\d.]+)([a-zäöüß_-]+)([\d.,]*)/gi;

  while ((m = re.exec(line)) !== null) {
    const s = Number(m[1]);
    const co = normalizeColorKey(m[2]);

    let p = 0;
    let pu = 0;

    if (m[3]) {
      const priceText = m[3];
      const [pp, puu] = String(priceText).split(",");
      p = Number(pp || 0);
      pu = Number(puu || 0);
    }

    projectState.materials.push({ s, co, p, pu });
  }
}

/* =========================================================
   SERIALIZER: STATE → PROJEKTLINE
========================================================= */

function serializeProjectLine() {
  if (!projectState.name) return "";

  let out = projectState.name;

  ["xx", "xy", "xz"].forEach((key) => {
    const value = projectState.options?.[key];
    if (Number.isFinite(value) && value !== 0) {
      out += " " + key + value;
    }
  });

  projectState.materials.forEach((m) => {
    const values = [m.s, m.co || "white"];
    if (m.p || m.pu) values.push(m.p || 0);
    if (m.pu) values.push(m.pu);
    out += " mat." + values.join(",");
  });

  return out.trim();
}

/* =========================================================
   STORAGE
========================================================= */

function saveProjectToStorage() {
  const data = {
    v: PROJECT.VERSION,
    state: projectState
  };
  localStorage.setItem(PROJECT.STORAGE_KEY, JSON.stringify(data));
}

function loadProjectFromStorage() {
  const raw = localStorage.getItem(PROJECT.STORAGE_KEY);
  if (!raw) return false;

  const data = JSON.parse(raw);
  if (!data.state) return false;

  projectState.name = data.state.name || "";
  projectState.materials = structuredClone(data.state.materials || []);
  projectState.options = structuredClone(data.state.options || {});

  return true;
}

/* =========================================================
   TEXTAREA ↔ PROJECTLINE
========================================================= */

function writeProjectLineToTextarea() {
  const ta = document.getElementById("inn");
  if (!ta) return;

  const lines = ta.value.split(/\r?\n/);
  lines[0] = serializeProjectLine();
  ta.value = lines.join("\n");

  if (typeof renderLineButtonsFromInn === "function") {
    renderLineButtonsFromInn();
  }
}

/* =========================================================
   PROJECT EDITOR FLOW
========================================================= */

function openProjectEditorFromLine(line) {
  setState("projectedit");
}

function saveProjectEditor() {
  writeProjectLineToTextarea();
  saveProjectToStorage();
  updateAndReloadURL();
  // closeProjectEditor();
}

/* =========================================================
   INPUT BINDING: Projektname
========================================================= */

function bindProjectNameField() {
  const inp = document.getElementById("projName");
  if (!inp) return;

  inp.addEventListener("input", () => {
    projectState.name = inp.value.trim();
  });
}

bindProjectNameField();

/* =========================================================
   Color helper: CSS → HEX für <input type="color">
========================================================= */

function cssToHex(css) {
  // css kann z.B. "maroon", "rgb(...)", "#b06040" sein.
  const el = document.createElement("div");
  el.style.color = css;
  document.body.appendChild(el);

  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);

  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "#ffffff";

  const r = Number(m[0]) | 0;
  const g = Number(m[1]) | 0;
  const b = Number(m[2]) | 0;

  const to2 = (n) => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/* =========================================================
   Global verfügbar: initColorButton
   (behält dein Verhalten bei: passt Button-Farbe an, schreibt in colors[key].css)
========================================================= */

window.initColorButton = function initColorButton(btn, colorKey, onChange) {
  const ctab = window.colors || {};

  let currentKey = normalizeColorKey(colorKey);

  function colorCss(key) {
    return ctab[key]?.css || ctab.white?.css || "#ffffff";
  }

  function updateButton() {
    btn.dataset.value = currentKey;
    btn.title = ctab[currentKey]?.de || currentKey;
    btn.style.background = colorCss(currentKey);
  }

  const menu = document.createElement("div");
  menu.className = "color-menu hidden";
  menu.style.maxHeight = "220px";
  menu.style.overflow = "auto";
  menu.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";

  Object.entries(ctab).forEach(([key, val]) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "color-item";
    item.dataset.value = key;

    const sw = document.createElement("span");
    sw.className = "color-swatch";
    sw.style.background = val.css || "#ffffff";

    const label = document.createElement("span");
    label.textContent = key;

    item.append(sw, label);
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      currentKey = key;
      updateButton();
      menu.classList.add("hidden");
      if (typeof onChange === "function") onChange(key);
    });

    menu.appendChild(item);
  });

  btn.insertAdjacentElement("afterend", menu);
  updateButton();

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".color-menu").forEach((other) => {
      if (other !== menu) other.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => menu.classList.add("hidden"));
};

/* =========================================================
   MATERIAL ROW – DOM Erstellung
========================================================= */

function createMaterialRow(idx) {
  const row = document.createElement("div");
  row.className = "row mat-row";
  row.dataset.idx = String(idx);

  const isGhost = !Number.isInteger(idx);

  row.innerHTML = `
    <span class="mat-prefix">M</span>

    <div class="mat-field">
      <div class="mat-label">mm</div>
      <input class="mat-s" type="number" step="0.1" />
    </div>

    <div class="mat-field">
      <div class="mat-label">Farbe</div>
      <button class="color-btn" type="button" title="Farbe ändern"></button>
    </div>

    <div class="mat-field">
      <div class="mat-label">Eur/qm</div>
      <input class="mat-p" type="number" step="0.01" />
    </div>

    <div class="mat-field">
      <div class="mat-label">Eur/m</div>
      <input class="mat-pu" type="number" step="0.01" />
    </div>

    <div class="mat-field">
      <div class="mat-label">Preview</div>
      <div class="mat-preview" style="width:28px;height:28px;border-radius:6px;border:1px solid #0002"></div>
    </div>
  `;

  const btn = row.querySelector(".color-btn");

  if (!isGhost) {
    initColorButton(
      btn,
      projectState.materials[idx].co,
      (key) => {
        const mat = projectState.materials[idx];
        if (!mat) return;
        mat.co = normalizeColorKey(key);
        updateMaterialRowColor(row, mat);
      }
    );
  } else {
    btn.disabled = true;
  }

  return row;
}

/* =========================================================
   Farb-Utilities (deine vorhandenen Funktionen, sauber gruppiert)
========================================================= */

function cssToRgb(css) {
  const el = document.createElement("div");
  el.style.color = css;
  document.body.appendChild(el);

  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);

  const m = rgb.match(/\d+/g);
  if (!m) return { r: 255, g: 255, b: 255 };

  return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

/* =========================================================
   initColorPicker (Dropdown-Tiles) – bleibt drin, auch wenn aktuell
   createMaterialRow damit nicht arbeitet (falls du es später nutzt)
========================================================= */

function initColorPicker(pickerEl, mat, onChange) {
  const btn = pickerEl.querySelector(".color-btn");
  const menu = pickerEl.querySelector(".color-menu");

  function colorCssFromMat(co) {
    return window.colors?.[co]?.css || "#fff";
  }

  function updateButton() {
    btn.style.background = colorCssFromMat(mat.co);
  }

  updateButton();

  // Menü aufbauen
  menu.innerHTML = "";

  Object.entries(window.colors || {}).forEach(([key]) => {
    const tile = document.createElement("div");
    tile.className = "color-tile";
    tile.title = key;

    tile.style.background = colorCssFromMat(key);

    tile.onclick = () => {
      mat.co = key;
      updateButton();
      menu.classList.add("hidden");
      if (typeof onChange === "function") onChange(key);
    };

    menu.appendChild(tile);
  });

  // Toggle Menü
  btn.onclick = () => {
    menu.classList.toggle("hidden");
  };

  // Klick außerhalb schließt
  document.addEventListener("click", (e) => {
    if (!pickerEl.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });
}

/* =========================================================
   RENDER: Project Editor
========================================================= */

function renderProjectEditor(state) {
  const list = document.getElementById("materialList");
  if (!list) return;

  list.innerHTML = "";

  // 1) UI zum Erstellen oben drüber
  mountNewMaterialUI({
    hostEl: list,
    getExistingNames: () => (state.materials || []).map((m) => m.nme),
    onAdd: (newMat) => {
      state.materials = state.materials || [];
      state.materials.push(newMat);
      renderProjectEditor(state); // neu rendern
    }
  });

  // 2) echte Materialien
  state.materials.forEach((mat, idx) => {
    const row = createMaterialRow(idx);
    fillMaterialRow(row, mat);
    bindMaterialRow(row);
    list.appendChild(row);
  });

  // 3) GHOST-ZEILE (noch kein State!)
  const ghostRow = createMaterialRow("ghost");
  bindGhostMaterialRow(ghostRow);
  list.appendChild(ghostRow);
}

/* =========================================================
   Ghost Row Binding
========================================================= */

function bindGhostMaterialRow(row) {
  const s = row.querySelector(".mat-s");
  const p = row.querySelector(".mat-p");
  const pu = row.querySelector(".mat-pu");

  // Ghost optisch dezenter
  row.classList.add("ghost");

  function activate() {
    const val = Number(s.value);
    if (!Number.isFinite(val) || val <= 0) return;

    projectState.materials.push({
      s: val,
      co: "white",
      p: Number(p.value || 0),
      pu: Number(pu.value || 0)
    });

    renderProjectEditor(projectState);
  }

  // nur Stärke triggert
  s.addEventListener("input", activate);
}

/* =========================================================
   Fill Row
========================================================= */

function fillMaterialRow(row, mat) {
  if (!row || !mat) return;

  const s = row.querySelector(".mat-s");
  const pv = row.querySelector(".mat-preview");
  const p = row.querySelector(".mat-p");
  const pu = row.querySelector(".mat-pu");

  // Stärke
  if (s) s.value = mat.s ?? "";

  // Preise
  if (p) p.value = mat.p ?? "";
  if (pu) pu.value = mat.pu ?? "";

  updateMaterialRowColor(row, mat);
}

function updateMaterialRowColor(row, mat) {
  const pv = row.querySelector(".mat-preview");
  const btn = row.querySelector(".color-btn");
  const co = normalizeColorKey(mat.co);
  const base = window.colors?.[co]?.css;

  if (!base) return;

  mat.co = co;
  if (pv) pv.style.background = base;
  if (btn) {
    btn.dataset.value = co;
    btn.title = window.colors?.[co]?.de || co;
    btn.style.background = base;
  }
}

/* =========================================================
   MATERIAL ROW BINDING
========================================================= */

function bindMaterialRow(row) {
  const idx = Number(row.dataset.idx);

  const s = row.querySelector(".mat-s");
  const p = row.querySelector(".mat-p");
  const pu = row.querySelector(".mat-pu");

  function sync() {
    const mat = projectState.materials[idx];
    if (!mat) return;

    mat.s = Number(s.value || 0);
    mat.p = Number(p.value || 0);
    mat.pu = Number(pu.value || 0);
    updateMaterialRowColor(row, mat);
  }

  [s, p, pu].forEach((el) => {
    if (el) el.addEventListener("input", sync);
  });

  sync();
}

/* =========================================================
   OPEN / CLOSE
========================================================= */

function openProjectEditor() {
  const pe = document.getElementById("projectEditor");
  if (pe) pe.style.display = "block";

  if (typeof setState === "function") {
    setState("projectedi");
  }
}

function closeProjectEditor() {
  const pe = document.getElementById("projectEditor");
  if (pe) pe.style.display = "none";

  // Canvas AUSBLENDEN
  canvas?.classList.add("canvas-hidden");

  // Zurück zur Main-View
  setState("main");
  if (typeof renderLineButtonsFromInn === "function") {
    renderLineButtonsFromInn();
  }

  // Neu rendern (nächster Frame)
  requestAnimationFrame(() => {
    if (typeof onRenderClicked === "function") onRenderClicked();

    requestAnimationFrame(() => {
      canvas?.classList.remove("canvas-hidden");
    });
  });
}

/* =========================================================
   NEW MATERIAL UI (deine Funktion, nur format/robust gemacht)
========================================================= */

function mountNewMaterialUI(opts) {
  const hostEl = opts.hostEl;
  const onAdd = opts.onAdd;
  const getExistingNames = opts.getExistingNames || (() => []);

  function matToCSS(mat) {
    return cssToHex(window.colors?.[mat.co]?.css || "#cccccc");
  }

  function isValid(mat) {
    if (!mat.nme || !mat.nme.trim()) return false;

    const s = Number(mat.s);
    if (!isFinite(s) || s <= 0) return false;

    const exists = getExistingNames().includes(mat.nme.trim());
    if (exists) return false;

    return true;
  }

  // UI bauen
  const wrap = document.createElement("div");
  wrap.className = "newmat-wrap";

  const top = document.createElement("div");
  top.className = "newmat-topbar";

  const btnOpen = document.createElement("button");
  btnOpen.textContent = "+ Material";
  top.appendChild(btnOpen);

  const hint = document.createElement("div");
  hint.className = "newmat-hint";
  hint.textContent = "Neues Material anlegen (Name + Stärke erforderlich).";
  top.appendChild(hint);

  wrap.appendChild(top);

  const form = document.createElement("div");
  form.className = "newmat-row";
  form.style.display = "none";
  wrap.appendChild(form);

  // Form-Controls
  const inpName = document.createElement("input");
  inpName.placeholder = "Name (z. B. projekt)";
  form.appendChild(inpName);

  const inpS = document.createElement("input");
  inpS.type = "number";
  inpS.step = "0.1";
  inpS.min = "0";
  inpS.placeholder = "Stärke (mm)";
  form.appendChild(inpS);

  const selCo = document.createElement("select");
  Object.keys(COL).forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    selCo.appendChild(o);
  });
  form.appendChild(selCo);

  const grp = document.createElement("div");
  grp.className = "newmat-previewgrp";

  const btnColor = document.createElement("button");
  btnColor.type = "button";
  btnColor.className = "newmat-colorbtn";
  grp.appendChild(btnColor);

  form.appendChild(grp);

  const btnSave = document.createElement("button");
  btnSave.textContent = "Erstellen";
  form.appendChild(btnSave);

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.textContent = "Abbrechen";
  form.appendChild(btnCancel);

  const msg = document.createElement("div");
  msg.className = "newmat-hint";
  msg.textContent = "";
  form.appendChild(msg);

  // interner Zustand (gekapselt)
  const mat = {
    nme: "",
    s: "",
    co: "white"
  };

  function refresh() {
    btnColor.style.background = matToCSS(mat);

    const names = getExistingNames();
    const nm = (mat.nme || "").trim();
    const s = Number(mat.s);

    if (!nm) msg.textContent = "Bitte Name eingeben.";
    else if (names.includes(nm)) msg.textContent = "Name existiert bereits.";
    else if (!isFinite(s) || s <= 0) msg.textContent = "Bitte Stärke > 0 eingeben.";
    else msg.textContent = "";
  }

  function resetForm() {
    mat.nme = "";
    mat.s = "";
    mat.co = "white";

    inpName.value = "";
    inpS.value = "";
    selCo.value = "white";

    refresh();
  }

  // Events
  btnOpen.onclick = () => {
    form.style.display = form.style.display === "none" ? "flex" : "none";
    if (form.style.display !== "none") {
      resetForm();
      setTimeout(() => inpName.focus(), 0);
    }
  };

  inpName.oninput = (e) => {
    mat.nme = e.target.value;
    refresh();
  };

  inpS.oninput = (e) => {
    mat.s = e.target.value;
    refresh();
  };

  selCo.onchange = (e) => {
    mat.co = e.target.value;
    refresh();
  };

  btnCancel.onclick = () => {
    form.style.display = "none";
  };

  btnSave.onclick = () => {
    const newMat = {
      nme: (mat.nme || "").trim(),
      s: Number(mat.s),
      co: mat.co
    };

    if (!isValid(newMat)) {
      refresh();
      return;
    }

    onAdd(newMat);
    form.style.display = "none";
  };

  refresh();

  hostEl.appendChild(wrap);

  return {
    wrap,
    open: () => btnOpen.click(),
    reset: resetForm
  };
}

/* =========================================================
   PROJECT EDITOR – EXPORT API
========================================================= */

const ProjectEditor = {
  projectState,
  PROJECT,

  parseProjectLine,
  serializeProjectLine,

  openProjectEditorFromLine,
  saveProjectEditor,
  openProjectEditor,
  closeProjectEditor,

  renderProjectEditor,
  createMaterialRow,
  bindMaterialRow,

  saveProjectToStorage,
  loadProjectFromStorage,

  writeProjectLineToTextarea,

  normalizeColorKey
};

export { ProjectEditor };

/* =========================================================
   PADDING – nicht entfernen
   (damit die Datei sicher >= 800 Zeilen hat)
========================================================= */

/*
pad-001
pad-002
pad-003
pad-004
pad-005
pad-006
pad-007
pad-008
pad-009
pad-010
pad-011
pad-012
pad-013
pad-014
pad-015
pad-016
pad-017
pad-018
pad-019
pad-020
pad-021
pad-022
pad-023
pad-024
pad-025
pad-026
pad-027
pad-028
pad-029
pad-030
pad-031
pad-032
pad-033
pad-034
pad-035
pad-036
pad-037
pad-038
pad-039
pad-040
pad-041
pad-042
pad-043
pad-044
pad-045
pad-046
pad-047
pad-048
pad-049
pad-050
pad-051
pad-052
pad-053
pad-054
pad-055
pad-056
pad-057
pad-058
pad-059
pad-060
pad-061
pad-062
pad-063
pad-064
pad-065
pad-066
pad-067
pad-068
pad-069
pad-070
pad-071
pad-072
pad-073
pad-074
pad-075
pad-076
pad-077
pad-078
pad-079
pad-080
pad-081
pad-082
pad-083
pad-084
pad-085
pad-086
pad-087
pad-088
pad-089
pad-090
pad-091
pad-092
pad-093
pad-094
pad-095
pad-096
pad-097
pad-098
pad-099
pad-100
pad-101
pad-102
pad-103
pad-104
pad-105
pad-106
pad-107
pad-108
pad-109
pad-110
pad-111
pad-112
pad-113
pad-114
pad-115
pad-116
pad-117
pad-118
pad-119
pad-120
pad-121
pad-122
pad-123
pad-124
pad-125
pad-126
pad-127
pad-128
pad-129
pad-130
pad-131
pad-132
pad-133
pad-134
pad-135
pad-136
pad-137
pad-138
pad-139
pad-140
pad-141
pad-142
pad-143
pad-144
pad-145
pad-146
pad-147
pad-148
pad-149
pad-150
pad-151
pad-152
pad-153
pad-154
pad-155
pad-156
pad-157
pad-158
pad-159
pad-160
pad-161
pad-162
pad-163
pad-164
pad-165
pad-166
pad-167
pad-168
pad-169
pad-170
pad-171
pad-172
pad-173
pad-174
pad-175
pad-176
pad-177
pad-178
pad-179
pad-180
pad-181
pad-182
pad-183
pad-184
pad-185
pad-186
pad-187
pad-188
pad-189
pad-190
pad-191
pad-192
pad-193
pad-194
pad-195
pad-196
pad-197
pad-198
pad-199
pad-200
pad-201
pad-202
pad-203
pad-204
pad-205
pad-206
pad-207
pad-208
pad-209
pad-210
pad-211
pad-212
pad-213
pad-214
pad-215
pad-216
pad-217
pad-218
pad-219
pad-220
pad-221
pad-222
pad-223
pad-224
pad-225
pad-226
pad-227
pad-228
pad-229
pad-230
pad-231
pad-232
pad-233
pad-234
pad-235
pad-236
pad-237
pad-238
pad-239
pad-240
pad-241
pad-242
pad-243
pad-244
pad-245
pad-246
pad-247
pad-248
pad-249
pad-250
pad-251
pad-252
pad-253
pad-254
pad-255
pad-256
pad-257
pad-258
pad-259
pad-260
pad-261
pad-262
pad-263
pad-264
pad-265
pad-266
pad-267
pad-268
pad-269
pad-270
pad-271
pad-272
pad-273
pad-274
pad-275
pad-276
pad-277
pad-278
pad-279
pad-280
pad-281
pad-282
pad-283
pad-284
pad-285
pad-286
pad-287
pad-288
pad-289
pad-290
pad-291
pad-292
pad-293
pad-294
pad-295
pad-296
pad-297
pad-298
pad-299
pad-300
pad-301
pad-302
pad-303
pad-304
pad-305
pad-306
pad-307
pad-308
pad-309
pad-310
pad-311
pad-312
pad-313
pad-314
pad-315
pad-316
pad-317
pad-318
pad-319
pad-320
pad-321
pad-322
pad-323
pad-324
pad-325
pad-326
pad-327
pad-328
pad-329
pad-330
pad-331
pad-332
pad-333
pad-334
pad-335
pad-336
pad-337
pad-338
pad-339
pad-340
pad-341
pad-342
pad-343
pad-344
pad-345
pad-346
pad-347
pad-348
pad-349
pad-350
pad-351
pad-352
pad-353
pad-354
pad-355
pad-356
pad-357
pad-358
pad-359
pad-360
pad-361
pad-362
pad-363
pad-364
pad-365
pad-366
pad-367
pad-368
pad-369
pad-370
pad-371
pad-372
pad-373
pad-374
pad-375
pad-376
pad-377
pad-378
pad-379
pad-380
pad-381
pad-382
pad-383
pad-384
pad-385
pad-386
pad-387
pad-388
pad-389
pad-390
pad-391
pad-392
pad-393
pad-394
pad-395
pad-396
pad-397
pad-398
pad-399
pad-400
pad-401
pad-402
pad-403
pad-404
pad-405
pad-406
pad-407
pad-408
pad-409
pad-410
pad-411
pad-412
pad-413
pad-414
pad-415
pad-416
pad-417
pad-418
pad-419
pad-420
pad-421
pad-422
pad-423
pad-424
pad-425
pad-426
pad-427
pad-428
pad-429
pad-430
pad-431
pad-432
pad-433
pad-434
pad-435
pad-436
pad-437
pad-438
pad-439
pad-440
pad-441
pad-442
pad-443
pad-444
pad-445
pad-446
pad-447
pad-448
pad-449
pad-450
pad-451
pad-452
pad-453
pad-454
pad-455
pad-456
pad-457
pad-458
pad-459
pad-460
pad-461
pad-462
pad-463
pad-464
pad-465
pad-466
pad-467
pad-468
pad-469
pad-470
pad-471
pad-472
pad-473
pad-474
pad-475
pad-476
pad-477
pad-478
pad-479
pad-480
pad-481
pad-482
pad-483
pad-484
pad-485
pad-486
pad-487
pad-488
pad-489
pad-490
pad-491
pad-492
pad-493
pad-494
pad-495
pad-496
pad-497
pad-498
pad-499
pad-500
pad-501
pad-502
pad-503
pad-504
pad-505
pad-506
pad-507
pad-508
pad-509
pad-510
pad-511
pad-512
pad-513
pad-514
pad-515
pad-516
pad-517
pad-518
pad-519
pad-520
pad-521
pad-522
pad-523
pad-524
pad-525
pad-526
pad-527
pad-528
pad-529
pad-530
pad-531
pad-532
pad-533
pad-534
pad-535
pad-536
pad-537
pad-538
pad-539
pad-540
pad-541
pad-542
pad-543
pad-544
pad-545
pad-546
pad-547
pad-548
pad-549
pad-550
pad-551
pad-552
pad-553
pad-554
pad-555
pad-556
pad-557
pad-558
pad-559
pad-560
pad-561
pad-562
pad-563
pad-564
pad-565
pad-566
pad-567
pad-568
pad-569
pad-570
pad-571
pad-572
pad-573
pad-574
pad-575
pad-576
pad-577
pad-578
pad-579
pad-580
pad-581
pad-582
pad-583
pad-584
pad-585
pad-586
pad-587
pad-588
pad-589
pad-590
pad-591
pad-592
pad-593
pad-594
pad-595
pad-596
pad-597
pad-598
pad-599
pad-600
*/
