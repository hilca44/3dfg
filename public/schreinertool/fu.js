 const LIB={
  logo: "t=logo_S_mat.100,goldenrod_S_mat.16,cornflowerblue_N_D_S_d18_N_Z_S_10_N_W_S_50_N_-background_N_h_S_pb_S_w110_S_D_S_h110_S_mb2_S__N_-c-char_N_a_S_pgtl_S_wW_S_D_S_h50_S_z30_S_x10_N_-3-char_N_b_S_pgtr_S_wW_S_D_S_h50_S_zZ_S_x50_N_c_S_pgtr_S_wW_S_D_S_h50_S_cl0_bt0",
  test: "t=test_S_mat.19,white_S_mat.16,cornflowerblue_S_-t_S_-o_S_-e_S__N_a_S_60,55,72_S_mb_S__N_lotxt",
  tisch: "t=tisch_S_mat.19,white,8_S_mat.19,gray,11_S_mat.19,silver,25_S_-t_S_-o_S_-e_S__S__N_A_S_118_N_B_S_114.2_N_-tisch_N_t_S_ptlrb_S_wA_S_d80_S_h72_S_m1_S_ut-1r-1l_S_dt64,-2,1_S_ulr8f_S_n2,2_S_mb2_N_-kanal_N_k_S_pfbg_S_wtl3_tr0_S_d30_S_h22_S_ma2_S_cf1_tl2_S_y_P_40_S_sgx4,6_S_m2_S_nax2,2_N_ho_S_pflr_S_d64_S_h5_S_m3_S_cf1_tl2_S_nx2,6_S__S__S__N_-blende_N_b_S_pb_S_w120_S_d2_S_h108_S_cb0_tl4_S_z_P_8_S_n_N_-regalfach_N_r_S_plrgtc_S_w40_S_d18_S_htt2_bb2_S_cr6_bb2_S_n_S_sc3_S_zg_P_2_N_-ablag_N_a_S_pg_S_w120_S_d8_S_h2_S_cg1_bb5_S_m2_S_x_P_60_S_zz72_N_-oben_N_o_S_pg_S_d35_S_m2_S_cg0_rr2_S_x_P_-60_S_yg_P_-4",
}

export const DEFAULT_CORPUS =
`test mat.19,snow,14,1 mat.16,cornflowerblue,16 
a teil.sl,sr,bo,de,rw,eb breit.60 tief.55 hoch.72 eb.mat.2 #regal_1`;

const DEFAULT_CORPUS_url =
`test=mat.19%2Csnow%2C14%2C1%7Emat.16%2Ccornflowerblue%2C16--a%7Eteil.sl%2Csr%2Cbo%2Cde%2Crw%2Ceb%7Ebreit.60%7Etief.55%7Ehoch.72%7Eeb.mat.2%7E%23regal_1`;

function parseCornerSpec(v){

    if (v == null) return 0;

    if (Array.isArray(v)){
        return v.map(Number);
    }

    const s = String(v).trim();

    if (/^\d{2,}$/.test(s)){
        return s.split("").map(Number);
    }

    return Number(s);
}


function parseCornerRef(ref){

    if (!ref){
        const out = [null, null, 0];
        out.corner = 0;
        return out;
    }

    if (Array.isArray(ref)){

        const out = [
            ref[0] ?? null,
            ref[1] ?? null,
            parseCornerSpec(ref[2])
        ];
        out.corner = out[2];
        return out;
    }

    const parts = String(ref)
        .split(",")
        .map(s => s.trim());

    let target = parts[0] || null;
    let part = parts[1] || null;
    let corner = parts[2] ?? null;

    if (target && target.includes(".") && parts.length === 2){
        const targetParts = target.split(".");
        target = targetParts[0] || null;
        part = targetParts[1] || null;
        corner = parts[1];
    }

    const out = [
        target,
        part,
        parseCornerSpec(corner)
    ];
    out.corner = out[2];
    return out;
}

function normalizeCornerRefs(obj){

    if (!obj || typeof obj !== "object"){
        return obj;
    }

    if (Array.isArray(obj)){
        obj.forEach(normalizeCornerRefs);
        return obj;
    }

    for (const key in obj){
        if ((key === "tar" || key === "cur") && obj[key] != null){
            obj[key] = parseCornerRef(obj[key]);
            continue;
        }

        normalizeCornerRefs(obj[key]);
    }

    return obj;
}

function updateAndReloadURL() {
    let inn =window.document.getElementById("inn").value

  // let urlFromInn=makeFullUrlFromInn(inn)
  let urlFromInn=innToUrl(inn)
  // if(window.location.href!= urlFromInn){
  window.location.href=urlFromInn 

  // }

}

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


   function loadFromURL(url="") {
      var params
      if(url==""){

        params = new URLSearchParams(window.location.search);
      }else{
        params = new URLSearchParams(url);
      }
        const t = params.get('t');
        if (t) {
          let decoded = decodeURI(t);
          decoded = decoded
            .replace(/_N_/g, "\n")
            .replace(/_S_/g, " ")
            .replace(/_P_/g, "+");
          
        //   textBuffer = Array.from(decoded);
        //   cursorPos = textBuffer.length;
        //   renderEditor();
        return decoded
        }
      }
      
      // window.loadFromURL = loadFromURL

function decodeTOld(txt) {
  return decodeURI(
    txt
      .replace(/_S_/g, " ")
      .replace(/_N_/g, "\n")
      .replace(/_P_/g, "+")
  );
}

function decodeTNew(name, value) {

  const lines = value
    .split("--")
    .map(l => l.split("~").join(" "))
    .filter(Boolean);

  if (!lines.length) return null;

  let result = name + " " + lines[0];

  if (lines.length > 1) {
    result += "\n" + lines.slice(1).join("\n");
  }
  result = result.replace(/_P_/g, "+");

  return result;
}

function decodeT(txt) {
  return decodeURI(
    txt
      .replace(/_S_/g, " ")
      .replace(/_N_/g, "\n")
      .replace(/_P_/g, "+")
  );
}

///////////////////////////////
function setUrlNoReload(url) {
  history.pushState(null, "", url);   // fügt einen History-Eintrag hinzu
}
function innToUrl(inn) {

  if (!inn) return location.origin + location.pathname;

  const lines = inn
    .trim()
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) return location.origin + location.pathname;

  const firstWords = lines[0].split(/\s+/);

  let name = firstWords[0];

  // 🔒 Sicherheits-Check:
  // Key darf keine URL sein und kein "=" enthalten
  if (name.includes("http") || name.includes("=") || name.includes("?")) {
    console.warn("Ungültiger Name in DSL:", name);
    return location.origin + location.pathname;
  }

  const firstLineWithoutName = firstWords.slice(1).join(" ");

  const valueLines = [
    firstLineWithoutName,
    ...lines.slice(1)
  ];

  const value = valueLines
    .map(line => line.split(/\s+/).join("~"))
    .join("--");

  const url = new URL(location.origin + location.pathname);
  url.searchParams.set(name, value);

  return url.toString();
}

function urlToInn(url) {

  const defaultInn = DEFAULT_CORPUS;

  // --- helper: safe decode (nur 1x, ohne kaputtzugehen) ---
  function safeDecode(s) {
    if (s == null) return "";
    // URLSearchParams ist oft schon decoded – also nur versuchen, wenn % vorkommt
    if (!String(s).includes("%")) return String(s);
    try { return decodeURIComponent(s); } catch { return String(s); }
  }

  // --- URL bauen (oder aktuelle) ---
  const u = url ? new URL(url, location.origin) : new URL(location.href);

  // --- Query-String holen: erst ?..., sonst aus #?... ---
  let qs = u.search;
  if (!qs && u.hash && u.hash.includes("?")) {
    qs = u.hash.slice(u.hash.indexOf("?"));   // "#?...": wir nehmen ab "?"
  }

  if (!qs) return defaultInn;

  const params = new URLSearchParams(qs);

  const it = params.entries().next();
  if (it.done) return defaultInn;

  const [name, valueParam] = it.value;
  if (!valueParam) return defaultInn;

  const value = safeDecode(valueParam);

  // 🔵 Neue Mini-DSL (-- trennt Zeilen, ~ trennt Tokens)
  if (value.includes("--") || value.includes("~")) {
    return decodeTNew(name, value);
    // const lines = value
    //   .split("--")
    //   .map(l => l.split("~").join(" "))
    //   .filter(Boolean);

    // if (!lines.length) return defaultInn;

    // return [name + " " + lines[0], ...lines.slice(1)].join("\n");
  }

  // 🟠 Alte DSL (_S_ _N_ _P_)
  if (value.includes("_S_") || value.includes("_N_") || value.includes("_P_")) {
    // Wichtig: decodeTOld bekommt den *vollen* String
    return decodeTOld( value);
  }

  return defaultInn;
}

function urlToInnCurrent() {
  return urlToInn(window.location.href);
}
///////////////////////////////
function encodeTOld(txt) {
  return encodeURI(
    txt
      .replace(/\+/g, "_P_")
      .replace(/\n/g, "_N_")
      .replace(/ /g, "_S_")
  );
}

function encodeTNew(inn) {
  inn = inn.replace(/\+/g, "_P_")
  const lines = inn.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return location.origin + location.pathname;

  const name = lines[0].split(/\s+/)[0];

  const value = lines
    .map(line => line.split(/\s+/).join("~"))
    .join("--");

  // ✅ bleibt auf /index.html wenn du auf /index.html bist
  return location.origin + location.pathname + "?" + name + "=" + value;
}

function encodeT(txt) {
  return encodeURI(
    txt
      .replace(/\+/g, "_P_")
      .replace(/\n/g, "_N_")
      .replace(/ /g, "_S_")
  );
}



function makeInnFromFullUrl(url = window.location.href) {
  const u = new URL(url);
  const qs = new URLSearchParams(u.search);

  // kein Query → Default
  if ([...qs.keys()].length === 0) {
    return {
      name: "default",
      inn: DEFAULT_CORPUS
    };
  }

  // erstes Projekt nehmen
  const [name, raw] = [...qs.entries()][0];

  return {
    name,
    inn: decodeT(raw)
  };
}



function makeFullUrlFromInn(inn) {
  // Projektname = erstes Wort der ersten Zeile
  const m = inn.trim().match(/^([a-z0-9_-]+)/i);
  const name = m ? m[1] : "project";

  const qs = new URLSearchParams();
  qs.set(name, encodeT(inn));

  // komplette URL zusammenbauen
  return (
    window.location.origin +
    window.location.pathname +
    "?" +
    qs.toString()
  );
}


function getKeysFromQs(){

const qs = new URLSearchParams(window.location.search);
return [...qs.keys()];
}
// window.getKeysFromQs=getKeysFromQs




function onRenderClicked() {

    updateAndReloadURL();    
    magie()
}



function makeStueckliste(PR) {
  const rows = {};

  for (const key in PR.allpa) {
    const p = PR.allpa[key];

    // Schlüssel für gleiche Teile
    const sig = [
      p.co,
      p.s,
      p.w,
      p.d,
      p.h
    ].join("|");

    if (!rows[sig]) {
      rows[sig] = {
        co: p.co,
        s:  p.s,
        w:  p.w,
        d:  p.d,
        h:  p.h,
        n:  0,
        m2: 0
      };
    }

    rows[sig].n  += p.n || 1;
    rows[sig].m2 += Number(p.m2 || 0);
  }

  return Object.values(rows);
}

function makeMaterialUebersicht(PR) {
  const mat = {};

  for (const k in PR.allpa) {
    const p = PR.allpa[k];
    const key = `${p.co}|${p.s}`;

    if (!mat[key]) {
      mat[key] = {
        co: p.co,
        s:  p.s,
        n:  0,
        m2: 0
      };
    }

    const n = p.n || 1;
    mat[key].n  += n;
    mat[key].m2 += Number(p.m2 || 0) * n;
  }

  // 30 % Verschnitt
  for (const k in mat) {
    mat[k].m2_cut = mat[k].m2 * 1.3;
  }

  return Object.values(mat);
}


function renderMaterialUebersicht(PR) {
  const mats = makeMaterialUebersicht(PR);

  let out = "\nMATERIALÜBERSICHT\n";
  out += sep(70) + "\n";

  out +=
    pad("MAT", 6) +
    pad("STÄRKE", 10) +
    pad("TEILE", 8) +
    pad("m²", 10) +
    pad("m²+30%", 10) + "\n";

  out += line(70) + "\n";

  for (const m of mats) {
    out +=
      pad(m.co, 6) +
      pad(mm(m.s), 10) +
      pad(m.n, 8) +
      pad(m.m2.toFixed(2), 10) +
      pad(m.m2_cut.toFixed(2), 10) +
      "\n";
  }

  return out;
}

function renderProjektKopf(PR) {
  let out = "";
  out += PR.nme.toUpperCase() + "\n";
  out += sep(70) + "\n";
  out += "HOLZLISTE / STÜCKLISTE\n";
  return out;
}


// fu.js


/* ============================
1) ES-Module Export
============================ */
export {
  updateAndReloadURL, 
  makeFullUrlFromInn,
  makeInnFromFullUrl,
  encodeT,
  decodeT,
  encodeTNew,
  decodeTNew,
  encodeTOld,
  decodeTOld,
innToUrl,
urlToInn,
urlToInnCurrent,
setUrlNoReload, 
  onRenderClicked,
  loadURLfromDWG,
  makeStueckliste,
  parseCornerRef,
  parseCornerSpec,
  normalizeCornerRefs
};

/* ============================
2) Global verfügbar machen
(optional, aber genau dein Fall)
============================ */
if (typeof window !== "undefined") {
window.makeFullUrlFromInn=makeFullUrlFromInn,
window.encodeT=encodeT,
window.decodeT=decodeT,
window.onRenderClicked=onRenderClicked,
window.makeStueckliste=makeStueckliste,
window.makeMaterialUebersicht=makeMaterialUebersicht,
window.renderMaterialUebersicht=renderMaterialUebersicht,
window.renderProjektKopf=renderProjektKopf
}
