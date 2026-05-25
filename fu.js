const LIB={
  logo: "t=logo_S_m100o_S_m16b_N_D_S_d18_N_Z_S_10_N_W_S_50_N_-background_N_h_S_pb_S_w110_S_D_S_h110_S_mb2_S__N_-c-char_N_a_S_pgtl_S_wW_S_D_S_h50_S_z30_S_x10_N_-3-char_N_b_S_pgtr_S_wW_S_D_S_h50_S_zZ_S_x50_N_c_S_pgtr_S_wW_S_D_S_h50_S_cl0_bt0",
  test: "t=test_S_m19w_S_m16b_S_-t_S_-o_S_-e_S__N_a_S_60,55,72_S_mb_S__N_lotxt",
  tisch: "t=tisch_S_m19w8_S_m19g11_S_m19s25_S_-t_S_-o_S_-e_S__S__N_A_S_118_N_B_S_114.2_N_-tisch_N_t_S_ptlrb_S_wA_S_d80_S_h72_S_m1_S_ut-1r-1l_S_dt64,-2,1_S_ulr8f_S_n2,2_S_mb2_N_-kanal_N_k_S_pfbg_S_wtl3_tr0_S_d30_S_h22_S_ma2_S_cf1_tl2_S_y_P_40_S_sgx4,6_S_m2_S_nax2,2_N_ho_S_pflr_S_d64_S_h5_S_m3_S_cf1_tl2_S_nx2,6_S__S__S__N_-blende_N_b_S_pb_S_w120_S_d2_S_h108_S_cb0_tl4_S_z_P_8_S_n_N_-regalfach_N_r_S_plrgtc_S_w40_S_d18_S_htt2_bb2_S_cr6_bb2_S_n_S_sc3_S_zg_P_2_N_-ablag_N_a_S_pg_S_w120_S_d8_S_h2_S_cg1_bb5_S_m2_S_x_P_60_S_zz72_N_-oben_N_o_S_pg_S_d35_S_m2_S_cg0_rr2_S_x_P_-60_S_yg_P_-4",
}

const DEFAULT_CORPUS =
`test mat.19,snow,14,1 mat.16,cornflowerblue,16 
a teil.sl,sr,bo,de,rw,eb breit.60 tief.55 hoch.72 eb.mat.2 #regal_1`;

const DEFAULT_CORPUS_url =
`test=(0(test,m19w,m16b,-t,-o,-e),1(a,plrgtbc,(60,55,72),mb))`;



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

function decodeT(txt) {
  return decodeURI(
    txt
      .replace(/_S_/g, " ")
      .replace(/_N_/g, "\n")
      .replace(/_P_/g, "+")
  );
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
  makeFullUrlFromInn,
  makeInnFromFullUrl,
  encodeT,
  decodeT,
  onRenderClicked,
  loadURLfromDWG,
  makeStueckliste
  
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