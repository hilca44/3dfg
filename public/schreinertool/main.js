import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { Proj } from "./proj-client.js";
import {
    urlToInn,
    urlToInnCurrent,
    innToUrl,
    setUrlNoReload,
    parseCornerRef,
    parseCornerSpec

} from "./fu.js";



/* =========================================================
   GLOBALS
========================================================= */

let camera, scene, renderer, labelRenderer, controls;
let bb = { x: 0, y: 0, z: 0 };
let container;
let resTracker;
let meshMap = {};
let state = {};

window.lus = [];
const renderHistory = [];


let editor = null;


function parseValue(v) {
  if (v == null) return v;

  v = String(v).trim();

  // -------- LISTE --------
  if (v.includes(",")) {
    return v.split(",").map(x => parseValue(x));
  }

  // -------- ZAHL --------
  if (!isNaN(v)) {
    return Number(v);
  }

  // -------- BOOL (optional) --------
  if (v === "true") return true;
  if (v === "false") return false;

  // -------- AUSDRUCK (roh lassen!) --------
  if (v.startsWith("(") && v.endsWith(")")) {
    return v; // später eval
  }

  // -------- STRING --------
  return v;
}








function resolveCornerMesh(baseMesh, partKey) {
    if (!baseMesh || !partKey) return baseMesh;

    const partMesh = findPartMesh(baseMesh, partKey);

    if (!partMesh) {
        console.warn("Part-Mesh nicht gefunden:", partKey, "in", baseMesh.name);
        return baseMesh;
    }

    return partMesh;
}




function getEditor() {
    if (!editor) {
        editor = document.getElementById("inn");
        if (!editor) {
            throw new Error("Editor #inn nicht gefunden");
        }
    }
    return editor;
}


function showBackButton(v) {
    document.getElementById("btnBack").style.display = v ? "block" : "none";
}
window.showBackButton = showBackButton


function pushCurrentState() {
    renderHistory.push({
        editorText: getEditor().value,
        camera: {
            pos: camera.position.clone(),
            rot: camera.rotation.clone(),
            target: controls.target.clone()
        }
    });
}

export async function openDWGInline(dwgKey) {

    pushCurrentState();           // 🔐 sichern
    showBackButton(true);         // 👈 Button einblenden

    const url = await loadURLfromDWG(dwgKey);
    // const txt = await fetch(url).then(r => r.text());
    editor.value = urlToInn(url)
    // updateURL()
    // await magie()
    // window.location.href=url
    renderMainWithDWGs(editor.value);      // 🔁 normaler Renderer
}

window.openDWGInline = openDWGInline

function goBackToPrevious() {

    if (renderHistory.length === 0) return;

    const prev = renderHistory.pop();

    editor.value = prev.editorText;
    renderMainWithDWGs(prev.editorText);

    camera.position.copy(prev.camera.pos);
    camera.rotation.copy(prev.camera.rot);
    controls.target.copy(prev.camera.target);
    controls.update();

    if (renderHistory.length === 0) {
        showBackButton(false);
    }
}
window.goBackToPrevious = goBackToPrevious



function getInn() {
    return document.getElementById("inn");

}

function loadFromQueryOrDefault() {
    const inn = urlToInnCurrent();
    return {
        name: extractProjectNameFromInn(inn),
        inn
    };
}



function updateURL() {
    let inn = window.document.getElementById("inn").value

    history.replaceState(null, "", innToUrl(inn));

}

function updateAndReloadURL() {
    let inn = window.document.getElementById("inn").value

    let urlFromInn = innToUrl(inn)
    if (window.location.href != urlFromInn) {
        window.location.href = urlFromInn

    }

}



export function extractProjectNameFromInn(txt) {
    const m = txt.trim().match(/^([a-z0-9_-]+)/i);
    return m ? m[1] : "project";
}
window.extractProjectNameFromInn = extractProjectNameFromInn




/* =========================================================
   LUS PERSISTENZ
========================================================= */

function initLUS() {
    const saved = localStorage.getItem("lus");
    window.lus = saved ? JSON.parse(saved) : [];
}

function restoreLUS() {
    const vals = JSON.parse(localStorage.getItem("lus_values") || "{}");
    const cont = document.getElementById("dwg_container");
    if (!cont) return;

    for (const id of window.lus) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = id;
        inp.size = 12;
        inp.placeholder = "dwg url";
        inp.value = vals[id] || "";
        inp.addEventListener("input", saveLUSValues);
        cont.appendChild(inp);
    }
}

function saveLUSValues() {
    const data = {};
    for (const id of window.lus) {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
    }
    localStorage.setItem("lus_values", JSON.stringify(data));
}

initLUS();
restoreLUS();

/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function cc(v, def = 0) {
    if (v == null || v === "") return def;
    if (typeof v === "number") return Number.isFinite(v) ? v : def;
    if (Array.isArray(v)) return cc(v[0], def);

    let s = normalizeSequenceToken(v);
    if (s.includes(",")) return cc(s.split(",")[0], def);
    const rest = s.match(/^(-?\d+(?:\.\d+)?)rest$/i);
    if (rest) return Number(rest[1]);
    const gap = s.match(/^g(-?\d+(?:\.\d+)?)$/i) || s.match(/^(-?\d+(?:\.\d+)?)g$/i);
    if (gap) return Number(gap[1]);
    const n = Number(s);
    if (Number.isFinite(n)) return n;

    if (/^[0-9+\-*/().\s]+$/.test(s) && /[0-9]/.test(s)) {
        try {
            const r = Function('"use strict"; return (' + s + ')')();
            if (Number.isFinite(r)) return r;
        } catch {
            // fall through to warning below
        }
    }

    if (window.C3_DEBUG_NUMERIC) {
        console.warn("Invalid numeric value:", v);
    }
    return def;
}

function partDim(v, label) {
    const n = cc(v, NaN);
    if (Number.isFinite(n) && n > 0) return n;

    if (window.C3_DEBUG_NUMERIC) {
        console.warn("Invalid part dimension:", label, v);
    }
    return 0.001;
}

function collapseNumericSequence(value) {
    if (Array.isArray(value)) return collapseNumericSequence(value[0]);
    const text = normalizeSequenceToken(value);
    if (text.includes(",")) return collapseNumericSequence(text.split(",")[0]);
    const rest = text.match(/^(-?\d+(?:\.\d+)?)rest$/i);
    if (rest) return Number(rest[1]);
    const gap = text.match(/^g(-?\d+(?:\.\d+)?)$/i) || text.match(/^(-?\d+(?:\.\d+)?)g$/i);
    if (gap) return Math.abs(Number(gap[1]));
    const n = Number(text);
    return Number.isFinite(n) ? n : value;
}

function normalizeRenderablePart(part) {
    if (!part) return part;
    for (const key of ["w", "d", "h", "x", "y", "z"]) {
        if (Array.isArray(part[key]) || String(part[key] ?? "").includes(",")) {
            part[key] = collapseNumericSequence(part[key]);
        }
    }
    return part;
}

function normalizeSequenceToken(value) {
    return String(value ?? "").trim().replace(/\([^()]*\)\s*$/g, "").trim();
}

function isSequenceValue(key, value) {
    if (Array.isArray(value)) return true;
    const text = String(value ?? "").trim();
    if (!text) return false;
    return text.includes(",");
}

function sequenceValues(value) {
    return Array.isArray(value)
        ? value
        : String(value ?? "").split(",").map(part => part.trim()).filter(Boolean);
}

function sequenceSegments(values, fullDim = 1) {
    const out = [];
    let offset = 0;

    const slash = normalizeSequenceToken(values[0]).match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (slash) {
        const count = Math.max(1, Math.floor(Number(slash[1])));
        const gapEntry = values.slice(1).map(value => normalizeSequenceToken(value)).find(value => /^g-?\d|^-?\d+(?:\.\d+)?g$/i.test(value));
        const gap = gapEntry ? Math.abs(Number(gapEntry.replace(/^g/i, "").replace(/g$/i, ""))) : 0;
        const denominator = Number(slash[2]);
        const size = denominator > 0 ? Number(fullDim || 0) / denominator : 0;
        return Array.from({ length: count }, (_, index) => ({
            value: size,
            offset: index * (size + gap)
        })).filter(segment => Number.isFinite(segment.value) && segment.value > 0);
    }

    const entries = [];
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        const text = normalizeSequenceToken(value);
        const gap = text.match(/^g?(-?\d+(?:\.\d+)?)g?$/i);
        const n = Number(text);

        if (/^g-?\d+(?:\.\d+)?$/i.test(text) || /^-?\d+(?:\.\d+)?g$/i.test(text)) {
            const amount = Math.abs(Number(text.replace(/^g/i, "").replace(/g$/i, "")));
            if (Number.isFinite(amount)) entries.push({ type: "globalGap", value: amount });
            continue;
        }

        if (n < 0) {
            const amount = Math.abs(n);
            if (Number.isFinite(amount)) entries.push({ type: "gap", value: amount });
            continue;
        }

        if (!Number.isFinite(n)) continue;
        entries.push(index === values.length - 1 && n === 1
            ? { type: "rest", weight: 1 }
            : { type: "segment", value: n });
    }
    const globalGap = entries.find(entry => entry.type === "globalGap")?.value || 0;
    const layoutEntries = entries.filter(entry => entry.type !== "globalGap");

    const used = layoutEntries.reduce((sum, entry) => (
        entry.type === "segment" || entry.type === "gap" ? sum + entry.value : sum
    ), 0);
    const segmentCount = layoutEntries.filter(entry => entry.type === "segment" || entry.type === "rest").length;
    const restWeight = layoutEntries.reduce((sum, entry) => sum + (entry.type === "rest" ? entry.weight : 0), 0);
    const restTotal = Math.max(0, Number(fullDim || 0) - used - globalGap * Math.max(0, segmentCount - 1));

    for (let i = 0; i < layoutEntries.length; i++) {
        const entry = layoutEntries[i];
        if (entry.type === "gap") {
            offset += entry.value;
            continue;
        }
        const value = entry.type === "rest" && restWeight
            ? restTotal * entry.weight / restWeight
            : entry.value;
        out.push({ value, offset });
        offset += value;
        if (globalGap && layoutEntries.slice(i + 1).some(next => next.type === "segment" || next.type === "rest")) {
            offset += globalGap;
        }
    }

    return out;
}

function normalizeProjectPartArrays(pr) {
    const axisByDim = { w: "x", d: "y", h: "z" };
    const keys = ["w", "d", "h", "x", "y", "z"];

    for (const k of Object.values(pr?.oks || {})) {
        if (!Array.isArray(k?.jj)) continue;

        for (const partName of [...k.jj]) {
            const part = k[partName];
            if (!part) continue;

            const dimKey = ["w", "d", "h"].find(key => isSequenceValue(key, part[key]));
            const posKey = ["x", "y", "z"].find(key => isSequenceValue(key, part[key]));
            if (!dimKey && !posKey) continue;

            const axis = dimKey ? axisByDim[dimKey] : posKey;
            const original = structuredClone(part);
            const sequences = {};
            for (const key of keys) {
                if (isSequenceValue(key, original[key])) sequences[key] = sequenceValues(original[key]);
            }

            const segments = dimKey
                ? sequenceSegments(sequences[dimKey], cc(original["_" + dimKey + "Full"] ?? original[dimKey], 0))
                : sequences[posKey].map(value => {
                    const n = Number(normalizeSequenceToken(value));
                    return Number.isFinite(n) ? { value: n, offset: n } : null;
                }).filter(Boolean);
            if (!segments.length) continue;

            const countSequenceItems = (key, values) => {
                if (key === dimKey) return segments.length;
                if (["w", "d", "h"].includes(key) && dimKey && values.join(",") === sequences[dimKey]?.join(",")) {
                    return segments.length;
                }
                return values.length;
            };
            const itemCount = Math.max(
                segments.length,
                ...Object.entries(sequences).map(([key, values]) => countSequenceItems(key, values))
            );
            while (segments.length < itemCount) segments.push({ ...segments[segments.length - 1] });

            const originalPos = dimKey ? cc(original[axis]) : 0;
            const applyAt = (target, index, segment) => {
                for (const key of keys) {
                    const values = sequences[key];
                    if (!values) continue;
                    if (key === dimKey) {
                        target[key] = segment.value;
                    } else {
                        const n = Number(normalizeSequenceToken(values[index] ?? values[values.length - 1]));
                        target[key] = Number.isFinite(n)
                            ? n
                            : cc(Array.isArray(original[key]) ? original[key][0] : original[key]);
                    }
                }
                if (dimKey) target[axis] = originalPos + segment.offset;
            };

            applyAt(part, 0, segments[0]);

            for (let i = 1; i < itemCount; i++) {
                const clone = structuredClone(original);
                clone.nme = `${original.nme || partName}${i}${axis}`;
                applyAt(clone, i, segments[i]);
                clone.nx = [1, 0];
                clone.ny = [1, 0];
                clone.nz = [1, 0];
                const cloneName = `${partName}${i}${axis}`;
                k[cloneName] = clone;
                if (!k.jj.includes(cloneName)) k.jj.push(cloneName);
            }
        }
    }
}

function renderablePartCount(pr) {
    const names = pr?.jj?.length ? pr.jj : Object.keys(pr?.oks || {});
    return names.reduce((sum, name) => {
        const k = pr?.oks?.[name];
        if (!k) return sum;
        if (k.type === "part") return sum + 1;
        if (isExpandedTextKorpus(k)) return sum + 1;
        if (!Array.isArray(k.jj)) return sum;
        return sum + k.jj.filter(partName => k[partName]).length;
    }, 0);
}

function markLimitedRenderableParts(pr, limit) {
    const max = Number(limit);
    if (!pr?.oks || !Number.isFinite(max) || max <= 0) return pr;

    const names = pr.jj?.length ? pr.jj : Object.keys(pr.oks || {});
    let solidCount = 0;
    let edgeOnlyCount = 0;

    for (const name of names) {
        const k = pr.oks[name];
        if (!k) continue;

        if (k.type === "part" || isExpandedTextKorpus(k)) {
            if (solidCount < max) {
                solidCount++;
            } else if (edgeOnlyCount < LIMITED_EDGE_PREVIEW_COUNT) {
                k.__edgeOnly = true;
                edgeOnlyCount++;
            } else {
                k.__skipRender = true;
            }
            continue;
        }

        if (!Array.isArray(k.jj)) continue;

        for (const partName of k.jj) {
            if (!k[partName]) continue;
            if (solidCount < max) {
                solidCount++;
            } else if (edgeOnlyCount < LIMITED_EDGE_PREVIEW_COUNT) {
                k[partName].__edgeOnly = true;
                edgeOnlyCount++;
            } else {
                k[partName].__skipRender = true;
            }
        }
    }

    pr.partLimitExceeded = {
        ...(pr.partLimitExceeded || {}),
        rendered: solidCount,
        edgeOnly: edgeOnlyCount,
        limit: max
    };

    return pr;
}

function resetBB() {
    bb.x = 0;
    bb.y = 0;
    bb.z = 0;
}

/* =========================================================
   RESOURCE TRACKER
========================================================= */

class ResourceTracker {
    constructor() { this.resources = new Set(); }
    track(r) { this.resources.add(r); return r; }
    dispose() {
        for (const r of this.resources) {
            if (r.parent) r.parent.remove(r);
            if (r.dispose) r.dispose();
        }
        this.resources.clear();
    }
}
async function loadInputFromDWGName(name) {
    if (!name) return "";

    const res = await fetch("/dwg/" + name + ".txt");
    if (!res.ok) {
        console.warn("DWG not found:", name);
        return "";
    }

    const url = (await res.text()).trim();
    if (!url) return "";

    return urlToInn(url);
}





/* =========================================================
   URL → CAD TEXT
========================================================= */

async function loadURLfromDWG(dwgName) {
    if (!dwgName) return "";

    const res = await fetch(`/dwg/${dwgName}.txt`);
    if (!res.ok) {
        console.warn("DWG not found:", dwgName);
        return "";
    }

    const raw = await res.text();
    const firstLine = raw.split(/\r?\n/)[0].trim();

    return firstLine; // ← DAS ist die URL
}




function loadFromURL(url) {
    if (!url) return "";
    const text = String(url).trim();
    const fullUrl = text.includes("?")
        ? text
        : `${window.location.origin}${window.location.pathname}?${text.replace(/^\?/, "")}`;
    return urlToInn(fullUrl);
}

function loadFromURL_anyKey(url) {
    return loadFromURL(url);
}


const anchorMarkers = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const SCENE_CLICK_DRAG_THRESHOLD = 6;
let scenePointerDown = null;
let selectedAnchor = null;
let selectedPartMesh = null;
let partInspector = null;
let selectedPartOutline = null;
let selectedKorpusOutline = null;
let selectedKorpusVisibleOutline = null;
let projectLabel = null;
let projectSummaryPanel = null;
let treeRenderOverlay = null;
let treeRenderDirection = "z";
let treeRenderColoredParts = new Map();
let treeRenderSavedBackground = null;
let editorViewMode = "normal";

function getRenderSquareSize() {
    const host = document.getElementById("slot1") || container;
    const rect = host?.getBoundingClientRect?.();
    const q = Math.floor(Math.min(rect?.width || 0, rect?.height || 0));
    return q > 1 ? q : Math.floor(Math.min(window.innerWidth, window.innerHeight));
}

function setRendererSquareSize() {
    if (!renderer || !labelRenderer || !camera) return 0;
    const q = getRenderSquareSize();

    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.setSize(q, q);
    labelRenderer.setSize(q, q);
    renderer.domElement.style.width = `${q}px`;
    renderer.domElement.style.height = `${q}px`;
    labelRenderer.domElement.style.width = `${q}px`;
    labelRenderer.domElement.style.height = `${q}px`;

    return q;
}
/* =========================================================
   THREE SCENE SETUP
========================================================= */
function initThree() {

    container = document.getElementById("canvas");
    container.style.position = "relative";

    if (renderer && labelRenderer && scene && camera) {
        setRendererSquareSize();
        return;
    }

    container
        .querySelectorAll("canvas, .c3-label-renderer")
        .forEach(el => el.remove());

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#8a8b88");

    camera = new THREE.PerspectiveCamera(50, 2, 2, 100000);
    camera.up.set(0, 0, 1);
    // ✅ Kamera soll alle Korpus-Layer sehen
    camera.layers.enable(0);
    camera.layers.enable(1);
    camera.layers.enable(2);
    camera.layers.enable(3);
    camera.layers.enable(4);
    raycaster.layers.enable(0);
    raycaster.layers.enable(1);
    raycaster.layers.enable(2);
    raycaster.layers.enable(3);
    raycaster.layers.enable(4);

    scene.add(camera);

    const q = getRenderSquareSize();


    const amb = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(amb);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfd4c8, 0.85);
    hemi.position.set(0, 0, 1);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.45);
    dir.position.set(-450, -650, 900);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -2200;
    dir.shadow.camera.right = 2200;
    dir.shadow.camera.top = 2200;
    dir.shadow.camera.bottom = -2200;
    dir.shadow.camera.near = 10;
    dir.shadow.camera.far = 3500;
    dir.shadow.bias = -0.00008;
    scene.add(dir);

    const axes = new THREE.AxesHelper(120);
    axes.name = "scene_axes_helper";
    scene.add(axes);

    const grid = new THREE.GridHelper(1000, 100, 0x8f9690, 0xd4d8d2);
    grid.name = "scene_floor_grid";
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of gridMaterials) {
        material.transparent = true;
        material.opacity = 0.45;
        material.depthWrite = false;
    }
    scene.add(grid);

    const shadowFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(6000, 6000),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 })
    );
    shadowFloor.name = "scene_shadow_floor";
    shadowFloor.receiveShadow = true;
    shadowFloor.rotation.x = 0;
    shadowFloor.position.z = -0.2;
    scene.add(shadowFloor);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    console.log(
        renderer.getClearColor(new THREE.Color()).getHexString(),
        renderer.getClearAlpha()
    );
    renderer.setSize(q, q);
    container.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(q, q);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.left = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    labelRenderer.domElement.style.zIndex = "10";   // 🔥 entscheidend
    labelRenderer.domElement.classList.add("c3-label-renderer");


    container.appendChild(labelRenderer.domElement);
    const mat = new THREE.MeshBasicMaterial({ color: "red" });
    ensureProjectLabel();

    controls = new OrbitControls(camera, renderer.domElement);
    renderer.domElement.addEventListener("pointerdown", rememberScenePointerDown);
    // 🔴 HARTER SICHTBARKEITS-TEST
    // const testGeo = new THREE.BoxGeometry(100, 100, 100);
    // const testMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    // const testMesh = new THREE.Mesh(testGeo, testMat);
    // scene.add(testMesh);



    // Kamera brutal festsetzen
    camera.position.set(200, -200, 200);
    camera.lookAt(0, 0, 0);
    renderer.domElement.addEventListener("click", onSceneClick);

}

function rememberScenePointerDown(event) {
    scenePointerDown = {
        x: event.clientX,
        y: event.clientY
    };
}

function wasSceneDrag(event) {
    if (!scenePointerDown) return false;

    const distance = Math.hypot(
        event.clientX - scenePointerDown.x,
        event.clientY - scenePointerDown.y
    );

    return distance > SCENE_CLICK_DRAG_THRESHOLD;
}

function ensurePartInspector() {
    if (partInspector) return partInspector;

    partInspector = document.createElement("div");
    partInspector.id = "partInspector";
    partInspector.style.cssText = [
        "width:100%",
        "height:100%",
        "overflow:auto",
        "box-sizing:border-box",
        "background:#fff",
        "padding:10px",
        "font:12px system-ui,sans-serif",
        "display:none"
    ].join(";");
    partInspector.className = "view";

    const editor = document.getElementById("inn");
    editor?.parentElement?.appendChild(partInspector);
    return partInspector;
}


function resolveThreeColor(co, l) {

    const entry = window.colors?.[co];
    const baseCss = entry ? entry.css : "white";

    let col;
    try {
        col = new THREE.Color(baseCss);
    } catch (err) {
        console.warn("Invalid color css:", co, baseCss, err);
        col = new THREE.Color("white");
    }
    const f = lightFactorFromL(l);

    col.multiplyScalar(f); // 🔥 DAS ist die Helligkeit

    return col;
}


function renderViewFlags(...values) {
    const flags = new Set();

    for (const value of values) {
        if (value == null) continue;
        const parts = Array.isArray(value)
            ? value
            : String(value).split(/[,\s+]+/);

        for (const part of parts) {
            const flag = String(part || "").trim().toLowerCase();
            if (flag) flags.add(flag);
        }
    }

    return flags;
}

function renderTransparencyFromFlags(flags) {
    for (const flag of flags) {
        const m = String(flag).match(/^t([0-9])$/);
        if (m) return Math.max(0.02, 1 - Number(m[1]) / 10);
    }
    return null;
}

function hasDimViewFlag(value) {
    return renderViewFlags(value).has("dim");
}

function createMaterialForPart(mat, viewSpec = "") {
    mat = mat || window.PR?.lm?.[1] || { co: "wh", l: "m" };
    const flags = renderViewFlags(viewSpec);
    const opacity = renderTransparencyFromFlags(flags);

    const color = flags.has("nc")
        ? new THREE.Color("#f4f4f0")
        : resolveThreeColor(mat.co, mat.l);

    return resTracker.track(
        new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: opacity ?? (flags.has("wf") ? 0.32 : 0.90),
            wireframe: flags.has("wf")
        })
    );
}

/* =========================================================
   KORPUS / PARTS
========================================================= */

let edgmat = new THREE.LineBasicMaterial({ color: 0x000000 });
let limitedEdgeMat = new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.7 });
const LIMITED_EDGE_PREVIEW_COUNT = 10;


function makeL(k, ownerGroup = null, options = {}) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(.1, 16, 16); // größer
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });

    const m = new THREE.Mesh(geo, mat);

    g.add(m);

    const el = document.createElement("div");
    el.className = "korpus-label";
    el.textContent = "";
    const nameEl = document.createElement("span");
    nameEl.textContent = k.comment || k.ali || k.nme;
    el.appendChild(nameEl);
    if (options.notice) {
        const noticeEl = document.createElement("small");
        noticeEl.textContent = options.notice;
        noticeEl.style.display = "block";
        noticeEl.style.marginTop = "2px";
        noticeEl.style.color = "#7a4d00";
        noticeEl.style.fontSize = "10pt";
        noticeEl.style.lineHeight = "1.2";
        el.appendChild(noticeEl);
    }
    el.title = k.w+","+k.d+","+k.h
    el.style.padding = "2px 6px";
    el.style.background = options.notice ? "#fff7e6" : "transparent";
    el.style.border = options.notice ? "1px solid #c98a00" : "1px solid #444";
    el.style.borderRadius = "4px";
    el.style.fontSize = "12pt";
    el.style.whiteSpace = "nowrap";
    el.style.cursor = "pointer";
    el.style.pointerEvents = "auto";
    el.addEventListener("click", event => {
        event.stopPropagation();
        showKorpusInspector(k, ownerGroup);
    });

    let lab = new CSS2DObject(el);
    lab.layers.set(2);

    const w = Number(k.w) || 0;
    const d = Number(k.d) || 0;
    const h = Number(k.h) || 0;
    lab.position.set(w * 0.5, Math.min(5, Math.max(1, d * 0.15)), h * 0.5);
    g.add(lab);

    return g;
}

function isExpandedTextKorpus(k) {
    return /^(?:txt\d+_|.+_txt)\d+/i.test(String(k?.nme || ""));
}

function lightFactorFromL(l) {
    if (!l) return 1;

    //   const idx = l.charCodeAt(0) - 97; // a=0 … z=25
    const idx = 12
    return 1.7 - idx * (1.4 / 25);   // hell → dunkel
}

function resolveThreeColorFromPR(e) {

    const entry = window.colors?.[e.co];
    const css = entry ? entry.css : "white";

    const col = new THREE.Color(css);
    col.multiplyScalar(lightFactorFromL(e.l));

    return col;
}

function rotationDeg(value) {
    return THREE.MathUtils.degToRad(Number(value) || 0);
}

function makePartLocalBB(w, d, h) {
    return new THREE.Box3(
        new THREE.Vector3(-w * 0.5, -d * 0.5, -h * 0.5),
        new THREE.Vector3(w * 0.5, d * 0.5, h * 0.5)
    );
}

function rotationPivotOffsetZ(localBB, angleRad, corner) {
    if (corner == null || !angleRad || !localBB) return new THREE.Vector3();

    const pivot = cornerFromBB(localBB, [corner]);
    const rotatedPivot = pivot.clone().applyEuler(new THREE.Euler(0, 0, angleRad));

    return pivot.sub(rotatedPivot);
}

function applyPartRotation(mesh, part, w, d, h) {
    const localBB = makePartLocalBB(w, d, h);
    const oz = rotationDeg(part?.oz);

    mesh.rotation.set(
        rotationDeg(part?.ox),
        rotationDeg(part?.oy),
        oz
    );
    mesh.position.copy(rotationPivotOffsetZ(localBB, oz, part?.ozc));
    mesh.userData.localBB = localBB;
}

function makeDimLabel(text, position) {
    const element = document.createElement("div");
    element.textContent = text;
    element.style.cssText = [
        "padding:2px 6px",
        "background:rgba(255,255,255,0.92)",
        "border:1px solid rgba(128,128,128,0.35)",
        "border-radius:3px",
        "font-size:11px",
        "color:#222",
        "white-space:nowrap",
        "pointer-events:none"
    ].join(";");

    const label = new CSS2DObject(element);
    label.position.copy(position);
    return label;
}

function makeDimensionHelper(w, d, h) {
    const halfW = w * 0.5;
    const halfD = d * 0.5;
    const halfH = h * 0.5;
    const offset = Math.max(4, Math.min(w, d, h) * 0.05);
    const positions = [
        // width dimension lines
        -halfW, -halfD - offset, -halfH,
         halfW, -halfD - offset, -halfH,
        -halfW,  halfD + offset, -halfH,
         halfW,  halfD + offset, -halfH,
        // depth dimension lines
        -halfW - offset, -halfD, -halfH,
        -halfW - offset,  halfD, -halfH,
         halfW + offset, -halfD, -halfH,
         halfW + offset,  halfD, -halfH,
        // height dimension lines
        -halfW - offset, -halfD - offset, -halfH,
        -halfW - offset, -halfD - offset,  halfH,
         halfW + offset,  halfD + offset, -halfH,
         halfW + offset,  halfD + offset,  halfH
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
        color: 0x2f2f2f,
        transparent: true,
        opacity: 0.75
    });

    const helper = new THREE.Group();
    const lines = new THREE.LineSegments(geometry, material);
    helper.add(lines);

    helper.add(makeDimLabel(`${Math.round(w * 100) / 100} cm`, new THREE.Vector3(0, -halfD - offset - 2, -halfH)));
    helper.add(makeDimLabel(`${Math.round(d * 100) / 100} cm`, new THREE.Vector3(-halfW - offset - 2, 0, -halfH)));
    helper.add(makeDimLabel(`${Math.round(h * 100) / 100} cm`, new THREE.Vector3(halfW + offset + 2, halfD + offset + 2, 0)));

    return helper;
}

function addDimensionHelper(object3d, w, d, h) {
    const helper = makeDimensionHelper(w, d, h);
    object3d.add(helper);
    object3d.userData.dimHelper = helper;
}

function makeM(k, e1, e) {
    e = normalizeRenderablePart(e);
    if (e.__skipRender) return new THREE.Group();
    const g = new THREE.Group();
    const lay = (e1 === "b") ? 3 : (e1 === "f" ? 4 : 2);

    const w = partDim(e.w, `${k.nme}.${e1}.w`),
        d = partDim(e.d, `${k.nme}.${e1}.d`),
        h = partDim(e.h, `${k.nme}.${e1}.h`);

    const geo = resTracker.track(
        new THREE.BoxGeometry(w, d, h)
    );

    if (e.__edgeOnly) {
        const edge = resTracker.track(new THREE.LineSegments(
            resTracker.track(new THREE.EdgesGeometry(geo)),
            limitedEdgeMat
        ));
        edge.name = e1;
        edge.userData.type = "part";
        edge.userData.korpusName = k.nme;
        edge.userData.partName = e1;
        edge.userData.partData = e;
        edge.userData.partGroup = g;
        edge.userData.edgeOnly = true;
        edge.layers.set(lay);

        applyPartRotation(edge, e, w, d, h);

        const key = k.nme + e1;
        meshMap[key] = edge;
        state[key] = "edgeOnly";

        const baseX = e1 == null ? 0 : cc(k.x);
        const baseY = e1 == null ? 0 : cc(k.y);
        const baseZ = e1 == null ? 0 : cc(k.z);

        g.position.set(
            (w * 0.5) + cc(e.x) - baseX,
            (d * 0.5) + cc(e.y) - baseY,
            (h * 0.5) + cc(e.z) - baseZ
        );

        g.add(edge);
        g.userData.type = "partGroup";
        g.userData.korpusName = k.nme;
        g.userData.partName = e1;
        g.userData.partData = e;
        g.userData.mesh = edge;

        bb.x = Math.max(bb.x, w + k.x);
        bb.y = Math.max(bb.y, d + k.y);
        bb.z = Math.max(bb.z, h + k.z);

        return g;
    }

    const material = createMaterialForPart(window.PR.lm[e.m], [k.vi, e.vi]);
    const mesh = resTracker.track(
        new THREE.Mesh(geo, material)
    );
    mesh.name = e1;   // 🔥 DAS IST ENTSCHEIDEND
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = "part";
    mesh.userData.korpusName = k.nme;
    mesh.userData.partName = e1;
    mesh.userData.partData = e;
    mesh.userData.partGroup = g;

    const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        edgmat
    );
    edge.layers.set(lay);

    mesh.add(edge);
    mesh.layers.set(lay);

    applyPartRotation(mesh, e, w, d, h);

    const key = k.nme + e1;
    meshMap[key] = mesh;
    state[key] = "free";

    mesh.updateMatrixWorld(true);

    const baseX = e1 == null ? 0 : cc(k.x);
    const baseY = e1 == null ? 0 : cc(k.y);
    const baseZ = e1 == null ? 0 : cc(k.z);

    g.position.set(
        (w * 0.5) + cc(e.x) - baseX,
        (d * 0.5) + cc(e.y) - baseY,
        (h * 0.5) + cc(e.z) - baseZ
    );

    g.add(mesh);
    g.userData.type = "partGroup";
    g.userData.korpusName = k.nme;
    g.userData.partName = e1;
    g.userData.partData = e;
    g.userData.mesh = mesh;

    bb.x = Math.max(bb.x, w + k.x);
    bb.y = Math.max(bb.y, d + k.y);
    bb.z = Math.max(bb.z, h + k.z);

    return g;
}

const EXTRUDED_TEXT_GLYPHS = {
    r: {
        outline: [
            [0, 0], [0, 1], [0.82, 1], [0.82, 0.54],
            [0.55, 0.54], [0.98, 0], [0.7, 0],
            [0.35, 0.44], [0.22, 0.44], [0.22, 0]
        ],
        holes: [
            [[0.24, 0.68], [0.24, 0.86], [0.6, 0.86], [0.6, 0.68]]
        ]
    },
    s: {
        outline: [
            [0.92, 1], [0, 1], [0, 0.58], [0.64, 0.58],
            [0.64, 0.42], [0, 0.42], [0, 0], [0.92, 0],
            [0.92, 0.42], [0.28, 0.42], [0.28, 0.58],
            [0.92, 0.58]
        ]
    }
};

function textGlyphCharFromKorpus(k) {
    const match = String(k?.nme || "").match(/^(?:txt\d+_|.+_txt)\d+([a-z0-9]|us|mi)$/i);
    if (!match) return "";
    if (match[1] === "us") return "_";
    if (match[1] === "mi") return "-";
    return match[1].toLowerCase();
}

function makePathFromPoints(points, w, h) {
    const path = new THREE.Path();
    points.forEach(([x, z], index) => {
        const px = x * w;
        const pz = z * h;
        if (index === 0) path.moveTo(px, pz);
        else path.lineTo(px, pz);
    });
    path.closePath();
    return path;
}

function makeShapeFromGlyph(glyph, w, h) {
    const outline = Array.isArray(glyph) ? glyph : glyph.outline;
    if (!outline) return null;
    const shape = new THREE.Shape();
    outline.forEach(([x, z], index) => {
        const px = x * w;
        const pz = z * h;
        if (index === 0) shape.moveTo(px, pz);
        else shape.lineTo(px, pz);
    });
    shape.closePath();

    for (const hole of glyph.holes || []) {
        shape.holes.push(makePathFromPoints(hole, w, h));
    }

    return shape;
}

function createExtrudedTextGlyphKorpus(k, ch) {
    const glyph = EXTRUDED_TEXT_GLYPHS[ch];
    if (!glyph) return null;

    const w = partDim(k.w, `${k.nme}.w`);
    const d = partDim(k.d, `${k.nme}.d`);
    const h = partDim(k.h, `${k.nme}.h`);
    const shape = makeShapeFromGlyph(glyph, w, h);
    if (!shape) return null;
    const geo = resTracker.track(new THREE.ExtrudeGeometry(shape, {
        depth: d,
        bevelEnabled: false
    }));
    geo.rotateX(Math.PI / 2);
    geo.translate(0, d, 0);

    const material = createMaterialForPart(window.PR.lm[k.m], [k.vi]);
    const mesh = resTracker.track(new THREE.Mesh(geo, material));
    mesh.name = ch;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = "part";
    mesh.userData.korpusName = k.nme;
    mesh.userData.partName = ch;
    mesh.userData.partData = k;

    const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        edgmat
    );
    edge.layers.set(2);
    mesh.add(edge);
    mesh.layers.set(2);

    const g = new THREE.Group();
    g.add(mesh);
    g.userData.type = "korpus";
    g.userData.korpusName = k.nme;
    g.userData.korpusData = k;
    g.userData.localBB = new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(w, d, h)
    );

    const key = k.nme + "_extrude_" + ch;
    meshMap[key] = mesh;
    state[key] = "free";

    bb.x = Math.max(bb.x, w + k.x);
    bb.y = Math.max(bb.y, d + k.y);
    bb.z = Math.max(bb.z, h + k.z);

    return g;
}


function createK(k, nme) {
    const {cur, tar} = k;
    if (k.__skipRender) return new THREE.Group();

    // ==================================================
    // 🔥 PART SHORTCUT (WICHTIG!)
    // ==================================================
    if (k.type === "part") {

        const g = new THREE.Group();

        // direkt ein Mesh, kein Parts-System
        const part = k.__edgeOnly ? { ...k, __edgeOnly: true } : k;
        g.add(makeM(k, null, part));

        return g;
    }

    // ==================================================
    // 🔧 SAFETY
    // ==================================================
    if (!Array.isArray(k.jj)) {
        console.warn("createK: k.jj is not iterable", nme, k);
        return new THREE.Group();
    }

    const textGlyphChar = textGlyphCharFromKorpus(k);
    const extrudedTextGlyph = createExtrudedTextGlyphKorpus(k, textGlyphChar);
    if (extrudedTextGlyph) return extrudedTextGlyph;

    // ==================================================
    // 🧱 NORMALER KORPUS
    // ==================================================
    const g = new THREE.Group();
    g.name = nme || k.nme || "";
    g.userData.type = "korpus";
    g.userData.korpusName = g.name;
    g.userData.korpusData = k;
    g.userData.localBB = makeKorpusLocalBB(k);

    for (const e1 of k.jj) {
        if (!k[e1]) continue;
        if (k[e1].__skipRender) continue;
        g.add(makeM(k, e1, k[e1]));
    }

    return g;
}

async function resolveLinkedKorpus(k) {
    if (!k.innurl) return k;

    const text = await loadURLfromDWG(k.innurl);
    // alert("text: "+ JSON.stringify(k))
    if (!text) return k;

    const pr = new Proj(text).getall();

    return {
        ...k,
        ...pr.allpa,
        jj: pr.alljj
    };
}

function decodeFirstQueryParam(url) {
    if (!url) return "";

    const qs = url.split("?")[1];
    if (!qs) return "";

    const params = new URLSearchParams(qs);
    const it = params.entries().next();
    if (it.done) return "";

    const [, raw] = it.value;

    return decodeURIComponent(raw)
        .replace(/_N_/g, "\n")
        .replace(/_S_/g, " ")
        .replace(/_P_/g, "+");
}



function injectWDHIntoProjectLine(text, w, d, h) {

    const lines = text.split(/\r?\n/);
    if (!lines.length) return text;

    const parts = lines[0].trim().split(/\s+/);

    // parts[0] = Projektname
    let insertIdx = 1;

    // Prüfen, ob an Position 1 schon ein WDH-Token sitzt
    if (
        parts[1] &&
        /^[0-9]/.test(parts[1]) &&
        parts[1].includes(",")
    ) {
        // ersetzen
        parts[1] = `${w},${d},${h}`;
        insertIdx = 2;
    } else {
        // einfügen
        parts.splice(1, 0, `${w},${d},${h}`);
        insertIdx = 2;
    }

    lines[0] = parts.join(" ");
    return lines.join("\n");
}


async function preprocessProject(pr) {

    for (const key in pr.pp) {

        const k = pr.pp[key];
        if (!k.innurl) continue;

        console.warn("▶ loading DWG:", k.innurl);

        const url = await loadURLfromDWG(k.innurl);
        console.warn("▶ DWG url:", url);

        if (!url) continue;

        var text = decodeFirstQueryParam(url);
        console.warn("▶ decoded text:\n", text);

        if (!text.trim()) continue;

        text = injectWDHIntoProjectLine(text, k.w, k.d, k.h)


        const lp = new Proj(text).getall();

        console.warn("▶ linked project jj:", lp.alljj);

        if (!Array.isArray(lp.alljj)) {
            console.error("❌ linked DWG has NO korpus:", k.innurl);
            continue;
        }

        Object.assign(k, lp.allpa);
        k.jj = lp.alljj;

        console.warn("✅ korpus linked:", key);
    }

    return pr;
}








function getLocalCornerFromBB(localBB, idx) {
    switch (idx) {
        // Vorne: 0 = links unten, dann im Uhrzeigersinn
        case 0: return new THREE.Vector3(localBB.min.x, localBB.min.y, localBB.min.z);
        case 1: return new THREE.Vector3(localBB.min.x, localBB.min.y, localBB.max.z);
        case 2: return new THREE.Vector3(localBB.max.x, localBB.min.y, localBB.max.z);
        case 3: return new THREE.Vector3(localBB.max.x, localBB.min.y, localBB.min.z);

        // Hinten: 4 = links unten, dann im Uhrzeigersinn wie vorne
        case 4: return new THREE.Vector3(localBB.min.x, localBB.max.y, localBB.min.z);
        case 5: return new THREE.Vector3(localBB.min.x, localBB.max.y, localBB.max.z);
        case 6: return new THREE.Vector3(localBB.max.x, localBB.max.y, localBB.max.z);
        case 7: return new THREE.Vector3(localBB.max.x, localBB.max.y, localBB.min.z);

        default:
            console.warn("invalid corner:", idx);
            return new THREE.Vector3();
    }
}

// ✅ echte Ecke in Weltkoordinaten: localCorner → matrixWorld
function getWorldCorner(mesh, idx) {
    const localBB = mesh.userData?.localBB;
    if (!localBB) {
        console.warn("missing mesh.userData.localBB for", mesh);
        return new THREE.Vector3();
    }
    mesh.updateMatrixWorld(true);
    const pLocal = getLocalCornerFromBB(localBB, idx);
    return pLocal.applyMatrix4(mesh.matrixWorld);
}

// ✅ robuste Rotation um Weltpunkt (deine funktionierende Variante)
function rotateAroundWorldPoint(mesh, worldPoint, angleRad) {

    mesh.updateMatrixWorld(true);

    const m = mesh.matrixWorld.clone();

    const t1 = new THREE.Matrix4().makeTranslation(-worldPoint.x, -worldPoint.y, -worldPoint.z);
    const r = new THREE.Matrix4().makeRotationZ(angleRad);
    const t2 = new THREE.Matrix4().makeTranslation(worldPoint.x, worldPoint.y, worldPoint.z);

    m.premultiply(t1);
    m.premultiply(r);
    m.premultiply(t2);

    mesh.matrix.copy(m);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.updateMatrixWorld(true);
}

//////////////////99999
// ======================================================
// CORNER-GEOMETRIE – EINHEITLICH FÜR KORPUS & PART
// ======================================================

// ======================================================
// CONNECT: ECKE → ECKE (KORPUS ODER PART)
// ======================================================
//
// mesh        : THREE.Group des zu verschiebenden Korpus
// obj         : CAD-Objekt (Korpus oder Part), das bewegt wird
// targetObj   : CAD-Objekt (Korpus oder Part), Ziel
// selfCorner  : eigene Ecke (0–7)
// targetCorner: Ziel-Ecke (0–7)
//
function connectByCorner(mesh, obj, targetObj, selfCorner, targetCorner) {

    const C = cornerXYZ(obj, selfCorner);
    const P = cornerXYZ(targetObj, targetCorner);

    const dx = P.x - C.x;
    const dy = P.y - C.y;
    const dz = P.z - C.z;

    // Szene verschieben
    mesh.position.x += dx;
    mesh.position.y += dy;
    mesh.position.z += dz;

    // Datenmodell synchronisieren
    obj.x += dx;
    obj.y += dy;
    obj.z += dz;
}

// ======================================================
// CORNER-GEOMETRIE – EINHEITLICH FÜR KORPUS & PART
// ======================================================

// Eckdefinition:
// vorne  0 = links unten, dann im Uhrzeigersinn: 0,1,2,3
// hinten 4 = links unten, dann im Uhrzeigersinn: 4,5,6,7
const cornerVec = [
    [0, 0, 0], // 0 vorne links unten
    [0, 0, 1], // 1 vorne links oben
    [1, 0, 1], // 2 vorne rechts oben
    [1, 0, 0], // 3 vorne rechts unten
    [0, 1, 0], // 4 hinten links unten
    [0, 1, 1], // 5 hinten links oben
    [1, 1, 1], // 6 hinten rechts oben
    [1, 1, 0], // 7 hinten rechts unten
];

// ------------------------------------------------------
// WELT-ECKE EINES KORPUS
// k: {x,y,z,w,d,h}
// ------------------------------------------------------
function cornerXYZ_Korpus(k, corner) {
    const [sx, sy, sz] = cornerVec[corner];
    return {
        x: k.x + sx * k.w,
        y: k.y + sy * k.d,
        z: k.z + sz * k.h
    };
}

// ------------------------------------------------------
// WELT-ECKE EINES PARTS
// k: Korpus, p: Part (lokal im Korpus)
// p: {x,y,z,w,d,h}
// ------------------------------------------------------
function cornerXYZ_Part(k, p, corner) {
    const [sx, sy, sz] = cornerVec[corner];
    return {
        x: k.x + p.x + sx * p.w,
        y: k.y + p.y + sy * p.d,
        z: k.z + p.z + sz * p.h
    };
}

// ------------------------------------------------------
// GENERISCH: OBJEKT → WELT-PUNKT
// corner kann sein:
// - Zahl: Ecke
// - [a,b]: Mittelpunkt zwischen Ecke a und b
// ------------------------------------------------------
function pointXYZ(obj, cornerSpec) {

    // Einzelne Ecke
    if (typeof cornerSpec === "number") {
        return cornerXYZ(obj, cornerSpec);
    }

    // Mittelpunkt aus zwei Ecken
    if (Array.isArray(cornerSpec) && cornerSpec.length === 2) {
        const A = cornerXYZ(obj, cornerSpec[0]);
        const B = cornerXYZ(obj, cornerSpec[1]);
        return {
            x: (A.x + B.x) * 0.5,
            y: (A.y + B.y) * 0.5,
            z: (A.z + B.z) * 0.5
        };
    }

    throw new Error("Invalid corner specification");
}

// ------------------------------------------------------
// GENERISCHER DISPATCH
// obj kann sein:
// - Korpus
// - Part mit obj._type === 'part' und obj._korpus
// ------------------------------------------------------
function cornerXYZ(obj, corner) {
    if (obj._type === "part") {
        return cornerXYZ_Part(obj._korpus, obj, corner);
    }
    return cornerXYZ_Korpus(obj, corner);
}


// ======================================================
// PROJ – KORPUS + PART ↔ PART / KORPUS CONNECT
// ======================================================




/////////////////9999



function getWorldPoint(mesh, cornerSpec) {

    // normale Ecke
    if (typeof cornerSpec === "number") {
        return getWorldCorner(mesh, cornerSpec);
    }
    // Mittelpunkt aus zwei Ecken
    if (Array.isArray(cornerSpec) && cornerSpec.length === 2) {
        const A = getWorldCorner(mesh, Number(cornerSpec[0]));
        const B = getWorldCorner(mesh, Number(cornerSpec[1]));
        return new THREE.Vector3(
            (A.x + B.x) * 0.5,
            (A.y + B.y) * 0.5,
            (A.z + B.z) * 0.5
        );
    }

    throw new Error("Invalid cornerSpec: " + cornerSpec);
}


function getLocalCorner(bb, idx) {

    switch (idx) {

        case 0: return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
        case 3: return new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z);
        case 4: return new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z);
        case 7: return new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z);

        case 1: return new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z);
        case 2: return new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z);
        case 5: return new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z);
        case 6: return new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z);

        default:
            console.warn("Corner index ungültig:", idx);
            return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
    }
}



function cornerFromBB1111(bb, idx) {

    if (!bb) {
        console.warn("cornerFromBB: bb fehlt");
        return new THREE.Vector3(0, 0, 0);
    }

    switch (idx) {

        case 0: return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
        case 3: return new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z);
        case 4: return new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z);
        case 7: return new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z);

        case 1: return new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z);
        case 2: return new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z);
        case 5: return new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z);
        case 6: return new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z);

        default:
            console.warn("cornerFromBB: ungültiger Index", idx);
            return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
    }
}



function cornerFromBB(bb, arr) {

    if (!Array.isArray(arr) || arr.length === 0) {
        arr = [0];
    }

    function singleCorner(n) {
        switch (n) {
            case 0: return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
            case 1: return new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z);
            case 2: return new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z);
            case 3: return new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z);
            case 4: return new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z);
            case 5: return new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z);
            case 6: return new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z);
            case 7: return new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z);
            default:
                return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);
        }
    }

    const points = arr.map(n => singleCorner(n));

    const mid = new THREE.Vector3();
    points.forEach(p => mid.add(p));
    mid.multiplyScalar(1 / points.length);

    return mid;
}


function findPartMesh(korpusMesh, partKey) {

    let found = null;

    korpusMesh.traverse(obj => {
        if (obj.name === partKey) {
            found = obj;
        }
    });

    return found;
}


function proj(pr) {

    if (!pr || !pr.oks) {
        console.error("proj: pr ungültig", pr);
        return new THREE.Group();
    }

    const names = pr.jj && pr.jj.length ? pr.jj : Object.keys(pr.oks);

    const root = new THREE.Group();
    const meshMap = {};
    const state = {};
    const hit = pr.partLimitExceeded;
    const limitNotice = hit
        ? `Hinweis: Free zeigt nur die ersten ${hit.limit || hit.rendered || 0} Teile.`
        : "";
    let limitNoticeShown = false;

    // ----------------------------------------
    // parse helpers
    // ----------------------------------------
    

    

    function resolveCornerMesh(baseMesh, partKey) {
        if (!baseMesh || !partKey) return baseMesh;

        const partMesh = findPartMesh(baseMesh, partKey);
        if (!partMesh) {
            console.warn("Part-Mesh nicht gefunden:", partKey, "in", baseMesh.name);
            return baseMesh;
        }

        return partMesh;
    }

    function getWorldCorner(mesh, cornerSpec) {
        const bb = mesh.userData.localBB;
        if (!bb) {
            console.warn("missing localBB for", mesh.name);
            return mesh.getWorldPosition(new THREE.Vector3());
        }

        const p = cornerFromBB(bb, Array.isArray(cornerSpec) ? cornerSpec : [cornerSpec]);
        return mesh.localToWorld(p);
    }

    function positiveNumber(value) {
        const n = Number(value || 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function getWorldBoxCenter(mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        return box.getCenter(new THREE.Vector3());
    }

	    function korpusOffsetVector(k) {
	        return new THREE.Vector3(
	            cc(k?.x),
	            cc(k?.y),
	            cc(k?.z)
	        );
	    }

	    function korpusRotationPivotOffset(mesh, k) {
	        const corner = k?.ozc;
	        const angle = Number(k?.oz) || 0;
	        const bb = mesh?.userData?.localBB;
	        if (corner == null || !angle || !bb) return new THREE.Vector3();

	        return rotationPivotOffsetZ(bb, THREE.MathUtils.degToRad(angle), corner);
	    }

	    function korpusBasePosition(mesh, k) {
	        return korpusOffsetVector(k).add(korpusRotationPivotOffset(mesh, k));
	    }

    function korpusSpacingVector(parentMesh, childMesh, k) {
        const xx = positiveNumber(k.xx);
        const xy = positiveNumber(k.xy);
        const xz = positiveNumber(k.xz);
        if (!xx && !xy && !xz) return null;

        const parentCenter = getWorldBoxCenter(parentMesh);
        const childCenter = getWorldBoxCenter(childMesh);
        const diff = childCenter.sub(parentCenter);

        const ax = Math.abs(diff.x);
        const ay = Math.abs(diff.y);
        const az = Math.abs(diff.z);

        if (ax >= ay && ax >= az && xx) {
            return new THREE.Vector3(Math.sign(diff.x) || 1, 0, 0).multiplyScalar(xx);
        }
        if (ay >= ax && ay >= az && xy) {
            return new THREE.Vector3(0, Math.sign(diff.y) || 1, 0).multiplyScalar(xy);
        }
        if (xz) {
            return new THREE.Vector3(0, 0, Math.sign(diff.z) || 1).multiplyScalar(xz);
        }

        return null;
    }

    // ----------------------------------------
    // 1) Mesh erzeugen
    // ----------------------------------------
    for (const name of names) {

        const k = pr.oks[name];
        if (!k) continue;

        const g = new THREE.Group();
        g.name = name;
        g.userData.type = "korpus";
        g.userData.korpusName = name;
        g.userData.korpusData = k;

        const inner = createK(k, name);
        g.add(inner);
        if (!isExpandedTextKorpus(k)) {
            g.add(makeL(k, g, {
                notice: !limitNoticeShown ? limitNotice : ""
            }));
            if (limitNotice) limitNoticeShown = true;
        }

        g.updateMatrixWorld(true);
        g.userData.localBB = makeKorpusLocalBB(k);

        meshMap[name] = g;
        state[name] = "free";
    }

    // ----------------------------------------
    // 2) Alle Korpusse bleiben im Root.
    //    Der Connect-Loop arbeitet mit Weltkoordinaten; echtes Parenting
    //    würde Parent-Offsets wie a2.x bereits vorab in das Kind einrechnen.
    // ----------------------------------------
    for (const name of names) {

        const mesh = meshMap[name];
        if (mesh) root.add(mesh);
    }

    // ----------------------------------------
    // 3) Rotation
    // ----------------------------------------
    root.updateMatrixWorld(true);

    for (const name of names) {
        const k = pr.oks[name];
        const mesh = meshMap[name];
        if (!mesh || !k) continue;

	        mesh.rotation.z = THREE.MathUtils.degToRad(Number(k.oz) || 0);
	        mesh.position.copy(korpusRotationPivotOffset(mesh, k));
	    }

    root.updateMatrixWorld(true);

    // ----------------------------------------
    // 4) CONNECT LOOP
    // ----------------------------------------
    let progress = true;
    let safety = 0;

    while (progress && safety++ < 50) {

        progress = false;
        root.updateMatrixWorld(true);

        for (const name of names) {

            if (state[name] === "done") continue;

            const k = pr.oks[name];
            const mesh = meshMap[name];
            if (!mesh || !k) { state[name] = "done"; continue; }

	            const t = parseCornerRef(k.tar);

	            if (!t || !t[0]) {
	                mesh.position.copy(korpusBasePosition(mesh, k));
	                mesh.updateMatrixWorld(true);
	                state[name] = "done";
	                progress = true;
	                continue;
	            }

            let parentMesh = meshMap[t[0]];
            if (!parentMesh) continue;

            // 🔥 PART korrekt auflösen
            parentMesh = resolveCornerMesh(parentMesh, t[1]);

            if (state[t[0]] !== "done" && t[0] !== name) continue;

            const cuu = parseCornerRef(k.cur);

            const curCorner = cuu?.corner ?? 0;
            const tarCorner = t.corner ?? 3;
            const currentMesh = resolveCornerMesh(mesh, cuu?.[1]);

            const C = getWorldCorner(currentMesh, curCorner);
            const P = getWorldCorner(parentMesh, tarCorner);

            const delta = new THREE.Vector3().subVectors(P, C);

            const nextWorld = mesh.getWorldPosition(new THREE.Vector3()).add(delta);
            nextWorld.add(korpusOffsetVector(k));
            const nextLocal = nextWorld.clone();
            mesh.parent.worldToLocal(nextLocal);
            mesh.position.copy(nextLocal);

            mesh.updateMatrixWorld(true);

            const spacing = korpusSpacingVector(parentMesh, mesh, k);
            if (spacing) {
                const spacedWorld = mesh.getWorldPosition(new THREE.Vector3()).add(spacing);
                const spacedLocal = spacedWorld.clone();
                mesh.parent.worldToLocal(spacedLocal);
                mesh.position.copy(spacedLocal);
                mesh.updateMatrixWorld(true);
            }

            state[name] = "done";
            progress = true;
        }
    }

    // ----------------------------------------
    // Debug
    // ----------------------------------------
    for (const name of names) {
        if (state[name] !== "done") {
            const k = pr.oks[name];
            console.warn("Connect nicht finalisiert:", name, "tar=", k?.tar);
        }
    }

    return root;
}










function fitCameraToObject111(object3d, padding = 0.6) {

    const box = new THREE.Box3().setFromObject(object3d);

    if (box.isEmpty()) {
        console.warn("bounding box empty");
        return;
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    let ccc = box.getCenter(center);
    var ax = new THREE.AxesHelper(bb.x)
    // ax.position.set(-bb.x / 2, -bb.y / 2, -bb.z / 2)
    scene.add(ax);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * Math.PI / 180;
    let dist = maxDim / (2 * Math.tan(fov / 2));

    dist *= padding;


    //     camera.position.x = Number(-bb.x * padding)
    //     camera.position.y = Number(-(bb.x + bb.z)*padding)
    //     camera.position.z = Number(bb.z * padding)

    // // camera.position.y = Number(-(bb.x + bb.z)*padding)
    // //     camera.position.x = Number(-bb.x * 1.2)
    // //     camera.position.z = Number(bb.z / 4)


    camera.lookAt(center);
    camera.updateProjectionMatrix();

    if (controls) {
        controls.target.copy(center);
        controls.update();
    }

}


function fitCameraToObject(object3d, padding = 0.6) {

    const box = new THREE.Box3().setFromObject(object3d);

    if (box.isEmpty()) {
        console.warn("bounding box empty");
        window.ST_LAST_RENDER = {
            ok: false,
            reason: "bounding box empty"
        };
        return;
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // ---------- DEBUG AXES (wie bei dir) ----------
    // const ax = new THREE.AxesHelper(size.x);
    // scene.add(ax);

    // ---------- FIT-DISTANZ (bleibt wie gehabt) ----------
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * Math.PI / 180;
    let dist = maxDim / (2 * Math.tan(fov / 2));
    dist *= padding;

    // ---------- DEINE KAMERA-POSITION (BEWUSST NICHT ANGEFASST) ----------
    camera.position.x = -size.x * padding;
    camera.position.y = -(size.x + size.z) * padding;
    camera.position.z = size.z * padding;
    camera.position.z = 144
    camera.lookAt(center);

    // ---------- QUADRATISCHES CANVAS ----------
    setRendererSquareSize();

    if (controls) {
        controls.target.copy(center);
        controls.update();
    }

    window.ST_LAST_RENDER = {
        ok: true,
        box: {
            min: box.min.toArray(),
            max: box.max.toArray(),
            size: size.toArray(),
            center: center.toArray()
        },
        camera: {
            position: camera.position.toArray(),
            target: controls?.target?.toArray?.()
        },
        objects: object3d.children.length
    };
    console.info("ST render", window.ST_LAST_RENDER);
}

function onResizeSquareCanvas() {
    setRendererSquareSize();
}

window.addEventListener("resize", onResizeSquareCanvas);


// =========================================================
// DOCKING – Ankerpunkte & Verbindung
// =========================================================

function getAnchorPoints(object3d, options = {}) {

    // Weltkoordinaten!
    const box = options.pushBox
        ? getKorpusPushBox(object3d)
        : (options.visibleBox ? getVisiblePartsBox(object3d) : getObjectAnchorBox(object3d));
    if (box.isEmpty()) return null;

    const min = box.min;
    const max = box.max;
    const mid = {
        x: (min.x + max.x) * 0.5,
        y: (min.y + max.y) * 0.5,
        z: (min.z + max.z) * 0.5
    };

    return {
        // Vorne: 0 links unten, dann im Uhrzeigersinn
        c0: new THREE.Vector3(min.x, min.y, min.z),
        c1: new THREE.Vector3(min.x, min.y, max.z),
        c2: new THREE.Vector3(max.x, min.y, max.z),
        c3: new THREE.Vector3(max.x, min.y, min.z),

        // Hinten: 4 links unten, dann im Uhrzeigersinn
        c4: new THREE.Vector3(min.x, max.y, min.z),
        c5: new THREE.Vector3(min.x, max.y, max.z),
        c6: new THREE.Vector3(max.x, max.y, max.z),
        c7: new THREE.Vector3(max.x, max.y, min.z),

        // Kantenmitten passend zu den Corner-Paaren
        e01: new THREE.Vector3(min.x, min.y, mid.z),
        e12: new THREE.Vector3(mid.x, min.y, max.z),
        e23: new THREE.Vector3(max.x, min.y, mid.z),
        e30: new THREE.Vector3(mid.x, min.y, min.z),
        e45: new THREE.Vector3(min.x, max.y, mid.z),
        e56: new THREE.Vector3(mid.x, max.y, max.z),
        e67: new THREE.Vector3(max.x, max.y, mid.z),
        e74: new THREE.Vector3(mid.x, max.y, min.z),
        e04: new THREE.Vector3(min.x, mid.y, min.z),
        e15: new THREE.Vector3(min.x, mid.y, max.z),
        e26: new THREE.Vector3(max.x, mid.y, max.z),
        e37: new THREE.Vector3(max.x, mid.y, min.z)
    };
}

function makeKorpusLocalBB(k) {
    const leg = Math.max(0, cc(k?.leg));
    return new THREE.Box3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(cc(k?.w), cc(k?.d), cc(k?.h) + leg)
    );
}

function getObjectAnchorBox(object3d) {
    const localBB = object3d?.userData?.localBB;

    if (object3d?.userData?.type === "korpus" && localBB) {
        const points = [
            new THREE.Vector3(localBB.min.x, localBB.min.y, localBB.min.z),
            new THREE.Vector3(localBB.min.x, localBB.min.y, localBB.max.z),
            new THREE.Vector3(localBB.max.x, localBB.min.y, localBB.max.z),
            new THREE.Vector3(localBB.max.x, localBB.min.y, localBB.min.z),
            new THREE.Vector3(localBB.min.x, localBB.max.y, localBB.min.z),
            new THREE.Vector3(localBB.min.x, localBB.max.y, localBB.max.z),
            new THREE.Vector3(localBB.max.x, localBB.max.y, localBB.max.z),
            new THREE.Vector3(localBB.max.x, localBB.max.y, localBB.min.z)
        ];

        return new THREE.Box3().setFromPoints(
            points.map(point => object3d.localToWorld(point.clone()))
        );
    }

    return new THREE.Box3().setFromObject(object3d);
}

function getVisiblePartsBox(object3d) {
    const box = new THREE.Box3();
    let hasParts = false;

    object3d?.traverse?.(obj => {
        if (obj.userData?.type !== "part") return;

        obj.updateMatrixWorld(true);
        box.expandByObject(obj);
        hasParts = true;
    });

    if (hasParts) return box;

    return new THREE.Box3().setFromObject(object3d);
}

function getKorpusPushBox(object3d) {
    const k = object3d?.userData?.korpusData;
    if (!k) return getVisiblePartsBox(object3d);

    const leg = Math.max(0, cc(k.leg));
    const min = new THREE.Vector3(cc(k.ul), cc(k.uf), leg + cc(k.ug));
    const max = new THREE.Vector3(
        cc(k.w) - cc(k.ur),
        cc(k.d) - cc(k.ub),
        leg + cc(k.h) - cc(k.ut)
    );

    if (max.x < min.x || max.y < min.y || max.z < min.z) {
        return getVisiblePartsBox(object3d);
    }

    return new THREE.Box3().setFromPoints([
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z)
    ].map(point => object3d.localToWorld(point)));
}

function dockProject({
    baseGroup,
    baseAnchor,
    attachGroup,
    attachAnchor
}) {
    const baseAnchors = getAnchorPoints(baseGroup);
    const attachAnchors = getAnchorPoints(attachGroup);

    if (!baseAnchors || !attachAnchors) {
        console.warn("dockProject: missing anchors");
        return;
    }

    const target = baseAnchors[baseAnchor];
    const source = attachAnchors[attachAnchor];

    if (!target || !source) {
        console.warn("dockProject: invalid anchor", baseAnchor, attachAnchor);
        return;
    }

    // Verschiebungsvektor: Ziel – Quelle
    const delta = new THREE.Vector3().subVectors(target, source);

    attachGroup.position.add(delta);
}
function removeAnchorMarkers(keepSelected = false) {
    const keep = keepSelected ? selectedAnchor : null;

    for (const marker of [...anchorMarkers]) {
        if (marker === keep) continue;
        marker.geometry?.dispose();
        marker.material?.dispose();
        marker.removeFromParent();
    }

    anchorMarkers.length = 0;
    if (keep) {
        anchorMarkers.push(keep);
    } else {
        selectedAnchor = null;
    }
}

function addAnchorMarkersForObject(object3d, owner, kind, color, options = {}) {
    const anchors = getAnchorPoints(object3d, options);
    if (!anchors) return;

    for (const [name, pos] of Object.entries(anchors)) {
        const isEdge = name.startsWith("e");
        const radius = (kind === "part" ? 0.75 : 1) * (isEdge ? 1.45 : 0.9);
        const geo = new THREE.SphereGeometry(radius *2, 12, 12);
        const m = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({ color })
        );
        m.position.copy(pos);
        m.userData = {
            type: "anchor",
            anchor: name,
            corner: anchorNameToCornerSpec(name),
            isEdge,
            owner,
            object: object3d,
            kind
        };
        scene.add(m);
        anchorMarkers.push(m);
    }
}

function anchorNameToCornerSpec(name) {
    if (/^c\d$/.test(name)) return name.slice(1);
    if (/^e\d\d$/.test(name)) return name.slice(1);
    return name;
}

function createAnchorMarkers(group) {
    removeAnchorMarkers();

    group.updateMatrixWorld(true);

    group.traverse(obj => {
        if (obj.userData?.type === "korpus") {
            addAnchorMarkersForObject(obj, obj, "korpus", 0xff0000);
        }

        if (obj.userData?.type === "part") {
            const owner = findKorpusOwner(obj) || obj.userData.partGroup || obj.parent;
            addAnchorMarkersForObject(obj, owner, "part", 0x006eff);
        }
    });
}

function showAnchorMarkersForObject(object3d, owner, kind, color) {
    removeAnchorMarkers(Boolean(selectedAnchor));
    addAnchorMarkersForObject(object3d, owner, kind, color);
}

function showAnchorMarkersForPart(mesh) {
    const owner = findKorpusOwner(mesh) || mesh.userData?.partGroup || mesh.parent;
    showAnchorMarkersForObject(mesh, owner, "part", 0x006eff);
}

function showAnchorMarkersForKorpus(group) {
    removeAnchorMarkers(Boolean(selectedAnchor));
    addAnchorMarkersForObject(group, group, "korpus", 0xff0000);
    addAnchorMarkersForObject(group, group, "korpusPush", 0x00aa66, { pushBox: true });
}

function findKorpusOwner(obj) {
    let current = obj;
    while (current) {
        if (current.userData?.type === "korpus") return current;
        current = current.parent;
    }
    return null;
}

function createAnchorMarkers_old(group, color = 0xff0000) {

    const anchors = getAnchorPoints(group);
    if (!anchors) return;

    const geo = new THREE.SphereGeometry(1, 16, 16); // größer
    const mat = new THREE.MeshBasicMaterial({ color });

    for (const [name, pos] of Object.entries(anchors)) {

        const m = new THREE.Mesh(geo, mat.clone());
        m.position.copy(pos);

        m.userData = {
            type: "anchor",
            anchor: name,
            owner: group
        };

        scene.add(m);
        anchorMarkers.push(m);   // 🔑 MERKEN
    }
}

async function loadLinkedProjects() {

    const projects = [];

    for (const id of window.lus || []) {
        const inp = document.getElementById(id);
        if (!inp || !inp.value.trim()) continue;

        const keyOrUrl = inp.value.trim();

        const url = await resolveDwgKeyToUrl(keyOrUrl); // ← deine Methode
        if (!url) continue;

        const text = urlToInn(url);
        const pr = new Proj(text).getall();

        projects.push(pr);
    }

    return projects;
}



function getAllQueryParams() {
    const params = {};
    const qs = new URLSearchParams(window.location.search);

    for (const [key] of qs.entries()) {
        const url = new URL(window.location.href);
        const value = url.searchParams.get(key);
        if (!value) continue;
        url.search = "";
        url.searchParams.set(key, value);
        params[key] = urlToInn(url.toString());
    }
    return params;
}



/* =========================================================
   MASTER RENDER FLOW
========================================================= */


function getBBCorner(bb, idx) {
    switch (idx) {

        // ===== vordere Fläche =====
        case 0: // vorne unten links
            return new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z);

        case 1: // vorne oben links
            return new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z);

        case 2: // vorne oben rechts
            return new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z);

        case 3: // vorne unten rechts
            return new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z);

        // ===== hintere Fläche =====
        case 4: // hinten unten links
            return new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z);

        case 5: // hinten oben links
            return new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z);

        case 6: // hinten oben rechts
            return new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z);

        case 7: // hinten unten rechts
            return new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z);

        default:
            console.warn("invalid corner index:", idx);
            return new THREE.Vector3();
    }
}



let modelGroup = null;
let inspectorRestoreState = null;

function rememberInspectorRestoreState(state = window.CURRENT_STATE) {
    if (!inspectorRestoreState) inspectorRestoreState = state || "main";
}

function closeInspectorAndRestore() {
    const panel = partInspector;
    const restoreState = inspectorRestoreState;

    if (panel) panel.style.display = "none";
    setSelectedPart(null);
    setSelectedKorpus(null);
    removeAnchorMarkers(false);

    inspectorRestoreState = null;

    if (restoreState && window.CURRENT_STATE !== restoreState) {
        window.setState?.(restoreState);
        if (restoreState === "inn") {
            const editor = document.getElementById("inn");
            if (editor) editor.style.display = "block";
        }
        return;
    }

    const editor = document.getElementById("inn");
    if (editor) editor.style.display = restoreState === "inn" ? "block" : "";
}

async function renderMainWithDWGs(pr) {
    if (pr && typeof pr.then === "function") {
        pr = await pr;
    }
    if (typeof pr === "string") {
        pr = await new Proj(pr).getall();
    }
    normalizeProjectPartArrays(pr);
    if (window.validateProjectPartLimit) {
        await window.validateProjectPartLimit(pr);
    }
    if (pr.partLimitExceeded?.limit) {
        markLimitedRenderableParts(pr, pr.partLimitExceeded.limit);
    }
    window.PR = pr;
    window.updateToolbarStatus?.();

    resTracker?.dispose?.();
    resetBB();
    clearKorpusTreeRender();
    selectedPartMesh = null;
    setSelectedKorpus(null);
    if (partInspector) partInspector.style.display = "none";
    if (projectSummaryPanel) projectSummaryPanel.style.display = "none";
    updateProjectLabel(pr);
    const editor = document.getElementById("inn");
    if (editor && window.CURRENT_STATE === "inn") {
        editor.style.display = "block";
    }

    if (modelGroup) scene.remove(modelGroup);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const g = proj(pr);
    modelGroup.add(g);

    removeAnchorMarkers();
    fitCameraToObject(modelGroup);
    if (projectHasDimViewFlag(pr) || editorViewMode === "measure") {
        setEditorViewMode("measure", {
            keepBackground: projectHasDimViewFlag(pr),
            preserveSurface: projectHasDimViewFlag(pr)
        });
    }
}

let treeView3DScene = null;
let treeView3DCamera = null;
let treeView3DRenderer = null;
let treeView3DLabelRenderer = null;
let treeView3DControls = null;
let treeView3DContainer = null;
let treeView3DObjects = null;
let treeViewPointColors = new Map();

function disposeTreeView3D() {
    if (!treeView3DContainer) return;
    treeView3DContainer.querySelectorAll("canvas, .c3-label-renderer").forEach(el => el.remove());
    treeView3DScene = null;
    treeView3DCamera = null;
    treeView3DRenderer?.dispose?.();
    treeView3DRenderer = null;
    treeView3DLabelRenderer = null;
    treeView3DControls?.dispose?.();
    treeView3DControls = null;
    treeView3DObjects = null;
}

function initTreeView3D() {
    const host = document.getElementById("tree3dView");
    if (!host) return false;
    if (treeView3DContainer !== host) {
        disposeTreeView3D();
        treeView3DContainer = host;
    }
    host.style.position = "relative";
    host.querySelector(".tree-view-3d-hint")?.remove();

    const existing = host.querySelector("canvas");
    if (existing && treeView3DScene && treeView3DCamera && treeView3DRenderer) {
        resizeTreeView3D();
        return true;
    }

    host.querySelectorAll("canvas, .c3-label-renderer").forEach(el => el.remove());

    const size = Math.max(320, Math.min(host.clientWidth || 320, host.clientHeight || 320));

    treeView3DScene = new THREE.Scene();
    treeView3DScene.background = new THREE.Color("#000000");

    treeView3DCamera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
    treeView3DCamera.up.set(0, 0, 1);

    treeView3DRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    treeView3DRenderer.setPixelRatio(window.devicePixelRatio || 1);
    treeView3DRenderer.setSize(size, size);
    treeView3DRenderer.domElement.style.position = "absolute";
    treeView3DRenderer.domElement.style.top = "0";
    treeView3DRenderer.domElement.style.left = "0";
    treeView3DContainer.appendChild(treeView3DRenderer.domElement);

    treeView3DLabelRenderer = new CSS2DRenderer();
    treeView3DLabelRenderer.setSize(size, size);
    treeView3DLabelRenderer.domElement.style.position = "absolute";
    treeView3DLabelRenderer.domElement.style.top = "0";
    treeView3DLabelRenderer.domElement.style.left = "0";
    treeView3DLabelRenderer.domElement.style.pointerEvents = "none";
    treeView3DLabelRenderer.domElement.style.zIndex = "5";
    treeView3DLabelRenderer.domElement.classList.add("c3-label-renderer");
    treeView3DContainer.appendChild(treeView3DLabelRenderer.domElement);

    treeView3DObjects = new THREE.Group();
    treeView3DScene.add(treeView3DObjects);

    treeView3DControls = new OrbitControls(treeView3DCamera, treeView3DRenderer.domElement);
    treeView3DControls.enablePan = false;
    treeView3DControls.enableZoom = true;
    treeView3DControls.enableRotate = true;
    treeView3DControls.update();

    return true;
}

function resizeTreeView3D() {
    if (!treeView3DContainer || !treeView3DCamera || !treeView3DRenderer || !treeView3DLabelRenderer) return;
    const size = Math.max(320, Math.min(treeView3DContainer.clientWidth || 320, treeView3DContainer.clientHeight || 320));
    treeView3DCamera.aspect = 1;
    treeView3DCamera.updateProjectionMatrix();
    treeView3DRenderer.setSize(size, size);
    treeView3DLabelRenderer.setSize(size, size);
}

function getTreePointColorByPart(partName) {
    if (!partName) return "#ffffff";
    return treeViewPointColors.get(partName) || "#ffffff";
}

function treeRenderPartKey(obj) {
    return `${obj.userData?.korpusName || "?"}.${obj.userData?.partName || "?"}`;
}

function treeRenderDistinctColor(index) {
    const color = new THREE.Color();
    const hue = (index * 0.61803398875) % 1;
    color.setHSL(hue, 0.78, 0.58);
    return `#${color.getHexString()}`;
}

function getTreePointColor(letter) {
    const entry = treeViewPointColors.get(letter);
    if (entry) return entry;
    const palette = ["#59d8ff", "#ff7a7a", "#f9d65c", "#7cff9b", "#c78bff", "#ff9f43", "#80a8ff", "#ff6ec7"];
    const index = Math.max(0, (String(letter || "A").charCodeAt(0) || 65) - 65);
    return palette[index % palette.length];
}

function restoreTreeRenderPartColors() {
    treeRenderColoredParts.forEach((saved, obj) => {
        if (!obj) return;
        if (saved.material) {
            obj.material = saved.material;
        } else if (obj.material?.color && saved.color) {
            obj.material.color.copy(saved.color);
        }
        for (const edge of saved.edges || []) {
            if (edge?.object && edge.material) {
                edge.object.material = edge.material;
                edge.object.userData.treeRenderEdgeMaterial = false;
            }
        }
    });
    treeRenderColoredParts = new Map();
    if (scene && treeRenderSavedBackground !== null) {
        scene.background = treeRenderSavedBackground;
        treeRenderSavedBackground = null;
    }
}

function ensureTreeRenderSavedPart(obj) {
    if (treeRenderColoredParts.has(obj)) return treeRenderColoredParts.get(obj);
    const edgeChildren = treeRenderEdgeObjects(obj);
    const saved = {
        material: obj.material,
        edges: edgeChildren.map(edge => ({ object: edge, material: edge.material }))
    };
    treeRenderColoredParts.set(obj, saved);
    return saved;
}

function treeRenderEdgeObjects(obj) {
    const edges = [];
    if (obj?.isLineSegments) edges.push(obj);
    obj?.traverse?.(child => {
        if (child !== obj && child.isLineSegments) edges.push(child);
    });
    return edges;
}

function updateTreePointColorMap(useDistinctPartColors = false) {
    treeViewPointColors.clear();
    const map = new Map();
    let colorIndex = 0;
    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;
        const key = treeRenderPartKey(obj);
        if (useDistinctPartColors && !map.has(key)) {
            map.set(key, treeRenderDistinctColor(colorIndex++));
        } else if (!map.has(key) && obj.material?.color) {
            map.set(key, `#${obj.material.color.getHexString()}`);
        }
    });
    for (const [key, color] of map.entries()) {
        treeViewPointColors.set(key, color);
    }
}

function applyTreeRenderPartColors(options = {}) {
    const partColors = new Map();
    let colorIndex = 0;
    const onlyPartKeys = options.onlyPartKeys || null;

    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;
        const key = treeRenderPartKey(obj);
        if (onlyPartKeys && !onlyPartKeys.has(key)) return;
        if (!partColors.has(key)) {
            partColors.set(key, treeRenderDistinctColor(colorIndex++));
        }

        const color = partColors.get(key);
        treeViewPointColors.set(key, color);

        if (!treeRenderColoredParts.has(obj)) {
            ensureTreeRenderSavedPart(obj);
        }
        if (!options.preserveSurface && obj.material?.clone) obj.material = obj.material.clone();
        if (!options.preserveSurface && obj.material) {
            obj.material.wireframe = true;
            obj.material.transparent = false;
            obj.material.opacity = 1;
            if (obj.material.color) obj.material.color.set(color);
        }
        const edgeChildren = treeRenderEdgeObjects(obj);
        for (const edge of edgeChildren) {
            if (!edge.userData.treeRenderEdgeMaterial) {
                edge.material = new THREE.LineBasicMaterial({
                    color,
                    transparent: false,
                    opacity: 1,
                    depthTest: false,
                    depthWrite: false
                });
                edge.userData.treeRenderEdgeMaterial = true;
            } else if (edge.material?.color) {
                edge.material.color.set(color);
            }
            if (edge.material) edge.material.needsUpdate = true;
            edge.visible = true;
            edge.renderOrder = 1000;
        }
    });
}

function applyEditorWireframeView() {
    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;
        ensureTreeRenderSavedPart(obj);
        if (obj.material?.clone && obj.material === treeRenderColoredParts.get(obj)?.material) {
            obj.material = obj.material.clone();
        }
        if (obj.material) {
            obj.material.wireframe = true;
            obj.material.transparent = true;
            obj.material.opacity = 0.35;
        }
    });
}

function frameTreeView3D() {
    if (!treeView3DRenderer || !treeView3DScene || !treeView3DCamera) return;
    treeView3DRenderer.render(treeView3DScene, treeView3DCamera);
    treeView3DLabelRenderer.render(treeView3DScene, treeView3DCamera);
}

function clearTreeView3DObjects() {
    if (!treeView3DObjects) return;
    treeView3DObjects.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) obj.material.dispose?.();
        if (obj.element) obj.element.remove?.();
    });
    while (treeView3DObjects.children.length) {
        treeView3DObjects.remove(treeView3DObjects.children[0]);
    }
}

function setTree3DViewDirection(direction = treeRenderDirection) {
    if (!treeView3DCamera || !treeView3DObjects) return;
    treeRenderDirection = direction;
    const box = new THREE.Box3().setFromObject(treeView3DObjects);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const span = Math.max(size.x, size.y, size.z, 20) * 1.3;
    const far = Math.max(size.x + size.y + size.z + 200, 500);
    treeView3DCamera.position.set(0,0,0);
    if (direction === "x") {
        treeView3DCamera.position.set(box.max.x + span * 0.8, center.y, center.z);
    } else if (direction === "y") {
        treeView3DCamera.position.set(center.x, box.max.y + span * 0.8, center.z);
    } else {
        treeView3DCamera.position.set(center.x, center.y, box.max.z + span * 0.8);
    }
    treeView3DCamera.lookAt(center);
    treeView3DCamera.updateProjectionMatrix();
    treeView3DControls.target.copy(center);
    treeView3DControls.update();
}

function renderKorpusTree3DView(_groups = [], _edges = []) {
    if (!modelGroup) return;
    if (!initTreeView3D()) return;
    resizeTreeView3D();
    updateTreePointColorMap();
    clearTreeView3DObjects();

    const points = collectSceneAnchorTreePoints();
    if (!points.length) {
        frameTreeView3D();
        return points;
    }

    const axes = new THREE.AxesHelper(40);
    treeView3DObjects.add(axes);

    for (const point of points) {
        const partName = point.items?.[0]?.nme?.split(".").slice(0, 2).join(".");
        const color = getTreePointColorByPart(partName);
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(Math.max(1.5, Math.min(3.5, point.items.length))),
            new THREE.MeshBasicMaterial({ color })
        );
        sphere.position.copy(point.point);
        treeView3DObjects.add(sphere);

        const labelEl = document.createElement("div");
        labelEl.className = "tree-view-3d-label";
        labelEl.textContent = point.letter;
        labelEl.style.color = color;
        labelEl.style.fontWeight = "700";
        labelEl.style.textShadow = "0 0 6px rgba(0,0,0,0.8)";
        labelEl.style.background = "rgba(0,0,0,0.4)";
        labelEl.style.padding = "2px 6px";
        labelEl.style.borderRadius = "4px";
        labelEl.style.whiteSpace = "nowrap";

        const label = new CSS2DObject(labelEl);
        label.position.copy(point.point);
        label.position.z += 5;
        treeView3DObjects.add(label);

        treeViewPointColors.set(point.letter, color);
    }

    addTreeView3DDimensions(points);
    setTree3DViewDirection(treeRenderDirection);
    frameTreeView3D();
    return points.map(point => ({
        letter: point.letter,
        key: point.key,
        items: point.items,
        x: point.x,
        y: point.y,
        z: point.z
    }));
}

function treeView3DNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 10));
}

function getTreeView3DAlignedDistances(points) {
    const EPS = 1;
    const out = [];
    const seenValue = new Set();
    const bucketKey = value => String(Math.round(Number(value || 0) / EPS));

    function addAdjacent(list, axis) {
        const sorted = [...list].sort((a, b) => axis === "X" ? a.x - b.x : a.y - b.y);
        for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i];
            const b = sorted[i + 1];
            const value = axis === "X" ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
            if (value <= EPS) continue;

            const valueKey = `${axis}:${treeView3DNumber(value)}`;
            if (seenValue.has(valueKey)) continue;
            seenValue.add(valueKey);

            out.push({ from: a, to: b, axis, value });
        }
    }

    const byY = new Map();
    const byX = new Map();

    for (const point of points) {
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

    return out;
}

function addTreeView3DDimensions(points) {
    const dimensions = getTreeView3DAlignedDistances(points);
    const offsets = { X: new THREE.Vector3(0, 6, 5), Y: new THREE.Vector3(6, 0, 5) };

    for (const dim of dimensions) {
        const color = getTreePointColor(dim.from.letter);
        const from = dim.from.point.clone().add(offsets[dim.axis]);
        const to = dim.to.point.clone().add(offsets[dim.axis]);
        const lineGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(
            lineGeo,
            new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
        );
        treeView3DObjects.add(line);

        const labelEl = document.createElement("div");
        labelEl.className = "tree-view-3d-dim-label";
        labelEl.style.color = color;
        labelEl.textContent = `${dim.axis} ${treeView3DNumber(dim.value)}`;
        labelEl.title = `${dim.from.letter}-${dim.to.letter}`;

        const label = new CSS2DObject(labelEl);
        label.position.copy(from).add(to).multiplyScalar(0.5);
        label.position.z += 3;
        treeView3DObjects.add(label);
    }
}

function treeRenderAxisVector(axis) {
    if (axis === "x") return new THREE.Vector3(1, 0, 0);
    if (axis === "y") return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(0, 0, 1);
}

function treeRenderVisibleAxes() {
    if (treeRenderDirection === "x") return { horizontal: "y", vertical: "z" };
    if (treeRenderDirection === "y") return { horizontal: "x", vertical: "z" };
    return { horizontal: "x", vertical: "y" };
}

function treeRenderPointCoord(point, axis) {
    return Number(point?.[axis]) || 0;
}

function collectTreeRenderDimensions(points) {
    const EPS = 1;
    const dimensions = [];
    const seenValue = new Set();
    const axes = treeRenderVisibleAxes();

    function collect(axis, perpendicular, orientation) {
        const buckets = new Map();
        for (const point of points) {
            const key = String(Math.round(treeRenderPointCoord(point, perpendicular) / EPS));
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(point);
        }

        for (const list of buckets.values()) {
            if (list.length < 2) continue;
            const sorted = [...list].sort((a, b) => treeRenderPointCoord(a, axis) - treeRenderPointCoord(b, axis));
            for (let i = 0; i < sorted.length - 1; i++) {
                const from = sorted[i];
                const to = sorted[i + 1];
                const value = Math.abs(treeRenderPointCoord(to, axis) - treeRenderPointCoord(from, axis));
                if (value <= EPS) continue;
                const valueKey = `${axis}:${treeView3DNumber(value)}`;
                if (seenValue.has(valueKey)) continue;
                seenValue.add(valueKey);
                dimensions.push({ from, to, axis, perpendicular, orientation, value });
            }
        }
    }

    collect(axes.horizontal, axes.vertical, "horizontal");
    collect(axes.vertical, axes.horizontal, "vertical");

    return dimensions;
}

function addTreeRenderPartEdgeLabel(obj, color, valueCm, localPosition, axis) {
    if (!treeRenderOverlay || !Number.isFinite(valueCm) || valueCm <= 0) return;

    const labelEl = document.createElement("div");
    labelEl.className = "tree-render-dim-label";
    labelEl.style.color = color;

    const labelText = document.createElement("span");
    labelText.className = axis === "z"
        ? "tree-render-dim-text tree-render-dim-text-vertical"
        : "tree-render-dim-text";
    labelText.style.color = color;
    labelText.textContent = treeView3DNumber(valueCm);
    labelEl.appendChild(labelText);

    obj.updateWorldMatrix(true, false);
    const worldPosition = obj.localToWorld(localPosition.clone());
    const label = new CSS2DObject(labelEl);
    label.position.copy(worldPosition);
    label.userData.treePartKey = treeRenderPartKey(obj);
    treeRenderOverlay.add(label);
}

function addTreeRenderDimensions() {
    const targetPartKeys = collectTreeRenderDimensionPartKeys();
    const seenKorpusDims = new Map();
    const projectDim = projectDefaultHasDimViewFlag(window.PR);

    function shouldRenderKorpusDim(korpusName, axis, valueCm) {
        const value = Math.round(Number(valueCm) * 10);
        if (!Number.isFinite(value) || value <= 0) return false;
        const key = `${axis}:${value}`;
        if (!seenKorpusDims.has(korpusName)) seenKorpusDims.set(korpusName, new Set());
        const seen = seenKorpusDims.get(korpusName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }

    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;
        const partData = obj.userData?.partData || {};
        const korpusData = window.PR?.oks?.[obj.userData?.korpusName] || {};
        const explicitPartDim = Boolean(partData.dim || hasDimViewFlag(partData.vi));
        const inheritedKorpusDim = !explicitPartDim && Boolean(projectDim || korpusData.dim || hasDimViewFlag(korpusData.vi));
        if (!explicitPartDim && !inheritedKorpusDim) return;
        const bb = obj.userData.localBB;
        if (!bb) return;

        const key = treeRenderPartKey(obj);
        if (!targetPartKeys.has(key)) return;
        const korpusName = obj.userData?.korpusName || "?";
        const color = getTreePointColorByPart(key) || "#ffffff";
        const w = bb.max.x - bb.min.x;
        const d = bb.max.y - bb.min.y;
        const h = bb.max.z - bb.min.z;

        if (explicitPartDim || shouldRenderKorpusDim(korpusName, "x", w)) {
            addTreeRenderPartEdgeLabel(
                obj,
                color,
                w,
                new THREE.Vector3((bb.min.x + bb.max.x) * 0.5, bb.min.y, bb.min.z),
                "x"
            );
        }
        if (explicitPartDim || shouldRenderKorpusDim(korpusName, "y", d)) {
            addTreeRenderPartEdgeLabel(
                obj,
                color,
                d,
                new THREE.Vector3(bb.min.x, (bb.min.y + bb.max.y) * 0.5, bb.min.z),
                "y"
            );
        }
        if (explicitPartDim || shouldRenderKorpusDim(korpusName, "z", h)) {
            addTreeRenderPartEdgeLabel(
                obj,
                color,
                h,
                new THREE.Vector3(bb.min.x, bb.min.y, (bb.min.z + bb.max.z) * 0.5),
                "z"
            );
        }
    });
}

function collectTreeRenderDimensionPartKeys() {
    const targetPartKeys = new Set();
    const seenKorpusDims = new Map();

    function markKorpusDim(korpusName, axis, valueCm) {
        const value = Math.round(Number(valueCm) * 10);
        if (!Number.isFinite(value) || value <= 0) return false;
        const key = `${axis}:${value}`;
        if (!seenKorpusDims.has(korpusName)) seenKorpusDims.set(korpusName, new Set());
        const seen = seenKorpusDims.get(korpusName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }

    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;
        const partData = obj.userData?.partData || {};
        const korpusData = window.PR?.oks?.[obj.userData?.korpusName] || {};
        const explicitPartDim = Boolean(partData.dim || hasDimViewFlag(partData.vi));
        const inheritedKorpusDim = !explicitPartDim && Boolean(
            projectDefaultHasDimViewFlag(window.PR) ||
            korpusData.dim ||
            hasDimViewFlag(korpusData.vi)
        );
        if (!explicitPartDim && !inheritedKorpusDim) return;

        const bb = obj.userData.localBB;
        if (!bb) return;
        const key = treeRenderPartKey(obj);
        if (explicitPartDim) {
            targetPartKeys.add(key);
            return;
        }

        const korpusName = obj.userData?.korpusName || "?";
        const dims = [
            ["x", bb.max.x - bb.min.x],
            ["y", bb.max.y - bb.min.y],
            ["z", bb.max.z - bb.min.z]
        ];
        if (dims.some(([axis, value]) => markKorpusDim(korpusName, axis, value))) {
            targetPartKeys.add(key);
        }
    });

    return targetPartKeys;
}

function projectHasDimViewFlag(pr) {
    if (projectDefaultHasDimViewFlag(pr)) return true;

    for (const korpus of Object.values(pr?.oks || {})) {
        if (!korpus || typeof korpus !== "object") continue;
        if (hasDimViewFlag(korpus.vi)) return true;
        for (const partName of korpus.jj || []) {
            if (hasDimViewFlag(korpus[partName]?.vi)) return true;
        }
    }

    return false;
}

function projectDefaultHasDimViewFlag(pr) {
    if (hasDimViewFlag(pr?.vi)) return true;
    return (pr?.projectDefaults || []).some(token => /^vi[.:=]dim$/i.test(String(token || "")));
}

function clearKorpusTreeRender() {
    restoreTreeRenderPartColors();
    if (!treeRenderOverlay) return;
    scene?.remove(treeRenderOverlay);
    treeRenderOverlay.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) obj.material.dispose?.();
        if (obj.element) obj.element.remove?.();
    });
    treeRenderOverlay = null;
}

function objectCenter(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
}

function anchorTreeRound(value) {
    return Math.round(Number(value || 0) * 10) / 10;
}

function anchorTreePointKey(point) {
    const x = anchorTreeRound(point.x);
    const y = anchorTreeRound(point.y);
    const z = anchorTreeRound(point.z);

    if (treeRenderDirection === "x") return `${y},${z}`;
    if (treeRenderDirection === "y") return `${x},${z}`;
    return `${x},${y}`;
}

function collectSceneAnchorTreePoints() {
    const byPoint = new Map();

    modelGroup?.traverse(obj => {
        if (obj.userData?.type !== "part") return;

        const anchors = getAnchorPoints(obj);
        if (!anchors) return;

        const partName = `${obj.userData.korpusName || "?"}.${obj.userData.partName || "?"}`;

        for (const [anchorName, point] of Object.entries(anchors)) {
            if (!/^c\d$/.test(anchorName)) continue;

            const key = anchorTreePointKey(point);

            if (!byPoint.has(key)) {
                byPoint.set(key, {
                    key,
                    letter: "",
                    items: [],
                    x: point.x,
                    y: point.y,
                    z: point.z,
                    point
                });
            }

            byPoint.get(key).items.push({
                nme: `${partName}.${anchorName}`
            });
        }
    });

    const points = [...byPoint.values()];

    points
        .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z || a.key.localeCompare(b.key))
        .forEach((point, index) => {
            point.letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index % 26];
        });

    return points;
}

function setTreeOrthographicCamera(direction = treeRenderDirection) {
    if (!modelGroup || !renderer || !labelRenderer) return;
    treeRenderDirection = direction;

    const box = new THREE.Box3().setFromObject(modelGroup);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const spans = {
        x: Math.max(size.y, size.z, 100),
        y: Math.max(size.x, size.z, 100),
        z: Math.max(size.x, size.y, 100)
    };
    const span = spans[direction] * 1.25;
    const near = 1;
    const far = Math.max(size.x + size.y + size.z + 2000, 3000);

    camera = new THREE.OrthographicCamera(
        -span / 2,
        span / 2,
        span / 2,
        -span / 2,
        near,
        far
    );
    if (direction === "x") {
        camera.up.set(0, 0, 1);
        camera.position.set(box.max.x + far * 0.5, center.y, center.z);
    } else if (direction === "y") {
        camera.up.set(0, 0, 1);
        camera.position.set(center.x, box.max.y + far * 0.5, center.z);
    } else {
        camera.up.set(0, 1, 0);
        camera.position.set(center.x, center.y, box.max.z + far * 0.5);
    }
    camera.lookAt(center.x, center.y, center.z);
    camera.layers.enableAll();
    scene.add(camera);

    setRendererSquareSize();

    controls?.dispose?.();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.target.copy(center);
    controls.update();
}

function restoreKorpusPerspectiveRender() {
    clearKorpusTreeRender();
    editorViewMode = "normal";
    if (!scene || !modelGroup || !renderer?.domElement) return;

    const box = new THREE.Box3().setFromObject(modelGroup);
    if (box.isEmpty()) return;

    scene.remove(camera);
    camera = new THREE.PerspectiveCamera(50, 1, 2, 100000);
    camera.up.set(0, 0, 1);
    camera.layers.enableAll();
    scene.add(camera);

    controls?.dispose?.();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;

    fitCameraToObject(modelGroup);
}

function setEditorViewMode(mode = "normal", options = {}) {
    const nextMode = ["normal", "wireframe", "measure"].includes(mode) ? mode : "normal";
    clearKorpusTreeRender();
    editorViewMode = nextMode;

    if (!scene || !modelGroup) return editorViewMode;

    if (nextMode === "wireframe") {
        applyEditorWireframeView();
    }

    if (nextMode === "measure") {
        if (!options.keepBackground) {
            if (treeRenderSavedBackground === null) treeRenderSavedBackground = scene.background;
            scene.background = new THREE.Color("#000000");
        }
        updateTreePointColorMap(true);
        applyTreeRenderPartColors({
            preserveSurface: options.preserveSurface,
            onlyPartKeys: collectTreeRenderDimensionPartKeys()
        });

        treeRenderOverlay = new THREE.Group();
        treeRenderOverlay.name = "editorMeasureOverlay";
        scene.add(treeRenderOverlay);
        addTreeRenderDimensions();
    }

    renderer?.render?.(scene, camera);
    labelRenderer?.render?.(scene, camera);
    return editorViewMode;
}

function cycleEditorViewMode() {
    const order = ["normal", "wireframe", "measure"];
    const currentIndex = order.indexOf(editorViewMode);
    const nextMode = order[(currentIndex + 1) % order.length];
    return setEditorViewMode(nextMode);
}

function showKorpusTreeRender(_groups = [], _edges = [], options = {}) {
    if (!scene || !modelGroup) return;

    clearKorpusTreeRender();
    setTreeOrthographicCamera(treeRenderDirection);
    updateTreePointColorMap(Boolean(options.dimensions));
    if (options.dimensions) {
        if (scene && treeRenderSavedBackground === null) treeRenderSavedBackground = scene.background;
        if (scene) scene.background = new THREE.Color("#000000");
        if (controls) {
            controls.enableRotate = true;
            controls.update();
        }
        applyTreeRenderPartColors();
    }

    const points = collectSceneAnchorTreePoints();
    treeRenderOverlay = new THREE.Group();
    treeRenderOverlay.name = "treeRenderOverlay";
    scene.add(treeRenderOverlay);

    for (const point of points) {
        const title = point.items.map(item => displayPartName(item.nme)).join(", ");
        const partName = point.items?.[0]?.nme?.split(".").slice(0, 2).join(".");
        const color = getTreePointColorByPart(partName);
        treeViewPointColors.set(point.letter, color);

        const crossEl = document.createElement("div");
        crossEl.className = "tree-render-cross";
        crossEl.title = title;
        crossEl.style.setProperty("--tree-point-color", color);

        const cross = new CSS2DObject(crossEl);
        cross.position.copy(point.point);
        cross.userData.treeLetter = point.letter;
        treeRenderOverlay.add(cross);

        const letterEl = document.createElement("div");
        letterEl.className = "tree-render-letter";
        letterEl.textContent = point.letter;
        letterEl.title = title;
        letterEl.style.color = color;

        const letter = new CSS2DObject(letterEl);
        letter.position.copy(point.point);
        letter.position.x += 3.3;
        letter.position.y += 3.3;
        letter.userData.treeLetter = point.letter;
        treeRenderOverlay.add(letter);
    }

    if (options.dimensions) addTreeRenderDimensions(points);

    return points.map(point => ({
        letter: point.letter,
        key: point.key,
        items: point.items,
        x: point.x,
        y: point.y,
        z: point.z
    }));
}

function setKorpusTreeViewDirection(direction, options = {}) {
    if (!["x", "y", "z"].includes(direction)) return [];
    treeRenderDirection = direction;
    return showKorpusTreeRender([], [], options);
}

window.showKorpusTreeRender = showKorpusTreeRender;
window.setKorpusTreeViewDirection = setKorpusTreeViewDirection;
window.renderKorpusTree3DView = renderKorpusTree3DView;
window.getTreePointColor = getTreePointColor;
window.restoreKorpusPerspectiveRender = restoreKorpusPerspectiveRender;
window.setEditorViewMode = setEditorViewMode;
window.cycleEditorViewMode = cycleEditorViewMode;
window.filterKorpusTreeLetters = function (letters) {
    if (!treeRenderOverlay) return;

    const allowed = new Set(letters || []);
    const showAll = allowed.size === 0;

    treeRenderOverlay.traverse(obj => {
        const letters = obj.userData?.treeLetters || (obj.userData?.treeLetter ? [obj.userData.treeLetter] : null);
        if (!letters) return;
        const isVisible = showAll || letters.some(letter => allowed.has(letter));
        if (obj.element) {
            obj.element.style.display = isVisible ? "" : "none";
        } else {
            obj.visible = isVisible;
        }
    });
};




function parseDWGInput(line) {
    const parts = line.split("@dock");
    const name = parts[0].trim();

    let dock = null;

    if (parts[1]) {
        const def = parts[1].trim();
        const [base, attach] = def.split(":");
        if (base && attach) {
            dock = {
                base: base.trim(),
                attach: attach.trim()
            };
        }
    }

    return { name, dock };
}


/* =========================================================
   LABEL=========================================================
 */

function fmtNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function partFaceDims(part) {
    return [cc(part?.w), cc(part?.d), cc(part?.h)]
        .filter(Number.isFinite)
        .sort((a, b) => b - a)
        .slice(0, 2);
}

function collectBeschlagCounts(value, out = {}) {
    if (!value) return out;

    if (Array.isArray(value)) {
        for (const item of value) collectBeschlagCounts(item, out);
        return out;
    }

    if (typeof value === "string") {
        out[value] = (out[value] || 0) + 1;
        return out;
    }

    if (typeof value === "object") {
        const name = value.nme || value.name || value.typ || value.type || value.art || value.id;
        const count = Number(value.n || value.count || value.qty || value.anz || 1);

        if (name) {
            out[name] = (out[name] || 0) + (Number.isFinite(count) ? count : 1);
            return out;
        }

        for (const [key, val] of Object.entries(value)) {
            if (typeof val === "number") out[key] = (out[key] || 0) + val;
            else collectBeschlagCounts(val, out);
        }
    }

    return out;
}

function mergeCounts(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
        target[key] = (target[key] || 0) + Number(value || 0);
    }
    return target;
}

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

function summarizeProject(pr) {
    const material = {};
    const korpusCosts = [];
    const korpusBeschlag = {};
    const totalBeschlag = collectBeschlagCounts(pr?.lbes);
    let edgeAll = 0;
    let edgeFront = 0;
    let partCount = 0;

    for (const [name, k] of Object.entries(pr?.oks || {})) {
        if (!k || Array.isArray(k)) continue;

        korpusCosts.push({
            name,
            price: Number(k.ep || 0)
        });

        const kb = {};
        for (const key of ["lbes", "bes", "beschlag", "beschlaege", "hardware"]) {
            mergeCounts(kb, collectBeschlagCounts(k[key]));
        }
        korpusBeschlag[name] = kb;
        mergeCounts(totalBeschlag, kb);

        for (const partName of k.jj || []) {
            const part = k[partName];
            if (!part || typeof part !== "object") continue;

            const dims = partFaceDims(part);
            if (dims.length < 2) continue;

            partCount++;
            const matId = part.m ?? k.m ?? 0;
            const mat = pr?.lm?.[matId] || {};
            const matName = mat.nme || mat.co || `m${matId}`;
            const net = dims[0] * dims[1] / 10000;
            const gross = Number(part.m2);
            const grossArea = Number.isFinite(gross) ? gross : net * 1.3;
            const allEdge = 2 * (dims[0] + dims[1]) / 100 * 1.1;
            const frontEdge = dims[0] / 100 * 1.1;

            edgeAll += allEdge;
            edgeFront += frontEdge;

            if (!material[matName]) {
                material[matName] = { net: 0, gross: 0, price: 0 };
            }

            material[matName].net += net;
            material[matName].gross += grossArea;
            material[matName].price += grossArea * Number(mat.p || 0) + allEdge * Number(mat.pu || 0);
        }
    }

    return {
        name: pr?.nme || "Projekt",
        price: Number(pr?.eur || 0),
        korpusCount: Object.values(pr?.oks || {}).filter(k => k && !Array.isArray(k)).length,
        partCount,
        edgeAll,
        edgeFront,
        material,
        korpusCosts,
        totalBeschlag,
        korpusBeschlag
    };
}

function countListHtml(counts) {
    const entries = Object.entries(counts || {}).filter(([, value]) => Number(value) !== 0);
    if (!entries.length) return `<div class="project-summary-muted">0</div>`;
    return entries
        .map(([key, value]) => `<div><span>${key}</span><b>${fmtNumber(value, 0)}</b></div>`)
        .join("");
}

function projectSummaryHtml(pr) {
    const s = summarizeProject(pr);
    const materials = Object.entries(s.material)
        .map(([name, m]) => `
            <div><span>${name}</span><b>${fmtNumber(m.net)} m2 netto</b><b>${fmtNumber(m.gross)} m2 brutto</b><b>${fmtNumber(m.price)} EUR</b></div>
        `).join("") || `<div class="project-summary-muted">keine Materialdaten</div>`;

    const korpus = s.korpusCosts
        .map(k => `<div><span>${k.name}</span><b>${fmtNumber(k.price)} EUR</b></div>`)
        .join("") || `<div class="project-summary-muted">keine Korpusse</div>`;

    const korpusBeschlag = s.korpusCosts
        .map(k => `<section><h4>${k.name}</h4>${countListHtml(s.korpusBeschlag[k.name])}</section>`)
        .join("");

    return `
        <header>
            <strong>${s.name}</strong>
            <button type="button" data-project-summary-close>schließen</button>
        </header>
        <div class="project-summary-grid">
            <div><span>Korpusse</span><b>${fmtNumber(s.korpusCount, 0)}</b></div>
            <div><span>Teile</span><b>${fmtNumber(s.partCount, 0)}</b></div>
            <div><span>Preis gesamt</span><b>${fmtNumber(s.price)} EUR</b></div>
            <div><span>Kantenband ringsum</span><b>${fmtNumber(s.edgeAll)} m</b></div>
            <div><span>Kantenband Vorderkanten</span><b>${fmtNumber(s.edgeFront)} m</b></div>
        </div>
        <h3>Material</h3>
        <div class="project-summary-table project-summary-material">${materials}</div>
        <h3>Korpusse</h3>
        <div class="project-summary-table">${korpus}</div>
        <h3>Beschlaege gesamt</h3>
        <div class="project-summary-table">${countListHtml(s.totalBeschlag)}</div>
        <h3>Beschlaege je Korpus</h3>
        <div class="project-summary-table">${korpusBeschlag}</div>
    `;
}

function ensureProjectSummaryPanel() {
    if (projectSummaryPanel) return projectSummaryPanel;

    projectSummaryPanel = document.createElement("div");
    projectSummaryPanel.id = "projectSummaryPanel";
    projectSummaryPanel.style.cssText = [
        "position:absolute",
        "left:10px",
        "top:42px",
        "width:min(460px,calc(100% - 20px))",
        "max-height:calc(100% - 52px)",
        "overflow:auto",
        "box-sizing:border-box",
        "background:#fff",
        "border:1px solid #9aa19a",
        "box-shadow:0 12px 28px rgba(0,0,0,.16)",
        "padding:10px",
        "z-index:35",
        "display:none",
        "font:12px system-ui,sans-serif",
        "color:#1d211d"
    ].join(";");
    container.appendChild(projectSummaryPanel);
    return projectSummaryPanel;
}

function showProjectSummary() {
    const panel = ensureProjectSummaryPanel();
    panel.innerHTML = projectSummaryHtml(window.PR);
    panel.style.display = "block";
    panel.querySelector("[data-project-summary-close]")?.addEventListener("click", () => {
        panel.style.display = "none";
    });
}

function ensureProjectLabel() {
    if (projectLabel) return projectLabel;

    const style = document.createElement("style");
    style.textContent = `
        #projectSummaryPanel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        #projectSummaryPanel header strong{font-size:13px}
        #projectSummaryPanel button{border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer}
        #projectSummaryPanel h3{font-size:12px;margin:12px 0 5px}
        #projectSummaryPanel h4{font-size:12px;margin:7px 0 3px}
        .project-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .project-summary-grid>div,.project-summary-table>div,.project-summary-table section>div{display:flex;gap:8px;justify-content:space-between;border-bottom:1px solid #e3e5e1;padding:4px 0}
        .project-summary-material>div{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center}
        .project-summary-muted{color:#687068;padding:4px 0}
    `;
    document.head.appendChild(style);

    projectLabel = document.createElement("button");
    projectLabel.type = "button";
    projectLabel.id = "projectLabel";
    projectLabel.style.cssText = [
        "position:absolute",
        "left:10px",
        "top:10px",
        "z-index:34",
        "border:1px solid #8f9690",
        "background:#ffffff",
        "color:#1d211d",
        "padding:5px 9px",
        "font:12px system-ui,sans-serif",
        "cursor:pointer",
        "box-shadow:0 2px 8px rgba(0,0,0,.10)"
    ].join(";");
    projectLabel.addEventListener("click", showProjectSummary);
    container.appendChild(projectLabel);
    return projectLabel;
}

function updateProjectLabel(pr) {
    const label = ensureProjectLabel();
    const title = pr?.nme || "Projekt";
    label.textContent = title;
    label.style.borderColor = "#8f9690";
    label.style.background = "#ffffff";
    label.removeAttribute("title");
    document.title = title;
}





/* =========================================================
   LOOP
========================================================= */

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

/* =========================================================
   ENTRY
========================================================= */
export async function magie(pr) {
    if (!pr) return;
    if (pr && typeof pr.then === "function") {
        pr = await pr;
    }
    initThree();
    resTracker = new ResourceTracker();
    const editor = document.getElementById("inn");
    const text = pr.inn || urlToInnCurrent();
    if (editor) editor.value = text;
    setUrlNoReload(innToUrl(text));
    window.renderLineButtonsFromInn?.();
    renderMainWithDWGs(pr);
    animate();
}


function getCorner(group, idx) {
    const box = new THREE.Box3().setFromObject(group);
    const { min, max } = box;

    const corners = [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z)
    ];
    return corners[idx];
}

function applyConnect(fromGroup, toGroup, fromCorner, toCorner) {
    const pFrom = getCorner(fromGroup, fromCorner);
    const pTo = getCorner(toGroup, toCorner);

    fromGroup.position.add(pTo.clone().sub(pFrom));
}




function onSceneClick(event) {
    if (wasSceneDrag(event)) return;

    const stateBeforeClick = window.CURRENT_STATE || "main";

    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(anchorMarkers, false);
    if (hits.length) {
        handleAnchorSelection(pickAnchorHit(hits));
        return;
    }

    if (!modelGroup) {
        closeInspectorAndRestore();
        return;
    }

    const partHits = raycaster.intersectObjects(modelGroup.children, true)
        .filter(hit => hit.object?.userData?.type === "part");

    if (!partHits.length) {
        closeInspectorAndRestore();
        return;
    }

    rememberInspectorRestoreState(stateBeforeClick);
    if (window.CURRENT_STATE !== "inn") {
        window.setState?.("inn");
    }
    showPartInspector(partHits[0].object);
}

function pickAnchorHit(hits) {
    const ranked = hits.map(hit => {
        const p = hit.object.position.clone().project(camera);
        const screenDist = Math.hypot(p.x - mouse.x, p.y - mouse.y);

        return {
            hit,
            screenDist,
            edgeRank: hit.object.userData?.isEdge ? 0 : 1
        };
    });

    ranked.sort((a, b) =>
        (a.screenDist - b.screenDist) ||
        (a.edgeRank - b.edgeRank) ||
        (a.hit.distance - b.hit.distance)
    );

    return ranked[0].hit.object;
}

function partFieldValue(part, key) {
    const value = part?.[key];
    return inspectorFieldValue(value);
}

function roundInspectorNumber(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && value.trim() === "") return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return Math.round(n * 100) / 100;
}

function inspectorFieldValue(value) {
    if (value == null) return "";
    if (Array.isArray(value)) {
        return value.map(v => v == null ? "" : roundInspectorNumber(v)).join(",");
    }
    return roundInspectorNumber(value);
}

const INSPECTOR_FIELDS = {
    order: "nme comment p w d h x y z m s u i j cur tar".split(" "),
    korpus: "nme p w d h x y z m dim u i".split(" "),
    part: "nme w d h x y z m dim u".split(" ")
};

function inspectorFieldsFor(type, obj) {
    const fields = INSPECTOR_FIELDS[type] || [];
    return fields.filter(key => key === "nme" || (obj && key in obj));
}

function inspectorAlias(key) {
    return window.C3_INSPECTOR_ALIASES?.[key]?.label || key;
}

function inspectorHelp(key) {
    return window.C3_INSPECTOR_ALIASES?.[key]?.help || "";
}

function createInspectorLabel(key, id) {
    const label = document.createElement("label");
    label.htmlFor = id;
    label.title = inspectorHelp(key) || key;
    label.style.cssText = "display:flex;flex-direction:column;gap:1px;line-height:1.1";

    const alias = document.createElement("span");
    alias.textContent = inspectorAlias(key);

    const code = document.createElement("span");
    code.textContent = key;
    code.style.cssText = "font-size:10px;color:#66706a";

    label.append(alias, code);
    return label;
}

function materialOptionLabel(index, mat) {
    if (!mat || typeof mat !== "object") return String(index);
    const bits = [
        index,
        mat.nme,
        mat.co,
        mat.s != null ? `${mat.s}` : ""
    ].filter(Boolean);
    return bits.join(" ");
}

function createInspectorControl(key, id, value) {
    const style = "width:100%;box-sizing:border-box;padding:4px;border:1px solid #b9beb8";

    if (key === "m") {
        const select = document.createElement("select");
        select.id = id;
        select.name = key;
        select.style.cssText = style;

        const current = String(value ?? "");
        const materials = Object.entries(window.PR?.lm || {})
            .filter(([, mat]) => mat && typeof mat === "object");

        if (current && !materials.some(([index]) => String(index) === current)) {
            const opt = document.createElement("option");
            opt.value = current;
            opt.textContent = current;
            select.appendChild(opt);
        }

        for (const [index, mat] of materials) {
            const opt = document.createElement("option");
            opt.value = index;
            opt.textContent = materialOptionLabel(index, mat);
            select.appendChild(opt);
        }

        select.value = current;
        select.dataset.initial = select.value;
        return select;
    }

    const input = document.createElement("input");
    input.id = id;
    input.name = key;
    input.value = inspectorFieldValue(value);
    input.dataset.initial = input.value;
    input.style.cssText = style;
    input.type = "text";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    if (key === "nme") {
        input.readOnly = true;
        input.style.background = "#f4f5f2";
    }

    return input;
}

function formatInspectorPropertyValue(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return `[${value.map(formatInspectorPropertyValue).join(", ")}]`;
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(roundInspectorNumber(value));
}

function makeInspectorPropertiesText(obj) {
    const properties = document.createElement("pre");
    properties.textContent = formatInspectorProperties(obj);
    properties.style.cssText = [
        "grid-column:1/-1",
        "min-height:180px",
        "max-height:360px",
        "overflow:auto",
        "box-sizing:border-box",
        "width:100%",
        "margin:0",
        "padding:8px",
        "border:1px solid #c7ccc5",
        "background:#fafafa",
        "font:13px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace",
        "white-space:pre-wrap",
        "overflow-wrap:anywhere"
    ].join(";");
    return properties;
}

function formatInspectorProperties(obj) {
    return Object.keys(obj || {})
        .filter(key => !key.startsWith("__"))
        .sort((a, b) => {
            const order = INSPECTOR_FIELDS.order;
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            return a.localeCompare(b);
        })
        .map(key => `${key}: ${formatInspectorPropertyValue(obj[key])}`)
        .join("\n");
}

function formatDslValue(value) {
    if (Array.isArray(value)) {
        return value.map(v => v == null ? "" : v).join(",");
    }

    return String(value);
}

function changedFormEntries(form) {
    return Array.from(form.elements)
        .filter(el => el.name && !["submit", "button"].includes(el.type))
        .filter(el => String(el.value) !== String(el.dataset.initial ?? ""))
        .map(el => [el.name, el.value]);
}

function makeDslToken(key, value, partName = null) {
    const v = formatDslValue(value);
    const path = partName ? `${partName}.${key}` : key;

    return `${path}=${v}`;
}

function tokenMatchesPath(token, path) {
    return token === path ||
        token.startsWith(path + ".") ||
        token.startsWith(path + "=") ||
        token.startsWith(path + ":") ||
        new RegExp(`^${path}[+\\-]?\\d`).test(token);
}

function findKorpusLineIndex(lines, korpusName) {
    return lines.findIndex(line => {
        const first = line.trim().split(/\s+/)[0] || "";
        return first === korpusName;
    });
}

function patchInnLine(korpusName, changes) {
    const editor = document.getElementById("inn");
    if (!editor || !korpusName || !changes.length) return null;

    const lines = editor.value.split(/\r?\n/);
    let idx = findKorpusLineIndex(lines, korpusName);

    if (idx < 0) {
        lines.push(korpusName);
        idx = lines.length - 1;
    }

    const lineTokens = lines[idx].trim().split(/\s+/).filter(Boolean);
    const commentIndex = lineTokens.findIndex(token => String(token).startsWith("#"));
    const commentTokens = commentIndex >= 0 ? lineTokens.slice(commentIndex) : [];
    const parts = commentIndex >= 0 ? lineTokens.slice(0, commentIndex) : lineTokens;
    const head = parts.shift() || korpusName;
    const paths = new Set(changes.flatMap(change => [
        change.path,
        change.path.startsWith(head + ".") ? change.path : `${head}.${change.path}`
    ]));
    const kept = parts.filter(token => {
        for (const path of paths) {
            if (tokenMatchesPath(token, path)) return false;
        }
        return true;
    });

    const tokens = changes.map(change => change.token);

    lines[idx] = [head, ...kept, ...tokens, ...commentTokens].join(" ");
    editor.value = lines.join("\n");
    const url = innToUrl(editor.value);
    setUrlNoReload(url);
    return url;
}

function setSelectedPart(mesh) {
    if (selectedPartOutline) {
        selectedPartOutline.removeFromParent();
        selectedPartOutline.geometry?.dispose();
        selectedPartOutline.material?.dispose();
        selectedPartOutline = null;
    }

    if (selectedPartMesh && selectedPartMesh.material?.emissive) {
        selectedPartMesh.material.emissive.setHex(0x000000);
    }

    selectedPartMesh = mesh;

    if (selectedPartMesh?.material?.emissive) {
        selectedPartMesh.material.emissive.setHex(0x333333);
    }

    if (selectedPartMesh) {
        selectedPartOutline = new THREE.BoxHelper(selectedPartMesh, 0x00a3ff);
        selectedPartOutline.name = "selected_part_outline";
        scene.add(selectedPartOutline);
    }
}

function setSelectedKorpus(group) {
    if (selectedKorpusOutline) {
        selectedKorpusOutline.removeFromParent();
        selectedKorpusOutline.geometry?.dispose();
        selectedKorpusOutline.material?.dispose();
        selectedKorpusOutline = null;
    }
    if (selectedKorpusVisibleOutline) {
        selectedKorpusVisibleOutline.removeFromParent();
        selectedKorpusVisibleOutline.geometry?.dispose();
        selectedKorpusVisibleOutline.material?.dispose();
        selectedKorpusVisibleOutline = null;
    }

    setSelectedPart(null);

    if (group) {
        selectedKorpusOutline = makeKorpusBoxHelper(group);
        selectedKorpusOutline.name = "selected_korpus_outline";
        scene.add(selectedKorpusOutline);

        selectedKorpusVisibleOutline = makeVisibleKorpusBoxHelper(group);
        selectedKorpusVisibleOutline.name = "selected_korpus_visible_outline";
        scene.add(selectedKorpusVisibleOutline);
    }
}

function makeKorpusBoxHelper(group) {
    const box = getObjectAnchorBox(group);
    if (!box.isEmpty()) {
        return new THREE.Box3Helper(box, 0xffc400);
    }

    return new THREE.BoxHelper(group, 0xffc400);
}

function makeVisibleKorpusBoxHelper(group) {
    const box = getKorpusPushBox(group);
    if (!box.isEmpty()) {
        return new THREE.Box3Helper(box, 0x00aa66);
    }

    return new THREE.BoxHelper(group, 0x00aa66);
}

function showKorpusInspector(korpus, group) {
    rememberInspectorRestoreState("inn");
    if (group) {
        group.userData.type = "korpus";
        group.userData.korpusName = korpus?.nme || group.userData.korpusName || group.name;
        group.userData.korpusData = korpus;
        group.userData.localBB = makeKorpusLocalBB(korpus);
    }
    setSelectedKorpus(group);
    showAnchorMarkersForKorpus(group);
    const panel = ensurePartInspector();
    const editor = document.getElementById("inn");
    if (editor && window.CURRENT_STATE === "inn") editor.style.display = "block";
    const title = korpus?.nme || "korpus";
    const fields = inspectorFieldsFor("korpus", korpus);

    panel.innerHTML = "";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700";
    header.innerHTML = `<span>${title}</span>`;

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "schließen";
    close.style.cssText = "border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer";
    close.addEventListener("click", closeInspectorAndRestore);
    header.appendChild(close);
    panel.appendChild(header);

    const form = document.createElement("form");
    form.style.cssText = "display:grid;grid-template-columns:120px 1fr;gap:6px;align-items:center";

    for (const key of fields) {
        const label = createInspectorLabel(key, `korpus_${key}`);
        const input = createInspectorControl(key, `korpus_${key}`, korpus?.[key]);

        form.appendChild(label);
        form.appendChild(input);
    }

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "anwenden";
    submit.style.cssText = "grid-column:1/-1;margin-top:4px;padding:6px;border:1px solid #879087;background:#eef0ec;cursor:pointer";
    form.appendChild(submit);

    form.appendChild(makeInspectorPropertiesText(korpus));

    form.addEventListener("submit", event => {
        event.preventDefault();
        applyKorpusForm(korpus, group, form);
    });

    panel.appendChild(form);
    panel.style.display = "block";
}

function showPartInspector(mesh) {
    rememberInspectorRestoreState("inn");
    setSelectedPart(mesh);
    showAnchorMarkersForPart(mesh);
    const panel = ensurePartInspector();
    const editor = document.getElementById("inn");
    if (editor && window.CURRENT_STATE === "inn") editor.style.display = "block";
    const data = mesh.userData || {};
    const part = data.partData || {};
    const title = `${data.korpusName || ""}.${data.partName || "part"}`;
    const fields = inspectorFieldsFor("part", part);

    panel.innerHTML = "";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700";
    header.innerHTML = `<span>${title}</span>`;

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "schließen";
    close.style.cssText = "border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer";
    close.addEventListener("click", closeInspectorAndRestore);
    header.appendChild(close);
    panel.appendChild(header);

    const form = document.createElement("form");
    form.style.cssText = "display:grid;grid-template-columns:120px 1fr;gap:6px;align-items:center";

    for (const key of fields) {
        const label = createInspectorLabel(key, `part_${key}`);
        const value = key === "nme" ? (data.partName || part.nme || "") : partFieldValue(part, key);
        const input = createInspectorControl(key, `part_${key}`, value);

        form.appendChild(label);
        form.appendChild(input);
    }

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "anwenden";
    submit.style.cssText = "grid-column:1/-1;margin-top:4px;padding:6px;border:1px solid #879087;background:#eef0ec;cursor:pointer";
    form.appendChild(submit);

    form.appendChild(makeInspectorPropertiesText({
        nme: data.partName || part.nme || "",
        ...part
    }));

    form.addEventListener("submit", event => {
        event.preventDefault();
        applyPartForm(mesh, form);
    });

    panel.appendChild(form);
    panel.style.display = "block";
}

function applyPartForm(mesh, form) {
    const data = mesh.userData || {};
    const part = data.partData;
    const group = data.partGroup || mesh.parent;
    if (!part || !group) return;

    const changes = [];

    for (const [key, raw] of changedFormEntries(form)) {
        if (key === "nme") continue;
        if (raw === "") continue;
        part[key] = parseInspectorValue(key, raw);
        const path = `${data.partName}.${key}`;
        changes.push({
            path,
            token: makeDslToken(key, part[key], data.partName)
        });
    }

    patchInnLine(data.korpusName, changes);
    updatePartMesh(mesh, group, part);
}

function getProjectPathValue(path) {
    if (!path || !window.PR) return null;

    return String(path)
        .trim()
        .split(".")
        .reduce((obj, key) => obj?.[key], window.PR);
}

function resolveInspectorInputValue(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return raw;

    const direct = getProjectPathValue(s);
    if (direct != null && typeof direct !== "object") return direct;

    if (s.startsWith("(") && s.endsWith(")")) {
        const expr = s.slice(1, -1).replace(/[a-zA-Z][a-zA-Z0-9_.]*/g, key => {
            const value = getProjectPathValue(key);
            return value != null && typeof value !== "object" ? value : key;
        });

        try {
            const result = Function('"use strict"; return (' + expr + ')')();
            if (Number.isFinite(result)) return result;
        } catch {
            return raw;
        }
    }

    return raw;
}

function parseInspectorValue(key, raw) {
    if (raw === "") return null;

    if (["cur", "tar", "nx", "ny", "nz"].includes(key)) {
        return String(raw).split(",").map(v => {
            const s = v.trim();
            return s === "" ? null : (isNaN(s) ? s : Number(s));
        });
    }

    if (["p", "j", "co"].includes(key)) return raw;

    const resolved = resolveInspectorInputValue(raw);
    const n = Number(resolved);
    return Number.isFinite(n) ? n : raw;
}

function applyKorpusForm(korpus, group, form) {
    if (!korpus) return;

    const changes = [];

    for (const [key, raw] of changedFormEntries(form)) {
        const value = parseInspectorValue(key, raw);
        if (value == null) continue;
        korpus[key] = value;
        changes.push({
            path: key,
            token: makeDslToken(key, value)
        });
    }

    const url = patchInnLine(korpus.nme, changes);
    if (url) window.location.href = url;
}

function updatePartMesh(mesh, group, part) {
    const partName = group?.userData?.partName || mesh?.name || "part";
    const korpusName = group?.userData?.korpusName || mesh?.userData?.korpusName;
    const korpus = korpusName ? window.PR?.oks?.[korpusName] : null;
    const w = partDim(part.w, `${partName}.w`);
    const d = partDim(part.d, `${partName}.d`);
    const h = partDim(part.h, `${partName}.h`);

    mesh.geometry.dispose();
    mesh.geometry = resTracker.track(new THREE.BoxGeometry(w, d, h));

    const edge = mesh.children.find(child => child.isLineSegments);
    if (edge) {
        edge.geometry.dispose();
        edge.geometry = resTracker.track(new THREE.EdgesGeometry(mesh.geometry));
    }

    const mat = window.PR?.lm?.[part.m];
    if (mat) {
        mesh.material = createMaterialForPart(mat, [korpus?.vi, part.vi]);
    }
    if (mesh === selectedPartMesh && mesh.material?.emissive) {
        mesh.material.emissive.setHex(0x333333);
    }

    applyPartRotation(mesh, part, w, d, h);
    group.position.set(
        (w * 0.5) + cc(part.x),
        (d * 0.5) + cc(part.y),
        (h * 0.5) + cc(part.z)
    );

    mesh.updateMatrixWorld(true);
    group.userData.localBB = mesh.userData.localBB.clone();
    selectedPartOutline?.update();
}

// updateAndReloadURL();    
window.onresize = function () {
    setRendererSquareSize();
};


function handleAnchorSelection(marker) {

    if (!selectedAnchor) {
        selectedAnchor = marker;
        marker.userData.baseColor = marker.material.color.getHex();
        marker.material.color.set(0x00ff00); // grün = ausgewählt
        return;
    }

    // Zweiter Klick
    const a = selectedAnchor;
    const b = marker;

    if (a.userData.owner === b.userData.owner) {
        selectedAnchor.material.color.setHex(selectedAnchor.userData.baseColor || 0xff0000);
        selectedAnchor = null;
        return;
    }

    connectAnchorOwners(b, a);

    // Reset
    a.material.color.setHex(a.userData.baseColor || 0xff0000);
    selectedAnchor = null;

    removeAnchorMarkers();
    fitCameraToObject(modelGroup);
}

function roundedCoord(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(4)) : value;
}

function connectAnchorOwners(baseMarker, attachMarker) {
    persistAnchorConnect(attachMarker, baseMarker);
}

function markerKorpusName(marker) {
    return marker.userData.kind === "part"
        ? marker.userData.object?.userData?.korpusName
        : marker.userData.owner?.userData?.korpusName || marker.userData.owner?.name;
}

function markerPartName(marker) {
    return marker.userData.kind === "part"
        ? marker.userData.object?.userData?.partName
        : null;
}

function makeCurRef(marker) {
    return [
        null,
        markerPartName(marker),
        marker.userData.corner
    ];
}

function makeTarRef(marker) {
    return [
        markerKorpusName(marker),
        markerPartName(marker),
        marker.userData.corner
    ];
}

function persistAnchorConnect(curMarker, tarMarker) {
    const korpusName = markerKorpusName(curMarker);
    if (!korpusName) return;

    const cur = makeCurRef(curMarker);
    const tar = makeTarRef(tarMarker);
    const korpus = window.PR?.oks?.[korpusName];

    if (korpus) {
        korpus.cur = cur;
        korpus.tar = tar;
    }

    const url = patchInnLine(korpusName, [
        {
            path: "cur",
            token: makeDslToken("cur", cur)
        },
        {
            path: "tar",
            token: makeDslToken("tar", tar)
        }
    ]);

    if (url) {
        window.location.replace(url);
        window.location.reload();
    }
}



export function onRenderClicked() {

    updateAndReloadURL();
}
window.onRenderClicked = onRenderClicked

window.magie = magie;
// window.init=init
// magie();
// export function init() {
//     magie();
// }
