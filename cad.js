import {
    makeFullUrlFromInn,
    makeInnFromFullUrl,
    encodeT,
    decodeT,
    parseCornerRef,
    parseCornerSpec
} from "./public/schreinertool/fu.js";
import { expandTextObjectLine } from "./text-object.js";
import { expandAliases } from "./public/schreinertool/alias.js";
const MMM = "zyxtrst"

const DEBUG = 1
var s = {}
var pp = "public/cad/"
var regcomma = /[,]/
const PARTS = "lrgtbfcvea"
const PMETER1 = "xyzwdhmon_"
const CHARS = "_.,@"
const EUKANTE = 0.8
const WASTE = 1.3
const FAKTORPRICE = 6
const DEFAULT_PART_LIMIT = (typeof window !== "undefined" && window.PROJECT_PART_LIMITS?.free) ? Number(window.PROJECT_PART_LIMITS.free) : 80;
const WDHXYZ = {
    "w": "x",
    "d": "y",
    "h": "z",
    x: "w",
    y: "d",
    z: "h"
}
const XYZ = "xyz"
const DWG_DIR = "/home/ch/3dfg/dwg";
const MODERN_PART_KEYS = {
    sl: "l",
    sr: "r",
    ls: "l",
    rs: "r",
    bo: "g",
    de: "t",
    rw: "b",
    fr: "f",
    eb: "c",
    mw: "v"
};

const MATERIAL_COLOR_NAMES = {
    w: "white",
    wh: "white",
    weiss: "white",
    weiß: "white",
    schneeweiss: "snow",
    schneeweiß: "snow",
    elfenbein: "ivory",
    creme: "silk",
    beige: "wheat",
    sand: "wheat",
    bt: "wheat",
    hellgrau: "lightgray",
    silbergrau: "silver",
    grau: "gray",
    gr: "gray",
    dunkelgrau: "dimgray",
    anthrazit: "anthracite",
    braun: "brown",
    schokobraun: "saddlebrown",
    umbra: "umber",
    nussbaum: "walnut",
    eiche: "burlywood",
    peru: "peru",
    ocker: "goldenrod",
    lichtocker: "khaki",
    senf: "darkgoldenrod",
    khaki: "khaki",
    blau: "cornflowerblue",
    bl: "cornflowerblue",
    dunkelblau: "darkblue",
    pastellblau: "lightsteelblue",
    gruen: "darkseagreen",
    grün: "darkseagreen",
    oliv: "olive",
    salbei: "sage",
    rot: "indianred",
    weinrot: "maroon",
    terracotta: "terracotta"
};

function materialColorKey(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    const compact = raw.replace(/[\s_-]+/g, "");
    return MATERIAL_COLOR_NAMES[compact] || compact || "white";
}





    

function keepLastCommands(lbs) {
    const map = new Map();

    for (let i = 0; i < lbs.length; i++) {
        const cmd = lbs[i];

        // prefix bestimmen (buchstaben am anfang)
        const key = cmd.match(/^[a-z]+/)?.[0] || cmd;

        // überschreibt automatisch ältere
        map.set(key, cmd);
    }

    return Array.from(map.values());
}



function parseDecimalComma(value) {
  const text = String(value ?? "").trim();
  return /^-?\d+,\d+$/.test(text) ? Number(text.replace(",", ".")) : null;
}

function parseValue(v) {
  if (v == null) return v;

  v = String(v).trim();
  v = stripValueAnnotation(v);

  // -------- DEZIMALKOMMA --------
  const decimal = parseDecimalComma(v);
  if (decimal !== null) {
    return decimal;
  }

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

function stripValueAnnotation(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(.*?)(\([^()]*\))\s*$/);
  if (!match) return text;

  const before = match[1].trimEnd();
  const prev = before.at(-1);
  if (!prev || /[+\-*/(=]/.test(prev)) return text;

  return before.trim();
}

function clonePlainValue(value) {
  return Array.isArray(value) ? value.map(clonePlainValue) : value;
}

function normalizePartKey(value) {
  const key = String(value ?? "").trim();
  return MODERN_PART_KEYS[key.toLowerCase()] || key;
}


function resolveNumericValue(current, raw) {

    if (raw == null) return current || 0;

    const str = String(raw).trim();
    const num = Number(str);

    if (isNaN(num)) return current || 0;

    if (str.startsWith("+")) {
        return (current || 0) + num;
    }

    return num; // absolut
}


function getURLFromDWG(dwgFile) {
    if (!dwgFile) return "";

    const file = path.join(DWG_DIR, dwgFile + ".txt");
    if (!fs.existsSync(file)) return "";

    return fs.readFileSync(file, "utf8").trim();
}
async function loadURLfromDWG(name) {
    if (!name) return "";

    const res = await fetch(`/dwg/${name}.txt`);
    if (!res.ok) return "";

    const url = (await res.text()).trim();
    if (!url) return "";

    return loadFromURL(url);
}

// number evaluation /
function cc(ii, fi = 2) {
    let r
    if (Array.isArray(ii) && ii.length > 1) {
        r = []
        for (let e of ii) {
            r.push(parseFloat(eval(e)))
        }
    } else {
        r = parseFloat(eval(ii))
    }
    return r
}
function err(er) {
    console.log("err", er)

}


function loadFromURL(url = "") {
    var params
    if (url == "") {

        params = new URLSearchParams(window.location.search);
    } else {
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
/////////////////////////////////////
export class Proj {
    constructor(inn, options = {}) {
        this.allpa = {}
        this.alljj = []
        const defaultLimit = options.partLimit !== undefined ? options.partLimit : DEFAULT_PART_LIMIT;
        this.partLimit = Number(defaultLimit || 0)
        this.partLimitPlan = options.partLimitPlan || "free"
        this.partLimitExceeded = null

        this.x
        this.y
        this.z
        this.xx = 0
        this.xy = 0
        this.xz = 0
        this.w = 15
        this.d = 30
        this.h = 15
        this.S = null
        this.ovs = {}

        // this.inn = this.allRowsToVar(inn)
        this.inn = this.normalizeInnPathSyntax(expandAliases(inn))

        this.pp = {}
        this.scr = ""
        this.bb = {}
        this.r = []
        this.trsp = false
        this.hide = false
        this.expl = 1
        this.rows = this.inn.trim().split("\n")
        for (let row_items of this.rows) {
            this.r.push(row_items.trim().replace(/ +/g, " ").split(" "))
        }
        this.nme = "test"
        this.line = ""
        this.inntest = []
        this.mnu = 1
        this.fn = ""
        this.sess = {
            eee: ""
        }
        this.cfactor = 9
        this.omat = {}
        this.ovar = {}
        this.projectVars = {}
        this.lpa = []
        this.lparts = []
        this.lbes = []  // list beschlag
        this.jj = []
        this.kosc = ""
        this.hol = "ko pa amou W D H kw kd kh\n"
        this.eur = 0
        this.m2 = {}
        this.qa = 8

        this.validateInnSyntax(this.inn)


        this.lastko = ""
        this.vs = {} // all obj key=first entry
        this.matlegend = ""
        this.oosc = {}
        this.stl = []
        this.out = ""
        this.lm = [0]  // list angrb test
        this.oks = {}
        this.mod = 0  // 1 klammer is open
        this.lins = []
        this.err = ""
        this.erro = ""

        this.createListMaKoPaVaFromInn()
        this.resolveDeferredDistanceExpressions()

        this.sumeur()
        this.getbb()
    }
    resolveNumericValue(current, raw) {

        if (raw === undefined || raw === null) {
            return current || 0;
        }

        const str = String(raw).trim();

        const num = Number(str);
        if (isNaN(num)) {
            return current || 0;
        }

        // Relativ: +9
        if (str.startsWith("+")) {
            return (current || 0) + num;
        }

        // Absolut
        return num;
    }
    getall() {
        this.getbb()
        this.assAllpa()
        //1eerr2("NNUULLLL" + Object.keys(this.pp))
        //alert(JSON.stringify(this))
        return this
    }

    sumeur() {
        for (var k1 in this.oks) {
            // var k = Object.assign({}, pr.oks[k1])
            var k = this.oks[k1]
            this.eur += Number(k.ep)
        }

        this.eur = this.eur.toFixed(2)
    }
    // VARI 55 search for VARI replace 55
    replVars(r) {

        // for (var e in this.vs) {
        //   let rea = new RegExp("[\$]" + e, "g")
        //   if (rea.test(r)) {
        //     r = r.replace(rea, this.vs[e])

        //   }

        // }
        for (var e in this.ovs) {
            let re = new RegExp("(?<![A-Z])" + e + "(?![A-Z])", "g")
            // let re = new RegExp("(?<!^)" + e, "g")
            r = r.replace(re, this.ovs[e])
            // console.log(re + ":" + this.ovs[e] + " hee")
        }
        return r
    }




    // computeLocalConnect(childName) {

    //     const k = this.oks[childName];
    //     if (!k || !k.tar || !k.tar[0]) return;

    //     const parent = this.oks[k.tar[0]];
    //     if (!parent) return;

    //     k.parent = k.tar[0];

    //     const curcor = Number(k.cur?.[2] ?? 0);
    //     const tarcor = Number(k.tar?.[2] ?? 0);

    //     const bbChild = this.computeLocalBB(k);
    //     const bbParent = this.computeLocalBB(parent);

    //     const C = this.localCorner(bbChild, curcor);
    //     const P = this.localCorner(bbParent, tarcor);

    //     // Child Rotation
    //     const a = (k.oz || 0) * Math.PI / 180;
    //     const cos = Math.cos(a);
    //     const sin = Math.sin(a);

    //     const Cx = C.x * cos - C.y * sin;
    //     const Cy = C.x * sin + C.y * cos;
    //     const Cz = C.z;

    //     k.x = P.x - Cx;
    //     k.y = P.y - Cy;
    //     k.z = P.z - Cz;
    // }          




    // computeLocalBB(k) {

    //   const g = new THREE.Group();
    //   g.add(createK(k, k.nme));
    //   g.updateMatrixWorld(true);

    //   return new THREE.Box3().setFromObject(g);
    // }

    localCorner(bb, idx) {

        const x = (idx & 1) ? bb.max.x : bb.min.x;
        const y = (idx & 2) ? bb.max.y : bb.min.y;
        const z = (idx & 4) ? bb.max.z : bb.min.z;

        return new THREE.Vector3(x, y, z);
    }



    expandNX() {
        const oks = this.oks;

        // 🔒 Snapshot der ursprünglichen Korpusse
        const names = Object.keys(oks);

        for (const name of names) {
            const k = oks[name];

            const n = k.nx || [1, 0];
            if (n[0] <= 1) continue;

            // ❌ Original entfernen
            delete oks[name];

            for (let i = 0; i < n[0]; i++) {
                const kk = structuredClone(k);

                kk.x = k.x + i * (k.w + n[1]);
                kk.nx = [1, 0];

                if (i > 0) kk.nme = k.nme + i + "x";

                oks[kk.nme] = kk;
            }
        }
    }

    getbb() {
        let bb = { x: 0, y: 0, z: 0 }
        var exp = this.expl
        var radius

        for (var k1 in this.oks) {
            // var k = Object.assign({}, pr.oks[k1])
            var k = this.oks[k1]
            // (this.eur)

            // for (let e1 in k.pats) {
            //         let p = k[e1]

            // bounding bo
            let mmax = cc(k.w + k.x + (k.nx[0]) * k.nx[1])
            // mmax=cc(k.xx+po.x+w)
            let mmay = cc(k.d + k.y + (k.ny[0]) * k.ny[1])
            let mmaz = cc(k.h + k.z + (k.nz[0]) * k.nz[1])
            // (dd(e)+mmax)
            if (mmax > bb.x) {
                radius = mmax
            }

            if (mmax > bb.x) {
                bb.x = mmax
            }
            if (mmay > bb.y) {
                bb.y = mmay
            }
            if (mmaz > bb.z) {
                bb.z = mmaz
            }
            bb.xz = (bb.x + bb.z) / 2

        }
        this.bb = bb
        return bb

    }

    assAllpa() {
        let ppp = { ...this.oks }
        var ew
        for (let k1 in ppp) {

            const entries = Array.isArray(ppp[k1])
                ? ppp[k1]
                : [ppp[k1]];

            for (const k of entries) {

                if (!k) continue;

                for (const pp of k.jj) {
                    if (this.partLimit && this.alljj.length >= this.partLimit) {
                        this.partLimitExceeded = {
                            count: this.alljj.length,
                            limit: this.partLimit,
                            plan: this.partLimitPlan,
                            message: `Teilelimit erreicht: Es werden nur die ersten ${this.partLimit} Teile gerendert. Bitte Wiederholungen oder Teilungen reduzieren.`
                        }
                        return { k: this.alljj, v: this.allpa, limit: this.partLimitExceeded }
                    }
                    let p = k[pp]
                    ew = this.nme + "_" + k.nme + pp
                    p.nme = ew
                    p.x += k.x
                    p.y += k.y
                    p.z += k.z
                    // alert(JSON.stringify(p))
                    this.allpa[ew] = p
                    this.alljj.push(ew)
                    // alert("k1 "+JSON.stringify(k))

                }
            }
        }

        return { k: this.alljj, v: this.allpa }
    }



    isIndented(line) {
        return /^[ \t]+/.test(line);
    }



    normalizeColorKey(co) {
        return materialColorKey(co);
    }



    replaceDimensions(str) {
        const projectValues = {
            W: this.w,
            D: this.d,
            H: this.h,
            S: this.S ?? this.lm?.[1]?.s ?? 0,
            Breit: this.w,
            Tiefe: this.d,
            Hoch: this.h,
            Staerke: this.S ?? this.lm?.[1]?.s ?? 0,
            Stärke: this.S ?? this.lm?.[1]?.s ?? 0,
            ...(this.projectVars || {})
        };

        return String(str)
            .replaceAll(":w", String(this.w))
            .replaceAll(":d", String(this.d))
            .replaceAll(":h", String(this.h))
            .replaceAll(":s", String(this.lm?.[1]?.s ?? 0))
            .replace(/\b[A-ZÄÖÜ][A-Za-z0-9_ÄÖÜäöüß]*\b/g, key => {
                const value = projectValues[key];
                return value == null ? key : String(value);
            });
    }

    isPathStyleToken(token, head) {
        if (!token || !head) return false;

        const lhs = String(token).split(/[=:]/)[0];
        return lhs === head || lhs.startsWith(head + ".");
    }

    stripOwnPathPrefix(token, head) {
        if (!token || !head) return token;

        const escapedHead = String(head).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return String(token).replace(new RegExp(`^${escapedHead}\\.`), "");
    }

    parseKorpusHead(token) {
        return this.parseKorpusHeadSpec(token).name;
    }

    parseKorpusHeadSpec(token) {
        const raw = String(token || "").trim();
        const m = raw.match(/^([a-z][a-z0-9_-]*)(?:\.([a-z][a-z0-9_-]*))?(?:[\)\]])?$/i);
        if (!m) return { name: "", parent: "" };

        const left = m[1].toLowerCase();
        const right = (m[2] || "").toLowerCase();

        if (right && this.oks?.[left]) {
            return {
                name: `${left}.${right}`,
                parent: left,
                child: true
            };
        }

        const overrideParent = this.childParentOverrides?.[`${left}.${right}`];
        if (right && overrideParent) {
            return {
                name: `${left}.${right}`,
                parent: overrideParent,
                child: true
            };
        }

        return {
            name: left,
            parent: right
        };
    }

    isKorpusName(value) {
        return /^[a-z][a-z0-9_-]*$/i.test(String(value || ""));
    }

    formatKorpusHeadSpec(spec) {
        return spec.parent ? `${spec.name}.${spec.parent}` : spec.name;
    }

    explicitParentName(token) {
        return this.parseKorpusHeadSpec(token).parent;
    }

    parseKorpusHead_old(token) {
        const m = String(token || "").trim().match(/^([a-z][a-z0-9_-]*)(?:[\)\]])?$/i);
        return m ? m[1].toLowerCase() : "";
    }

    implicitParentName(name) {
        const nme = String(name || "").trim().toLowerCase();
        if (!/^[a-z][a-z0-9_-]+$/i.test(nme)) return "";

        const parent = nme[0];
        return parent !== nme && this.oks[parent] ? parent : "";
    }

    splitOldDotToken(token) {
        const parts = String(token).split(".");
        if (parts.length < 2) return null;

        let value;
        if (
            parts.length >= 3 &&
            /^[-+]?\d+$/.test(parts[parts.length - 2]) &&
            /^\d+$/.test(parts[parts.length - 1])
        ) {
            value = parts.splice(parts.length - 2, 2).join(".");
        } else {
            value = parts.pop();
        }

        const path = parts.join(".");
        if (!path || value == null || value === "") return null;

        return { path, value };
    }

    normalizeLegacyConnectToken(token, head, prevHead) {
        const m = String(token).match(/^c([^_]+)_([^_]+)$/i);
        if (!m) return null;

        const parseRef = (s, selfSide = false) => {
            const ref = String(s).trim().match(/^([a-z])?([a-z])?(\d+)$/i);
            if (!ref) return selfSide ? `${head},,0` : `${prevHead || head},,3`;

            const kor = selfSide ? head : (ref[1] || prevHead || head);
            const part = selfSide ? (ref[1] || "") : (ref[2] || "");
            const corner = ref[3] || "0";

            return `${kor},${part},${corner}`;
        };

        return [
            `cur=${parseRef(m[1], true)}`,
            `tar=${parseRef(m[2], false)}`
        ];
    }

    normalizeUnderscoreConnectToken(token) {
        const raw = String(token || "").trim();
        const m = raw.match(/^([^_=:.]*)_([^_=:.]*)$/);
        if (!m || (!m[1] && !m[2])) return null;
        return `i=${raw}`;
    }

    normalizeInnTokenToPath(token, head, prevHead = "") {
        if (!token || !head) return token;

        if (String(token).startsWith("#")) return token;
        if (String(token).startsWith("-")) return token;

        if (this.isPathStyleToken(token, head)) {
            return this.stripOwnPathPrefix(token, head);
        }

        const connect = this.normalizeLegacyConnectToken(token, head, prevHead);
        if (connect) return connect;

        const underscoreConnect = this.normalizeUnderscoreConnectToken(token);
        if (underscoreConnect) return underscoreConnect;

        if (token === "c") {
            return [
                `cur=${head},,0`,
                `tar=${prevHead || head},,3`
            ];
        }

        const inputConnectMatch = String(token).match(/^i(?:[=:]|\.\.)(.+)$/i);
        if (inputConnectMatch) {
            const value = inputConnectMatch[1];
            return `i=${value}`;
        }

        const dotEqMatch = String(token).match(/^(.+?)\.\.(.+)$/);
        if (dotEqMatch) {
            const [, path, value] = dotEqMatch;
            return `${this.stripOwnPathPrefix(path, head)}=${value}`;
        }

        const eqMatch = String(token).match(/^([^=:]+)([=:])(.+)$/);
        if (eqMatch) {
            const [, path, op, value] = eqMatch;
            return `${this.stripOwnPathPrefix(path, head)}${op}${value}`;
        }

        const oldDot = this.splitOldDotToken(token);
        if (oldDot) {
            return `${this.stripOwnPathPrefix(oldDot.path, head)}=${oldDot.value}`;
        }

        const wdh = String(token).match(/^[-+]?\d+(\.\d+)?,[-+]?\d+(\.\d+)?,[-+]?\d+(\.\d+)?$/);
        if (wdh) {
            const [w, d, h] = String(token).split(",");
            return [`w=${w}`, `d=${d}`, `h=${h}`];
        }

        const partsToken = String(token).match(/^p(.+)$/i);
        if (partsToken) {
            return `p=${partsToken[1]}`;
        }

        const nRepeatToken = String(token).match(/^n([-+]?\d+)([xyz])$/i);
        if (nRepeatToken) {
            return `n${nRepeatToken[2].toLowerCase()}=${nRepeatToken[1]}`;
        }

        const compact = String(token).match(/^([a-z][a-z]*)([-+]?\d.*)$/i);
        if (compact) {
            return `${compact[1]}=${compact[2]}`;
        }

        return token;
    }

    normalizeInnLinePathSyntax(raw, prevHead = "") {
        const line = String(raw ?? "").trim().replace(/[ ]+/g, " ");
        if (!line || /^[-#]/.test(line)) return raw;
        if (/^txt:/i.test(line)) return raw;

        const allTokens = line.split(" ");
        const commentIndex = allTokens.findIndex(token => token.startsWith("#"));
        const tokens = commentIndex >= 0 ? allTokens.slice(0, commentIndex) : allTokens;
        const comments = commentIndex >= 0 ? allTokens.slice(commentIndex) : [];
        const headSpec = this.parseKorpusHeadSpec(tokens[0]);
        const head = headSpec.name;
        if (!head) return raw;

        const out = [this.formatKorpusHeadSpec(headSpec)];
        for (const token of tokens.slice(1)) {
            const normalized = this.normalizeInnTokenToPath(token, head, prevHead);
            if (Array.isArray(normalized)) {
                out.push(...normalized);
            } else {
                out.push(normalized);
            }
        }

        return [...out, ...comments].join(" ");
    }

    normalizeInnPathSyntax(inn) {
        let prevHead = "";

        return String(inn ?? "")
            .split(/\r?\n/)
            .map((line, idx) => {
                if (idx === 0) return line;

                const normalized = this.normalizeInnLinePathSyntax(line, prevHead);
                const head = this.parseKorpusHead(String(normalized).trim().split(/\s+/)[0]);
                if (head) prevHead = head;

                return normalized;
            })
            .join("\n");
    }

    syntaxError(message, line = 1, token = "") {
        const err = new SyntaxError(message);
        err.line = line;
        err.token = token;
        err.code = "C3_SYNTAX";
        err.status = 400;
        throw err;
    }

    validateInnSyntax(inn) {
        const lines = String(inn ?? "").split(/\r?\n/);
        const allowedPath = new Set([
            "p", "w", "d", "h", "x", "y", "z", "m", "s", "u",
            "dim",
            "nx", "ny", "nz", "sx", "sy", "sz",
            "i", "cur", "tar", "o", "ox", "oy", "oz",
            "layout", "cols", "fit", "vi", "leg", "roll", "rolle", "rollen", "wdh",
            "co", "n", "sc", "box", "l", "r", "g", "t", "b", "f", "c", "v"
        ]);
        const parts = new Set(["l", "r", "g", "t", "b", "f", "c", "v", "gg"]);
        const partProps = new Set([
            "w", "d", "h", "x", "y", "z", "m", "s", "u",
            "dim",
            "sx", "sy", "sz", "nx", "ny", "nz",
            "o", "ox", "oy", "oz", "vi", "co"
        ]);
        const valueLooksBroken = value => {
            const text = String(value ?? "").trim();
            if (!text) return true;
            if (/[{};`"'<>]/.test(text)) return true;
            if ((text.match(/\(/g) || []).length !== (text.match(/\)/g) || []).length) return true;
            return false;
        };
        const pathAllowed = path => {
            const keys = String(path || "").split(".").filter(Boolean);
            if (!keys.length) return false;
            const modernParts = {
                sl: "l",
                sr: "r",
                ls: "l",
                rs: "r",
                bo: "g",
                de: "t",
                rw: "b",
                fr: "f",
                eb: "c",
                mw: "v"
            };
            if (modernParts[keys[0]]) keys[0] = modernParts[keys[0]];
            if (allowedPath.has(keys[0])) return true;
            if (parts.has(keys[0]) && keys[1] && partProps.has(keys[1])) return true;
            return false;
        };

        for (let i = 1; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();
            if (!trimmed || /^[-#]/.test(trimmed) || /^txt:/i.test(trimmed)) continue;

            const tokens = trimmed.split(/\s+/);
            const head = this.parseKorpusHeadSpec(tokens[0]).name;
            if (!head) this.syntaxError("Korpusname fehlt oder ist ungültig.", i + 1, tokens[0] || "");

            for (const token of tokens.slice(1)) {
                if (!token || token.startsWith("#")) break;
                if (token.startsWith("-")) continue;
                if (/^\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(token)) continue;
                if (/\.$/.test(token)) {
                    this.syntaxError(`Unvollständiger Block "${token}". Nach dem Punkt fehlt Befehl oder Wert.`, i + 1, token);
                }

                const match = String(token).match(/^([^=:]+)(?:[=:])(.+)$/);
                if (!match) continue;

                const [, path, value] = match;
                if (!pathAllowed(path)) {
                    this.syntaxError(`Unbekannter Block "${token}".`, i + 1, token);
                }
                if (valueLooksBroken(value)) {
                    this.syntaxError(`Ungültiger Wert in "${token}".`, i + 1, token);
                }
            }
        }
    }

    defaultI(obj = null) {
        return [null, "0", this.lastko || null, null, "3"];
    }

    parseIValue(raw, obj = null) {
        if (Array.isArray(raw)) {
            const base = this.defaultI(obj);
            for (let idx = 0; idx < Math.min(raw.length, 5); idx++) {
                base[idx] = raw[idx] === "" ? null : raw[idx];
            }
            if (base[0]) base[0] = normalizePartKey(base[0]);
            if (base[3]) base[3] = normalizePartKey(base[3]);
            return base;
        }

        const text = String(raw ?? "").trim().replace(/^["'](.*)["']$/, "$1");
        const base = this.defaultI(obj);
        if (!text) return base;

        const directParts = text.split(",").map(part => part.trim());
        if (!text.includes("_") && directParts.length >= 5) {
            base[0] = directParts[0] ? normalizePartKey(directParts[0]) : null;
            base[1] = directParts[1] || "0";
            base[2] = directParts[2] || base[2] || null;
            base[3] = directParts[3] ? normalizePartKey(directParts[3]) : null;
            base[4] = directParts[4] || "3";
            return base;
        }

        const parseCorner = value => {
            const s = String(value ?? "").trim();
            return s === "" ? null : s;
        };

        const parseCur = value => {
            const s = String(value ?? "").trim();
            if (!s) return;
            if (/^\d+$/.test(s)) {
                base[0] = null;
                base[1] = s;
                return;
            }

            const parts = s.split(",").map(part => part.trim());
            base[0] = parts[0] ? normalizePartKey(parts[0]) : null;
            base[1] = parseCorner(parts[1] ?? "0") ?? "0";
        };

        const parseTar = value => {
            const s = String(value ?? "").trim();
            if (!s) return;
            if (/^\d+$/.test(s)) {
                base[4] = s;
                return;
            }

            const parts = s.split(",").map(part => part.trim());
            base[2] = parts[0] || base[2] || null;
            if (parts.length === 2) {
                base[3] = null;
                base[4] = parseCorner(parts[1]) ?? base[4];
                return;
            }
            base[3] = parts[1] ? normalizePartKey(parts[1]) : null;
            base[4] = parseCorner(parts[2] ?? base[4]) ?? "3";
        };

        const sep = text.indexOf("_");
        if (sep >= 0) {
            parseCur(text.slice(0, sep));
            parseTar(text.slice(sep + 1));
            return base;
        }

        parseTar(text);
        return base;
    }

    syncConnectionFromI(obj) {
        if (!obj || !Array.isArray(obj.i)) return;

        const [curPart, curCorner, tarKo, tarPart, tarCorner] = obj.i;
        obj.cur = [
            obj.nme || null,
            curPart ? normalizePartKey(curPart) : null,
            String(curCorner ?? "0")
        ];

        obj.tar = tarKo ? [
            tarKo,
            tarPart ? normalizePartKey(tarPart) : null,
            String(tarCorner ?? "3")
        ] : [];
    }

    syncIFromConnection(obj, key) {
        if (!obj || !Array.isArray(obj.i)) obj.i = this.defaultI(obj);

        if (key === "cur" && Array.isArray(obj.cur)) {
            obj.i[0] = obj.cur[1] ? normalizePartKey(obj.cur[1]) : null;
            obj.i[1] = String(obj.cur[2] ?? "0");
        }

        if (key === "tar" && Array.isArray(obj.tar)) {
            obj.i[2] = obj.tar[0] ?? null;
            obj.i[3] = obj.tar[1] ? normalizePartKey(obj.tar[1]) : null;
            obj.i[4] = String(obj.tar[2] ?? "3");
        }
    }

    projectScalar(raw, fallback = 0) {
        const expr = this.replaceDimensions(String(raw ?? "").trim()).replace(/^[(](.*)[)]$/, "$1");
        if (/^[0-9+\-*/().\s]+$/.test(expr)) {
            try {
                const value = Function('"use strict"; return (' + expr + ')')();
                if (Number.isFinite(value)) return this.roundExprNumber(value);
            } catch {}
        }

        const value = Number(expr);
        return Number.isFinite(value) ? value : fallback;
    }

    createListMaKoPaVaFromInn() {

        let ko;

        const linn = this.inn.replace(/[ ]+/g, " ").split("\n");

        this.parseProjectLine(linn[0]);

        const bodyLines = [];
        for (const raw of linn.slice(1)) {
            const expanded = expandTextObjectLine(this, raw);
            if (expanded) bodyLines.push(...expanded);
            else bodyLines.push(raw);
        }

        for (const raw of bodyLines) {

            const m = raw.trim();
            if (!m || /^[-#]/.test(m)) continue;

            // Klammern ignorieren (falls vorhanden)
            if (m === "(" || m === ")") continue;

            ko = this.new__Korp(m);

            this.jj.push(ko.nme);

            // nur für fuuc() relevant
            this.lastko = ko.nme;
        }

        this.jj = Object.keys(this.oks);
    }










    allRowsToVar(inn) {
        const lines = inn.trim().split("\n");

        for (const line of lines) {
            if (/^[a-zA-Z] /.test(line)) {
                const [key, ...rest] = line.split(" ");
                this.ovs[key.toUpperCase()] = rest.join(" ");
            }
        }

        let result = inn;
        for (const [key, value] of Object.entries(this.ovs)) {
            const re = new RegExp(`(?<!^|\\n)${key}(?!\\.)`, "g");
            result = result.replace(re, value);
        }
        return result;
    }



    // calcm2mat moved to mod2
    splitAlphaNumericBlocks(word) {
        return word.match(/[a-zA-Z]+|\d+/g) || [];
    }

    // Beispiel
    // const input = "mm55br";
    // const result = splitAlphaNumericBlocks(input);
    // console.log(result);  // ["mm", "55", "br"]
    // Classic, step-by-step, easy to follow.
    // Input: text with lines like:
    //   m19p
    //   m12re22
    //   m8bl5.5,0.35
    // Rule:
    //   - first letter = nme (stored, but otherwise "falls weg")
    //   - 1st number block => s (divide by 10)
    //   - 1st word block   => co
    //   - 2nd number block => p
    //   - 3rd number block => pu
    // Output: dictionary { key: matObj }

    parseMat(text) {

        const dict = {};
        const lines = String(text).split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {

            let line = lines[i].trim();
            if (!line) continue;

            // alles nach '=' ignorieren
            const eqPos = line.indexOf("=");
            if (eqPos >= 0) line = line.slice(0, eqPos).trim();

            // Spaces entfernen
            line = line.replace(/\s+/g, "");
            if (!line) continue;

            const key = line;

            // 1) Name
            const nme = line[0].toLowerCase();
            let rest = line.slice(1);

            // 2) Stärke
            let m = rest.match(/^(\d+(?:\.\d+)?)/);
            if (!m) continue;

            const thickStr = m[1];
            const s = Number(thickStr) / 10;
            rest = rest.slice(thickStr.length);

            // 3) Farbe: kompakte Schreibweise nutzt Web-Farbnamen bis zum Preis, z.B. m19wheat14,1
            m = rest.match(/^([a-zäöüß_-]+)/i);
            let co = m ? materialColorKey(m[1]) : "white";
            if (m) rest = rest.slice(m[1].length);

            // 4) Preise
            let p = 0;
            let pu = 0;

            if (rest.length > 0) {
                const parts = rest.split(",");

                if (parts[0]) {
                    const n = Number(parts[0]);
                    p = Number.isNaN(n) ? null : n;
                }

                if (parts.length > 1 && parts[1]) {
                    const n = Number(parts[1]);
                    pu = Number.isNaN(n) ? null : n;
                }
            }

            // 5) Materialobjekt
            dict[key] = {
                nme,
                s,
                co,
                l: "m",
                p,
                pu
            };
        }

        return dict;
    }

    parseProjectLine(line) {

    if (!line) return;
    line = line.trim();

    // -------------------------
    // 🔥 Projektname = erstes Token
    // -------------------------
    const parts = line.split(/\s+/);
    const projectDefaults = [];

    if (parts.length > 0) {
        this.nme = parts[0];
    }

    // -------------------------
    // Projektmaße (erste 3 Zahlen mit Komma)
    // z.B. 360,67,214
    // -------------------------
    const dimMatch = line.match(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/);

    if (dimMatch) {
        this.w = Number(dimMatch[1]);
        this.d = Number(dimMatch[2]);
        this.h = Number(dimMatch[3]);
    }

    const projectDimensionKeys = {
        W: "w",
        D: "d",
        H: "h",
        S: "s",
        Breit: "w",
        Tiefe: "d",
        Hoch: "h",
        Staerke: "s",
        Stärke: "s"
    };

    const evalProjectValue = raw => {
        const expr = this.replaceDimensions(String(raw ?? "").trim()).replace(/^[(](.*)[)]$/, "$1");
        const exprValue = this.evalMathExpression(expr);
        if (Number.isFinite(exprValue)) return exprValue;
        const value = Number(expr);
        return Number.isFinite(value) ? value : null;
    };

    const projectValueRe = /\b([A-ZÄÖÜ][A-Za-z0-9_ÄÖÜäöüß]*|[WDHSwdhs])\s*[=:]\s*([^\s]+)/g;
    let projectValueMatch;
    while ((projectValueMatch = projectValueRe.exec(line)) !== null) {
        const rawKey = projectValueMatch[1];
        const key = /^[wdhs]$/.test(rawKey) ? rawKey.toUpperCase() : rawKey;
        const value = evalProjectValue(projectValueMatch[2]);
        if (!Number.isFinite(value)) continue;

        this.projectVars[key] = value;

        const dim = projectDimensionKeys[key] || "";
        if (dim === "w") this.w = value;
        if (dim === "d") this.d = value;
        if (dim === "h") this.h = value;
        if (dim === "s") this.S = value;
    }

    // -------------------------
    // Projekt-Explosionsabstand
    // xx = links/rechts, xy = front/rueckwand, xz = boden/deckel
    // Beispiele: xx5 xy=8 xz:12
    // -------------------------
    const explosionDefaults = {};
    const gapRe = /\b(x[xyz])(?:\s*[=:])?\s*(-?\d+(?:\.\d+)?)/gi;
    let gap;

	    while ((gap = gapRe.exec(line)) !== null) {
	        const key = gap[1].toLowerCase();
	        const value = Number(gap[2]);
        if (Number.isFinite(value)) {
            this[key] = value;
            explosionDefaults[key] = value;
        }
    }

	    this.ovar = {
	        ...this.ovar,
	        ...explosionDefaults
	    };

	    const dimTokenRe = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;
	    const materialTokenRe = /^(?:[mM][\d.]+[a-zäöüß_-]+[\d.,]*|[mM],[^ ]+|(?:m|mat)\.[^ ]+)$/i;
	    const explosionTokenRe = /^x[xyz](?:\s*[=:])?\s*-?\d+(?:\.\d+)?$/i;
	    const projectValueTokenRe = /^(?:[A-ZÄÖÜ][A-Za-z0-9_ÄÖÜäöüß]*|[WDHSwdhs])\s*[=:]\s*[^\s]+$/;

	    for (const token of parts.slice(1)) {
	        if (
	            dimTokenRe.test(token) ||
	            materialTokenRe.test(token) ||
	            explosionTokenRe.test(token) ||
	            projectValueTokenRe.test(token)
	        ) {
	            continue;
	        }

	        projectDefaults.push(token);
	    }

	    this.projectDefaults = projectDefaults;

    // -------------------------
    // Materialien: mat.<stärke>,<farbe>,<preis>,<kantenpreis>
    // -------------------------
    let m;
    const commaMaterialRe = /\b(?:m|mat)[.,]\s*([\d.]+)\s*,\s*([a-zäöüß_-][a-z0-9äöüß_-]*)(?:\s*,\s*([\d.]+))?(?:\s*,\s*([\d.]+))?/gi;
    while ((m = commaMaterialRe.exec(line)) !== null) {
        const s = Number(m[1]) / 10;
        const co = materialColorKey(m[2]);

        this.lm.push({
            nme: m[0],
            s: s,
            co: co,
            l: "m",
            p: Number(m[3] || 0),
            pu: Number(m[4] || 0)
        });
    }

    const re = /[mM]([\d.]+)([a-zäöüß_-]+)([\d.,]*)/gi;

    while ((m = re.exec(line)) !== null) {

        const s = Number(m[1]) / 10;
        const co = materialColorKey(m[2]);

        let p = 0, pu = 0;
        if (m[3]) {
            const priceText = m[3];
            const nums = priceText.split(",");
            p = Number(nums[0] || 10);
            pu = Number(nums[1] || 0);
        }

        this.lm.push({
            nme: m[0],
            s: s,
            co: co,
            l: "m",
            p: p,
            pu: pu
        });
    }
}

    newMat(m) {
        var pri = 1
        var mat
        mat = this.parseMat(m)
        // // (m)
        // // let p = m.split(/(?<=[0-9])(?=[a-z])/)  // 
        // if (/[,]/.test(m)) {

        //     let p = m.split(",")
        //     mat = {
        //         nme: m,
        //         s: Number(p[1]),
        //         co: p[2],
        //         p: 1  // price
        //     }
        //     // (p)
        // } else {
        //     let p = this.splitAlphaNumericBlocks(m)
        //     if (p.length > 3) {
        //         pri = Number(p[3])
        //     }
        //     // (dd(p))
        //     mat = {
        //         nme: m,
        //         s: Number(p[1]) / 10,
        //         co: p[2],
        //         p: pri  // price
        //     }
        // }
        this.lm.push(mat)
        this.mnu++
    }


    mv(r) {
        let a = r.split("mv")[1].trim().split(" ")
        return "translate([" + a[0] + "," + a[1] + "," + a[2] + "])"
    }

    replaceRefs(str, proj) {
        return str.replace(/[A-Z]\.[a-z]/g, m => {
            const root = m[0].toLowerCase() // NUR der erste Buchstabe
            const key = m[2]               // bleibt wie er ist (klein)
            const val = proj?.oks?.[root]?.[key]
            return val != null ? String(val) : m
        })
    }

    firstTwoLetters(str) {
        return (str.match(/[a-z]/gi) || []).slice(0, 2).join('');
    }

    // firstTwoLetters("a1b2c3"); // "ab"
    // firstTwoLetters("12AB34"); // "AB"
    // firstTwoLetters("9x");     // "x"

keepLastCommandsStable(lbs) {
    const multi = new Set(["u", "c"]);
    const singles = new Map();
    const out = [];
    const commandKey = cmd => {
        const lhs = String(cmd).split(/[=:]/)[0];
        return lhs.includes(".") ? lhs : String(cmd)[0];
    };
    const removeCommandKey = key => {
        singles.delete(key);
        for (let i = out.length - 1; i >= 0; i--) {
            if (commandKey(out[i]) === key) out.splice(i, 1);
        }
    };

    for (const cmd of lbs) {
        if (!cmd || typeof cmd !== "string") continue;

        if (cmd === "-u") {
            removeCommandKey("u");
            continue;
        }

        const key = commandKey(cmd);

        if (multi.has(key)) {
            out.push(cmd);
        } else {
            singles.set(key, cmd);
        }
    }

    return [...singles.values(), ...out];
}

isRepeatCommandToken(cmd) {
    const text = String(cmd || "").trim();
    const lhs = text.split(/[=:]/)[0].toLowerCase();
    return lhs === "n" || /^n[xyz]$/.test(lhs);
}

isPositionCommandToken(cmd) {
    const text = String(cmd || "").trim();
    const lhs = text.split(/[=:]/)[0].toLowerCase();
    return /^[xyz]$/.test(lhs);
}

parentLbsForChild(parentLbs, ko) {
    const isIntegratedChild = String(ko?.nme || "").includes(".");
    const inherited = Array.isArray(parentLbs) ? parentLbs.slice(1) : [];
    if (!isIntegratedChild) return inherited;
    return inherited.filter(cmd =>
        !this.isRepeatCommandToken(cmd) &&
        !this.isPositionCommandToken(cmd)
    );
}


cloneChildKorpusse(parentName, newRootName) {
    const childPrefix = `${parentName}.`;
    const newPrefix = `${newRootName}.`;
    const knownOrder = Array.from(new Set([
        ...(Array.isArray(this.jj) ? this.jj : []),
        ...Object.keys(this.oks || {})
    ]));
    const children = knownOrder
        .filter(name => String(name || "").startsWith(childPrefix))
        .filter(name => {
            const child = this.oks[name];
            if (!child?.lbs?.length) return false;
            return String(child.lbs[0] || "") === String(name);
        });

    if (!children.length) return;

    const remapName = name => {
        if (!name) return name;
        const text = String(name);
        if (text === parentName) return newRootName;
        if (text.startsWith(childPrefix)) return newPrefix + text.slice(childPrefix.length);
        return name;
    };

    const remapConnectionList = value => {
        const parts = String(value ?? "").split(",");
        if (parts[0]) parts[0] = remapName(parts[0]);
        return parts.join(",");
    };

    const remapToken = token => {
        const text = String(token ?? "");
        const m = text.match(/^([^=:]+)([=:])(.*)$/);
        if (!m) return text;

        const [, path, op, raw] = m;
        if (path === "cur" || path === "tar") {
            return `${path}${op}${remapConnectionList(raw)}`;
        }
        if (path === "i") {
            if (String(raw).includes("_")) {
                const parts = String(raw).split("_");
                if (parts[1]) parts[1] = remapConnectionList(parts[1]);
                return `${path}${op}${parts.join("_")}`;
            }
            const parts = String(raw).split(",");
            if (parts.length >= 5) {
                if (parts[2]) parts[2] = remapName(parts[2]);
            } else if (parts.length >= 2) {
                if (parts[0]) parts[0] = remapName(parts[0]);
            } else if (parts[0] && !/^\d+$/.test(parts[0])) {
                parts[0] = remapName(parts[0]);
            }
            return `${path}${op}${parts.join(",")}`;
        }

        return text;
    };

    const previousLastKo = this.lastko;
    const previousDisableImplicitParent = this.disableImplicitParent;
    this.disableImplicitParent = true;
    this.lastko = newRootName;

    try {
        for (const childName of children) {
            const newName = remapName(childName);
            if (this.oks[newName]) continue;

            const orig = this.oks[childName];
            const line = [
                newName,
                ...orig.lbs.slice(1).map(remapToken)
            ].join(" ");

            this.childParentOverrides ||= {};
            this.childParentOverrides[newName] = newRootName;

            const copy = this.new__Korp(line);
            delete this.childParentOverrides[newName];

            if (this.jj && copy?.nme && !this.jj.includes(copy.nme)) {
                this.jj.push(copy.nme);
            }
        }
    } finally {
        this.disableImplicitParent = previousDisableImplicitParent;
        this.lastko = previousLastKo;
    }
}

cloneChildToExistingParentClones(parentName, childName) {
    if (!parentName || !childName) return;

    const suffix = String(childName).slice(String(parentName).length + 1);
    if (!suffix) return;

    const names = Array.from(new Set([
        ...(Array.isArray(this.jj) ? this.jj : []),
        ...Object.keys(this.oks || {})
    ]));
    const isRelatedClone = ko => {
        if (!ko?.nme || ko.nme === parentName || String(ko.nme).includes(".")) return false;
        if (ko.parent === parentName) return true;
        if (ko.tar?.[0] === parentName) return true;
        return false;
    };

    for (const name of names) {
        const ko = this.oks[name];
        if (!isRelatedClone(ko)) continue;
        const newChildName = `${ko.nme}.${suffix}`;
        if (this.oks[newChildName]) continue;
        this.cloneChildKorpusse(parentName, ko.nme);
    }
}

applyParentLBS(ko) {
    if (!ko.lbs || !ko.lbs.length) return ko;

    const parent = ko.parent || this.implicitParentName(ko.nme);

    if (parent && this.oks[parent]) {
        ko.lbs = [
            ko.nme,
            ...this.parentLbsForChild(this.oks[parent].lbs, ko),
            ...ko.lbs.slice(1)
        ];

        const rest = this.keepLastCommandsStable(ko.lbs.slice(1));
        ko.lbs = [ko.nme, ...rest];
    }

    return ko;
}

inheritParentLBS(ko, parent = ko?.parent) {
    if (!ko?.lbs?.length || !parent || !this.oks[parent]?.lbs?.length) return ko;

    ko.lbs = [
        ko.nme,
        ...this.parentLbsForChild(this.oks[parent].lbs, ko),
        ...ko.lbs.slice(1)
    ];

    const rest = this.keepLastCommandsStable(ko.lbs.slice(1));
    ko.lbs = [ko.nme, ...rest];

    return ko;
}

evalExpr(expr, root) {
  expr = expr.replace(/[a-zA-Z0-9_.]+/g, (key) => {
    return getByPath(root, key) ?? 0;
  });

  try {
    return Function("return " + expr)();
  } catch {
    return 0;
  }
}

getByPath(obj, path) {
  return String(path ?? "").split(".").reduce((o, k) => {
    if (o == null) return undefined;
    if (Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    if (/^[A-Z]$/.test(k) && Object.prototype.hasOwnProperty.call(o, k.toLowerCase())) {
      return o[k.toLowerCase()];
    }
    if (/^[a-z]$/.test(k) && Object.prototype.hasOwnProperty.call(o, k.toUpperCase())) {
      return o[k.toUpperCase()];
    }
    return undefined;
  }, obj);
}

roundExprNumber(value) {
  return Math.round(value * 100) / 100;
}

evalMathExpression(expr) {
  const fns = {
    round: Math.round,
    r: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    abs: Math.abs
  };

  try {
    const result = Function(
      ...Object.keys(fns),
      '"use strict"; return (' + expr + ')'
    )(...Object.values(fns));

    return Number.isFinite(result) ? this.roundExprNumber(result) : null;
  } catch {
    return null;
  }
}

evalInputExpression(obj, expr) {
  expr = this.replaceDimensions(expr);
  const mathFns = new Set(["round", "r", "floor", "ceil", "abs"]);
  const resolvedExpr = String(expr).replace(/[a-zA-Z][a-zA-Z0-9_.]*/g, key => {
    if (mathFns.has(key)) return key;

    const localValue = this.getByPath(obj, key);
    if (localValue != null && typeof localValue !== "object") return localValue;

    const projectValue = this.getByPath(this.oks, key);
    if (projectValue != null && typeof projectValue !== "object") return projectValue;

    return key;
  });

  return this.evalMathExpression(resolvedExpr);
}

resolveInputValue(obj, raw) {
  if (raw == null) return raw;

  if (typeof raw === "number") return raw;

  const s = this.replaceDimensions(String(raw).trim());

  if (!s) return s;
  if (s.includes(",")) return raw;

  if (s.includes("(")) {
    try {
      const wholeExprValue = this.evalInputExpression(obj, s);
      if (Number.isFinite(wholeExprValue)) return wholeExprValue;

      const replaced = s.replace(/\(([^()]+)\)/g, (match, expr) => {
        const value = this.evalInputExpression(obj, expr);
        return value == null ? match : String(value);
      });

      if (replaced !== s) {
        const n = Number(replaced);
        if (Number.isFinite(n)) return n;

        const result = this.evalMathExpression(replaced);
        if (Number.isFinite(result)) return result;

        return replaced;
      }
    } catch {
      return raw;
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(s) && isNaN(s)) {
    const localValue = this.getByPath(obj, s);
    if (localValue != null && typeof localValue !== "object") return localValue;

    const projectValue = this.getByPath(this.oks, s);
    if (projectValue != null && typeof projectValue !== "object") return projectValue;
  }

  if (!isNaN(s)) return Number(s);

  return raw;
}


 getTokenValue(obj, str) {

  if (str == null) return str;

  if (typeof str === "number") return str;

 const s = String(str).trim();
  if (s.includes(",")) return str;

  // Ausdruck (a.w*2)
  if (s.startsWith("(") && s.endsWith(")")) {
    return Function("o", "with(o) return " + s.slice(1, -1))(obj);
  }

  // Pfad (a.w)
  if (s.includes(".")) {
    return s.split(".").reduce((o, k) => o?.[k], obj);
  }

  // Zahl
  if (!isNaN(s)) return Number(s);

  return s;
}


applyToken(obj, token){

  const t = this.expandToken(token, obj);

  if (Array.isArray(t)){
    for (const tt of t){
      this.setTokenValue(obj, tt);
    }
  } else {
    this.setTokenValue(obj, t);
  }
}

expandToken(token, obj = null){

  if (!token) return token;

  // ---------------------------------
  // CONNECT SHORT: c.t0_bt1 -> cur=,t,0 tar=b,t,1
  // ---------------------------------
  const mCPath = token.match(/^c\.([^_]+)_([^_]+)$/i);
  if (mCPath){
    const parseRef = (s, selfSide = false) => {
      const m = String(s).trim().match(/^([a-z])?([a-z])?(\d+)$/i);
      if (!m) return selfSide ? ",,0" : `${this.lastko},,3`;

      const kor = selfSide ? (obj?.nme || "") : (m[1] || this.lastko || "");
      const part = selfSide ? (m[1] || "") : (m[2] || "");
      const corner = m[3] || "0";

      return `${kor},${part},${corner}`;
    };

    return [
      `cur=${parseRef(mCPath[1], true)}`,
      `tar=${parseRef(mCPath[2], false)}`
    ];
  }

  // ---------------------------------
  // CONNECT SHORT: c0_a3 / ct2_ag3
  // ---------------------------------
  const mCOld = token.match(/^c([^_]+)_([^_]+)$/i);
  if (mCOld){
    const parseRef = (s, selfSide = false) => {
      const m = String(s).trim().match(/^([a-z])?([a-z])?(\d+)$/i);
      if (!m) return selfSide ? `${obj?.nme || ""},,0` : `${this.lastko},,3`;

      const kor = selfSide ? (obj?.nme || "") : (m[1] || this.lastko || "");
      const part = selfSide ? (m[1] || "") : (m[2] || "");
      const corner = m[3] || "0";

      return `${kor},${part},${corner}`;
    };

    return [
      `cur=${parseRef(mCOld[1], true)}`,
      `tar=${parseRef(mCOld[2], false)}`
    ];
  }

  // ---------------------------------
  // 🔥 CONNECT SHORT: c a
  // ---------------------------------
  if (token === "c"){
    return [
      `cur=${obj?.nme || ""},,0`,
      `tar=${this.lastko},,3`
    ];
  }

  const mC = token.match(/^c([a-z]\w*)$/i);
  if (mC){
    const k = mC[1];
    return [
      `cur=${obj?.nme || ""},,0`,
      `tar=${this.lastko},3`
    ];
  }

  // ---------------------------------
  // WDH SHORT
  // ---------------------------------
  const wdh = token.match(/^[-+]?\d+(\.\d+)?,[-+]?\d+(\.\d+)?,[-+]?\d+(\.\d+)?$/);
  if (wdh){
    const [w,d,h] = token.split(",");
    return [`w=${w}`, `d=${d}`, `h=${h}`];
  }

  // ---------------------------------
  // MULTI PART PATH: l,r.sy=2,d-10 -> l.sy=... + r.sy=...
  // ---------------------------------
  const multiPartPath = token.match(/^([a-z](?:,[a-z])+)(\.[^=:]+[=:].*)$/i);
  if (multiPartPath) {
    return multiPartPath[1]
      .split(",")
      .map(part => `${part}${multiPartPath[2]}`);
  }

  // ---------------------------------
  // normale Tokens
  // ---------------------------------
  if (token.includes("=") || token.includes(":") || token.includes(".")) return token;

  const m = token.match(/^([a-z])([a-z]+)([-+]?\d+(\.\d+)?)$/i);
  if (m) return `${m[1]}.${m[2]}=${m[3]}`;

  const mRel = token.match(/^([wdhxyz])\+(-?\d+(\.\d+)?)$/i);
  if (mRel) return `${mRel[1]}=+${mRel[2]}`;

  const m2 = token.match(/^([wdhxyz])([-+]?\d+(\.\d+)?)$/i);
  if (m2) return `${m2[1]}=${m2[2]}`;

  const m3 = token.match(/^([n][xyz])([-+]?\d+)$/i);
	  if (m3) return `${m3[1]}=${m3[2]}`;

  const m3Alt = token.match(/^n([-+]?\d+)([xyz])$/i);
	  if (m3Alt) return `n${m3Alt[2]}=${m3Alt[1]}`;

	  const mView = token.match(/^vi(.+)$/i);
	  if (mView) return `vi=${mView[1]}`;
	
	  return token;
	}


setTokenValue(obj, token){

    token = this.expandToken(token, obj);

    if (!token) return;
    if (Array.isArray(token)) {
        for (const t of token) this.setTokenValue(obj, t);
        return;
    }

    let path, value;
    const tokenText = String(token).trim();

    // ==================================================
    // PARSE
    // ==================================================

    if (tokenText.toLowerCase() === "i") {
        path = "i";
        value = "3";
    } else

    if (token.includes("=")) {

        [path, value] = token.split("=");

    } else if (token.includes(":")) {

        [path, value] = token.split(":");

    } else {

        const p = token.split(".");

        if (
            p.length >= 3 &&
            /^[-+]?\d+$/.test(p[p.length - 2]) &&
            /^\d+$/.test(p[p.length - 1])
        ){
            value = p.splice(p.length - 2, 2).join(".");
        } else {
            value = p.pop();
        }

        path = p.join(".");
    }

    let keys = path.trim().split(".");
    const rawValue = String(value ?? "").trim();
    let resolvedValue = this.resolveInputValue(obj, value);
    let v = String(resolvedValue ?? "").trim();

    if (keys.length > 1 && keys[0] === obj?.nme){
        keys = keys.slice(1);
    }

    const modernPartKeys = {
        sl: "l",
        sr: "r",
        ls: "l",
        rs: "r",
        bo: "g",
        de: "t",
        rw: "b",
        fr: "f",
        eb: "c",
        mw: "v"
    };
    const modernPropertyKeys = {
        mat: "m",
        breit: "w",
        lang: "w",
        breite: "w",
        tief: "d",
        tiefe: "d",
        hoch: "h",
        hoehe: "h",
        stk: "s",
        push: "u"
    };

    if (modernPartKeys[keys[0]]) keys[0] = modernPartKeys[keys[0]];
    const lastKey = keys[keys.length - 1];
    if (modernPropertyKeys[lastKey]) keys[keys.length - 1] = modernPropertyKeys[lastKey];

    if (
        keys.length === 1 &&
        ["l", "r", "g", "t", "b", "f", "c", "v", "gg"].includes(keys[0]) &&
        String(rawValue).trim().toLowerCase() === "dim"
    ) {
        keys = [keys[0], "dim"];
        resolvedValue = 1;
        v = "1";
    }

    if (keys[0] === "m" && keys.length === 2 && /^[a-z]$/i.test(keys[1])){
        keys = [keys[1], "m"];
    }

    const applyUPushSpec = (target, spec, partName = "") => {
        const text = this.replaceDimensions(String(spec ?? "").trim());
        let handled = false;

        const legMatch = text.match(/^(-?\d+(?:\.\d+)?)leg([24])$/i);
        if (!partName && legMatch) {
            this.handleLegs(target, Math.abs(Number(legMatch[1])), Number(legMatch[2]));
            return true;
        }

        const setSide = (side, amount) => {
            if (!Number.isFinite(amount)) return;
            target["u" + side] = -amount;
            handled = true;
        };

        for (const match of text.matchAll(/(-?\([^()]+\)|-?\d+(?:\.\d+)?)([uglrfbts]+)/gi)) {
            const rawAmount = match[1];
            const amount = rawAmount.includes("(")
                ? this.resolveInputValue(obj, rawAmount.replace(/^-/, "")) * (rawAmount.startsWith("-") ? -1 : 1)
                : Number(rawAmount);
            const sides = match[2].toLowerCase();

            if (!partName && (sides.includes("g") || sides.includes("u")) && sides.includes("s")) {
                this.handleSockel(target, Number(amount));
                if (Array.isArray(target.jj) && !target.jj.includes("gg")) {
                    target.jj.push("gg");
                }
                target.gg = {
                    ...(target.gg || {}),
                    nme: "gg"
                };
                handled = true;
                continue;
            }

            for (const side of sides) {
                if (side === "s") continue;
                setSide(side === "u" ? "g" : side, Number(amount));
            }
        }

        if (handled) return true;

        if (/^-?\d+(?:\.\d+)?$/.test(text)) {
            const amount = Number(text);
            const basePart = String(partName || target.nme || "").charAt(0);
            const sidesByThicknessAxis = {
                w: ["f", "b", "g", "t"],
                d: ["l", "r", "g", "t"],
                h: ["l", "r", "f", "b"]
            };
            const axisByPart = {
                l: "w", r: "w", v: "w",
                f: "d", b: "d", a: "d",
                g: "h", t: "h", c: "h"
            };
            const sides = sidesByThicknessAxis[axisByPart[basePart]] || ["l", "r", "f", "b", "g", "t"];

            for (const side of sides) {
                setSide(side, amount);
            }
        }

        return handled;
    };

    // u.<part>=... shortcut:
    // u.l=8g -> l.ug=8
    if (keys[0] === "u" && keys.length === 2) {
        const part = keys[1];
        const target = obj[part] || (obj[part] = {});
        if (applyUPushSpec(target, v, part)) return;
    }

    const relativeTokenKey = `${keys.join(".")}=${rawValue}`;
    const markRelativeApplied = () => {
        if (!obj.__relativeApplied) {
            Object.defineProperty(obj, "__relativeApplied", {
                value: new Set(),
                enumerable: false
            });
        }
        if (obj.__relativeApplied.has(relativeTokenKey)) return false;
        obj.__relativeApplied.add(relativeTokenKey);
        return true;
    };

    // ==================================================
    // SPEZIALFALL:
    // p.index = value
    // ==================================================

    if (keys[0] === "p" && keys.length === 2){

        const idx = Number(keys[1]);

        if (!isNaN(idx)){

            const arr = String(obj.p || "").split("");

            arr.splice(idx, 0, v);

            obj.p = arr.join("");
            obj.j = obj.p;

            return;
        }
    }

    // ==================================================
    // ZIEL OBJEKT
    // ==================================================

    let o = obj;

    for (let i = 0; i < keys.length - 1; i++){

        o = o[keys[i]] || (o[keys[i]] = {});
    }

	    let key = keys[keys.length - 1];
	    if (/^(?:[nso][xyz]|[nso][xyz]c)$/i.test(key)) {
	        key = key.toLowerCase();
	        keys[keys.length - 1] = key;
	    }
	    const oldVal = o[key];

	    const distanceAxisByKey = {
	        w: "x", x: "x",
	        d: "y", y: "y",
	        h: "z", z: "z"
	    };
    const distanceAxis = o === obj ? distanceAxisByKey[key] : null;
    const distanceValue = distanceAxis
        ? this.resolvePointDistanceExpression(obj, rawValue, distanceAxis)
        : null;
    if (Number.isFinite(distanceValue)) {
        resolvedValue = distanceValue;
        v = String(distanceValue);
    }

    if (
        o === obj &&
        /^[wdhxyz]$/.test(key) &&
        /^\+[+-]?\d+(?:\.\d+)?$/.test(rawValue)
    ) {
        obj.nn = Array.isArray(obj.nn) ? obj.nn : [];
        const step = rawValue.slice(1);
        const spec = key + step;
        if (!obj.nn.includes(spec)) obj.nn.push(spec);
    }

	    if (o === obj && key === "i") {
	        o[key] = this.parseIValue(rawValue, obj);
	        this.syncConnectionFromI(obj);
	        return;
	    }

	    if (o === obj && /^(?:roll|rolle|rollen)$/i.test(key)) {
	        const [heightRaw, countRaw = "4"] = String(rawValue || "").split(",").map(value => value.trim());
	        const height = Number(this.replaceDimensions(heightRaw));
	        const count = Number(countRaw);
	        if (Number.isFinite(height)) this.handleRollers(obj, Math.abs(height), count === 2 ? 2 : 4);
	        return;
	    }

    // ==================================================
    // u shortcut:
    // l.u=-8g,-4t -> l.ug=8, l.ut=4
    // g = ground/bottom push, t = top push
    // ==================================================

	    if (key === "u") {
	        if (applyUPushSpec(o, v, keys[keys.length - 2])) return;
	    }

	    if (key === "vi") {
	        const current = String(o[key] || "").split(/[,\s+]+/).filter(Boolean);
	        const next = String(v || "").split(/[,\s+]+/).filter(Boolean);
	        o[key] = [...new Set([...current, ...next])].join(" ");
	        return;
	    }

	    if (o === obj && key === "fit") {
	        this.applyFitSpec(obj, rawValue);
	        return;
	    }

    // ==================================================
    // CONNECT ARRAYS
    // cur / tar
    // FORMAT:
    // [korpus, part, corner]
    // ==================================================

    if (
        Array.isArray(oldVal) &&
        (key === "cur" || key === "tar")
    ){

        const parts = v
            .split(",")
            .map(s => {

                s = s.trim();

                return s === "" ? null : s;
            });

        while (parts.length < 3){
            parts.push(null);
        }

        // corner IMMER string
        if (parts[2] != null){
            parts[2] = String(parts[2]);
        }

	        o[key] = [
	            parts[0],
	            parts[1] ? normalizePartKey(parts[1]) : parts[1],
	            parts[2]
	        ];
	        if (o === obj) {
	            this.syncIFromConnection(obj, key);
	            this.syncConnectionFromI(obj);
	        }
	
	        return;
	    }

    const rememberValueSequence = value => {
        if (!Array.isArray(value)) return;
        Object.defineProperty(o, "__lastValueSequence", {
            value: clonePlainValue(value),
            configurable: true,
            enumerable: false
        });
    };

    const parseArrayValue = (rawPart, oldPart = 0) => {
        const rawText = String(rawPart ?? "").trim();
        const annotatedRest = rawText.match(/^(-?\d+(?:\.\d+)?)\s*\(\s*rest\s*\)$/i);
        if (annotatedRest) return `${annotatedRest[1]}rest`;
        const p = stripValueAnnotation(rawText);
        if (p === "") return null;
        if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(p)) return p;
        const gap = p.match(/^g(-?\d+(?:\.\d+)?)$/i);
        if (gap) return `g${gap[1]}`;
        const suffixGap = p.match(/^(-?\d+(?:\.\d+)?)g$/i);
        if (suffixGap) return `g${suffixGap[1]}`;
        const rest = p.match(/^(-?\d+(?:\.\d+)?)rest$/i);
        if (rest) return `${rest[1]}rest`;
        if (/^\+[+-]?\d+(?:\.\d+)?$/.test(p)) {
            const rel = Number(p.slice(1));
            const base = Number(oldPart || 0);
            if (Number.isFinite(rel) && Number.isFinite(base)) return base + rel;
        }
        if (!isNaN(p)) return Number(p);

        if (["sx", "sy", "sz"].includes(key) && /^-?\d*(?:\.\d+)?s$/i.test(p)) {
            return p;
        }

        const resolved = this.resolveInputValue(obj, p);
        if (Number.isFinite(resolved)) return resolved;

        const exprValue = this.resolveInputValue(obj, `(${p})`);
        if (Number.isFinite(exprValue)) return exprValue;

        return resolved !== p ? resolved : p;
    };

	    if (String(rawValue).trim().toLowerCase() === "dito" && Array.isArray(o.__lastValueSequence)) {
	        o[key] = clonePlainValue(o.__lastValueSequence);
	        if (["w", "d", "h"].includes(key) && Number.isFinite(Number(oldVal))) {
	            o["_" + key + "Full"] = Number(oldVal);
	            if (!o.__primarySequenceDim) {
	                Object.defineProperty(o, "__primarySequenceDim", {
	                    value: key,
	                    configurable: true,
	                    enumerable: false
	                });
	            }
	        }
	        rememberValueSequence(o[key]);
	        return;
	    }

	    if (key === "o") {
	        const specs = String(rawValue)
	            .split(",")
	            .map(part => stripValueAnnotation(part))
	            .filter(Boolean);
	        for (const spec of specs) {
	            const m = spec.match(/^([+-]?\d+(?:\.\d+)?)([xyz])(\d+)?$/i);
	            if (!m) continue;
	            const rotKey = "o" + m[2].toLowerCase();
	            o[rotKey] = Number(m[1]);
	            o["_" + rotKey + "Raw"] = m[1];
	            if (m[3] != null) o[rotKey + "c"] = Number(m[3]);
	        }
	        return;
	    }

	    if (["nx", "ny", "nz", "sx", "sy", "sz"].includes(key) && String(v).includes(",")) {
	        o[key] = String(v)
	            .split(",")
	            .map((part, i) => parseArrayValue(part, oldVal?.[i]))
	            .filter(x => x != null);
	
	        return;
	    }

	    if (["ox", "oy", "oz"].includes(key) && String(rawValue).includes(",")) {
	        const [angleRaw, cornerRaw] = String(rawValue).split(",");
	        const angleText = String(angleRaw ?? "").trim();
	        const angleIsRelative = /^\+[+-]?\d+(?:\.\d+)?$/.test(angleText);
	        let angle = null;
	        if (angleIsRelative) {
	            if (markRelativeApplied()) {
	                const rel = Number(angleText.slice(1));
	                const base = Number(oldVal || 0);
	                if (Number.isFinite(rel) && Number.isFinite(base)) angle = base + rel;
	            }
	        } else {
	            angle = parseArrayValue(angleRaw, oldVal);
	        }
	        const corner = parseArrayValue(cornerRaw, o[key + "c"]);

	        if (Number.isFinite(angle)) o[key] = angle;
	        if (Number.isFinite(corner)) o[key + "c"] = corner;
	        o["_" + key + "Raw"] = angleText;

	        return;
	    }

	    if (["ox", "oy", "oz"].includes(key) && /^\+[+-]?\d+(?:\.\d+)?$/.test(rawValue)) {
	        if (!markRelativeApplied()) return;
	        const rel = Number(rawValue.slice(1));
	        const base = Number(oldVal || 0);
	        if (Number.isFinite(rel) && Number.isFinite(base)) {
	            o[key] = base + rel;
	            o["_" + key + "Raw"] = rawValue;
	        }
	        return;
	    }

	    if (Number.isFinite(distanceValue)) {
	        o[key] = distanceValue;
	        return;
	    }

    // ==================================================
    // GENERISCHE ARRAYS
    // ==================================================

    if (Array.isArray(oldVal)){

        const parts = v
            .split(",")
            .map(s => s.trim())
            .filter(s => s !== "");

        const arr = [...oldVal];

        for (let i = 0; i < parts.length; i++){
            arr[i] = parseArrayValue(parts[i], arr[i]);
        }

        o[key] = arr;
        rememberValueSequence(arr);

        return;
    }

    const rawIsSequence = String(rawValue).includes(",") && !/\([^()]*_[^()]*\)/.test(String(rawValue));

    if (
        ["w", "d", "h", "x", "y", "z"].includes(key) &&
        rawIsSequence
    ) {
        const arr = String(rawValue)
            .split(",")
            .map((part, i) => parseArrayValue(part, oldVal?.[i]))
            .filter(x => x != null);

        o[key] = arr;
        if (["w", "d", "h"].includes(key) && Number.isFinite(Number(oldVal))) {
            o["_" + key + "Full"] = Number(oldVal);
            if (!o.__primarySequenceDim) {
                Object.defineProperty(o, "__primarySequenceDim", {
                    value: key,
                    configurable: true,
                    enumerable: false
                });
            }
        }
        rememberValueSequence(arr);
        return;
    }

    // ==================================================
    // ZAHL
    // ==================================================

    if (typeof oldVal === "number"){

        if (/^\+[+-]?\d+(?:\.\d+)?$/.test(rawValue)){
            if (!markRelativeApplied()) return;
            const rel = Number(rawValue.slice(1));
            if (Number.isFinite(rel)){
                o[key] = oldVal + rel;
                if (["ox", "oy", "oz"].includes(key)) {
                    o["_" + key + "Raw"] = rawValue;
                }
                return;
            }
        }

        const n = Number(v);

        if (!isNaN(n)){

            o[key] = n;
            if (["ox", "oy", "oz"].includes(key)) {
                o["_" + key + "Raw"] = rawValue;
            }

            return;
        }
    }

    // ==================================================
    // STRING
    // ==================================================

    if (typeof oldVal === "string"){

        o[key] = v;
        if (o === obj && key === "p") obj.j = v;

        return;
    }

    // ==================================================
    // DEFAULT
    // ==================================================

    if (!isNaN(v)){

        o[key] = Number(v);

    } else {

        o[key] = v;
    }

    if (o === obj && key === "p") obj.j = String(o[key] || "");
}

  setByToken(obj, token) {

  // =========================================
  // 1. "=" SYNTAX (NEU)
  // =========================================
  if (token.includes("=")) {
    const [path, rawVal] = token.split("=");

    let val;

    const v = rawVal.trim();
    const key = path.trim().split(".").pop();
    const decimal = parseDecimalComma(v);

    // Ausdruck
    if (v.startsWith("(") && v.endsWith(")")) {
      val = evalExpr(v.slice(1, -1), obj);
    }

    // einfache Referenz
    else if (!/[+\-*/]/.test(v) && !v.includes(",")) {
      val = getByPath(obj, v);
    }

    // Liste (z. B. tar)
    else if (v.includes(",")) {
      if (decimal !== null && ["w", "d", "h", "x", "y", "z"].includes(key)) {
        val = decimal;
      } else {
        val = v; // WICHTIG: als String speichern!
      }
    }

    // fallback
    else {
      val = parseValue(v, obj);
    }

    setByPath(obj, path.trim(), val);
    return;
  }

  // =========================================
  // 2. "." SYNTAX (BESTAND)
  // =========================================
  const parts = token.split(".");
  if (parts.length < 2) return;

  const rawVal = parts.pop();
  const path = parts;

  let o = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!o[k]) o[k] = {};
    o = o[k];
  }

  const key = path[path.length - 1];
  const oldVal = o[key] ?? 0;

  let val;

  // -------- tar SPEZIALFALL --------
  if (key === "tar") {
    val = rawVal; // String behalten!
  }

  // -------- ARRAY (nur wenn NICHT tar) --------
  else if (rawVal.includes(",")) {
    const decimal = parseDecimalComma(rawVal);
    if (decimal !== null && ["w", "d", "h", "x", "y", "z"].includes(key)) {
      val = decimal;
    } else {
      val = rawVal.split(",").map(v => parseValue(v, obj));
    }
  }

  // -------- AUSDRUCK --------
  else if (rawVal.startsWith("=")) {
    val = evalExpr(rawVal.slice(1), obj);
  }

  // -------- RECHENOP --------
  else if (/^[+\-*/]/.test(rawVal)) {
    const num = parseFloat(rawVal.slice(1));
    const op = rawVal[0];

    if (op === "+") val = oldVal + num;
    if (op === "-") val = oldVal - num;
    if (op === "*") val = oldVal * num;
    if (op === "/") val = oldVal / num;
  }

  // -------- NORMAL --------
  else {
    val = parseValue(rawVal, obj);
  }

  o[key] = val;
}




    new__Korp(innk) {
        // this.err = ""
        // // this.sess.check=[]
        var ko = {
            u_done: 0,
            d: 50,  // depth
            child: 0,
            lfs: [],  // list of blocks
            nme: "a",
            w: 60,  // width
            jj: [],  // ["l", "r", ...]
            i: this.defaultI(),
            cur: [null, null, '0'],  // current corner for rotation
            tar: [],  // target corner for rotation
            h: 70,
            x: 0,  // offset x
            y: 0,
            z: 0,
            bbw: 0,
            bbd: 0,
            bbh: 0,
            link: "",
            innurl: "",
            comment: "",
            // ig: 0,
            nx: [1, 0],
            ny: [1, 0],
            nz: [1, 0],
            nn: [],
            xx: this.xx || 0,  // gap links/rechts
            xy: this.xy || 0,  // gap front/rueckwand
            xz: this.xz || 0,  // gap boden/deckel
            innk: "", // input
            j: "lrgtbc",
            p: "lrgtbc",
            eu: 0,  // euro
            ep: 0, // einzelpreis fuer angebot
            m: 1,  // material
	            ox: 0,  // rotate x
	            oy: 0,  // rotate y
	            oz: 0,  // rotate z
	            oxc: null,  // rotation pivot corner x
	            oyc: null,  // rotation pivot corner y
	            ozc: null,  // rotation pivot corner z
	            s: 0,
            sp3: [],
            ty: "c",
            yy: 0,  // zero point of korp
            zz: 0,  // zero point of korp
            u: 0,  // used for rotation
	            ug: 0
	
	        }

	        for (const token of this.projectDefaults || []) {
	            this.applyToken(ko, token);
	        }
	        // if(innk.length< 3 && this.oks.length > 0){
        //     innk= " "+this.lastko.toUpperCase+innk
        // }


        ko.innk = this.replVars(innk)
        ko.innk = this.replaceRefs(innk, this)
        ko.comment = String(ko.innk).match(/(?:^|\s)#\s*(.*)$/)?.[1]?.trim() || "";
        // ko.innk = this.rechenausdrueckeImTextBerechnen(ko.innk)
        ko.lbs = this.makeblocks(ko.innk)  // mk blocks    
        
        

        const headSpec = this.parseKorpusHeadSpec(ko.lbs[0]);
        ko.nme = headSpec.name || ko.lbs[0][0]
        ko.lbs[0] = ko.nme
        ko.parent = headSpec.parent || (this.disableImplicitParent ? "" : this.implicitParentName(ko.nme))

        // --------------------------------------
// AUTO CONNECT:
// a1 -> connect a1 an a, b.a1 -> connect b an a1
// --------------------------------------

	if (
	    ko.parent &&
	    !ko.tar?.[0]
	){
	    ko.i = [null, "0", ko.parent, null, "3"];
	    this.syncConnectionFromI(ko);
	}
        // alert (ko.innk)
        this.inheritParentLBS(ko, ko.parent);

        // ko.lbs = [...new Set(ko.lbs)]
        // ko.lbs=keepLastCommands(ko.lbs)



        // alert(JSON.stringify(ko.lbs) )
        // ko.cur = [ko.nme, null, 0]  // current corner for rotation
        let iiij = 0

        // add and remove pa
        this.reducePBlocks(ko)

        // alert(ko.lbs)
        // ko.lbs=this.filterLeftByMinusPattern(ko.lbs)
        this.oks[ko.nme] = Object.assign({}, ko)
        let k = this.oks[ko.nme]
        this.syncConnectionFromI(k)
        // k.lbs=innk.split(" ")
        // this.makeWDHp(k)
        this.iterLbsToFuu(k, "ut")  // important
        this.applyLegSpec(k)
        this.prepareInteriorLayoutParts(k)

        // ==================================================
// 🔥 PART ERKENNUNG (W D H zählen)
// ==================================================
const dimCount =
  (k.w != null ? 1 : 0) +
  (k.d != null ? 1 : 0) +
  (k.h != null ? 1 : 0);

if (dimCount < 3){

  const part = this.new_Part(k);

  this.oks[k.nme] = part;
  return part;
}

        // k.cur = ko.nme+".l,0"  // current corner for rotation
        // (dd(this.mm))
        this.makeParts_step1(k)
        this.iterLbsToFuu(k, "ut")  // important
        // this.makeM(k)
        this.makeParts_step2(k)
        //        this.iterLbsToFuu(k,"nswdh")
        // this.iterLbsToFuu(k, "oucxysznl") // important, if not xyz cant move
        this.iterLbsToFuu(k, "oucxysznlwdh") // important, if not xyz cant move
        this.applyLegSpec(k)
        this.expandPartValueSequences(k)
        this.applyPartOrderIntersections(k)
        this.applyInteriorLayout(k)
        // this.iterLbsToFuu(k)

        const splitHandledParts = new Set();
        for (const pa of [...k.jj]) {
            if (this.createPartSplitMatrix(k, k[pa])) splitHandledParts.add(pa);
        }

        for (let pa of k.j) {
            if (splitHandledParts.has(pa)) continue;
            this.createNxyz(k, k[pa], "x")
            this.createNxyz(k, k[pa], "y")
            this.createNxyz(k, k[pa], "z")
        }

        //**
        // preis */
        for (let e of k.jj) {
            if (!k[e]) continue;
            // (k.eu)
            let m = this.getm2mkante(k[e])
            let p = this.geteumat(k[e])
            k.eu += p
        }
        k.ep = k.eu * this.cfactor

        if (k.parent && !String(k.nme || "").includes(".")) {
            this.cloneChildKorpusse(k.parent, k.nme);
        }

        this.createNxyz(k, null, "x")
        this.createNxyz(k, null, "y")
        this.createNxyz(k, null, "z")

        if (k.parent && String(k.nme || "").includes(".")) {
            this.cloneChildToExistingParentClones(k.parent, k.nme);
        }

        // });
        let errr = Object.values(k).every(v => v == null)
        // Beispiel:
        let filtered = this.deepFilterObjectByRegex(k, /u[a-z]/);
        // console.log(JSON.stringify(k));
        // alert(dd(filtered));
        // this.iterLbsToFuu(k, "l") // important, if not xyz cant move
        return k
    } //


    new_Part(k){

  const w = Number(k.w ?? 1);
  const d = Number(k.d ?? 1);
  const h = Number(k.h ?? 1);

  return {
    nme: k.nme,
    type: "part",

    w,
    d,
    h,

    x: Number(k.x ?? 0),
    y: Number(k.y ?? 0),
    z: Number(k.z ?? 0),

	    ox: 0,
	    oy: 0,
	    oz: Number(k.oz ?? 0),
	    oxc: k.oxc ?? null,
	    oyc: k.oyc ?? null,
	    ozc: k.ozc ?? null,
	
	    m: k.m,
    co: k.co,

    nx: k.nx || [1,0],
    ny: k.ny || [1,0],
    nz: k.nz || [1,0],

    // ❗ KEIN Innenmaßsystem
    p: null,
    jj: [],

    type: "part"
  };
}


    deepFilterObjectByRegex(obj, regex, path = '', result = {}) {
        for (let key in obj) {
            let fullKey = path ? path + '.' + key : key;
            if (regex.test(key)) {
                result[fullKey] = obj[key];
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.deepFilterObjectByRegex(obj[key], regex, fullKey, result);
            }
        }
        return result;
    }






    getm2mkante(p) {
        let len = 0
        let arr = [p.w, p.d, p.h]
        arr.sort((a, b) => b - a); // sort descending
        //  (arr)
        p.m2 = (arr[0] * arr[1] / 10000 * WASTE).toFixed(2)
        p.mkante = ((arr[0] * 2 + arr[1] * 2) / 100 * 1.1).toFixed(1)
        return p.m2
    }

    filterLeftByMinusPattern(arr) {
        if (arr.length === 0) return [];

        const firstItem = arr[0];
        const output = [firstItem];

        // Alle Steuerbefehle und ihre Präfixe sammeln (außer Index 0)
        const controlPrefixes = [];

        for (let i = 1; i < arr.length; i++) {
            const item = arr[i];
            const minusIndex = item.indexOf("-");
            if (minusIndex > 0) {
                const prefix = item.substring(0, minusIndex);
                if (prefix !== "p" && /\-$/.test(item)) {
                    controlPrefixes.push({ prefix, index: i });
                }
            }
        }

        // Alle Steuerbefehle merken, um sie später zu überspringen
        const controlIndices = new Set(controlPrefixes.map(e => e.index));
        const prefixesToRemove = controlPrefixes.map(e => e.prefix);

        // Alle restlichen Einträge prüfen
        for (let i = 1; i < arr.length; i++) {
            if (controlIndices.has(i)) continue; // Steuerbefehl selbst überspringen

            const entry = arr[i];
            const shouldRemove = prefixesToRemove.some(prefix => {
                return entry.startsWith(prefix) && i < controlPrefixes.find(e => e.prefix === prefix).index;
            });

            if (!shouldRemove) {
                output.push(entry);
            }
        }

        return output;
    }


    addAndRemoveParts(orig, ctrl) {

        // --- p als Kommando entfernen ---
        let base = orig.startsWith("p") ? orig.slice(1).split("") : orig.split("");
        let s = ctrl.startsWith("p") ? ctrl.slice(1) : ctrl;

        // --- Token: buchstaben + optional (- oder zahl) ---
        const regex = /([a-z]{1,3})(-|\d+)/g;
        let m;

        while ((m = regex.exec(s)) !== null) {

            const letters = m[1].split("");
            const action = m[2];

            /* -----------------------------
               REMOVE: buchstaben + "-"
               ----------------------------- */
            if (action === "-") {
                base = base.filter(ch => !letters.includes(ch));
                continue;
            }

            /* -----------------------------
               INSERT: buchstaben + zahl
               ----------------------------- */
            const idx = Number(action);

            if (!Number.isNaN(idx)) {
                base.splice(idx, 0, ...letters);
            }
        }

        return "p" + base.join("");
    }

    isControlPBlock(pstr) {
        // ohne führendes p prüfen
        return /[\d-]/.test(pstr.slice(1));
    }

    reducePBlocks(ko) {

    // -------------------------------
    // 🔥 nur p-blöcke betrachten
    // -------------------------------
    const pEntries = [];

    ko.lbs.forEach((e, idx) => {
        if (typeof e === "string" && e.startsWith("p")) {
            pEntries.push({ value: e, index: idx });
        }
    });

    if (pEntries.length < 2) return;

    // -------------------------------
    // 🔥 nur die letzten zwei relevant
    // -------------------------------
    const p0 = pEntries[pEntries.length - 2];
    const p1 = pEntries[pEntries.length - 1];

    // -------------------------------
    // fall A: steuerblock
    // -------------------------------
    if (this.isControlPBlock(p1.value)) {

        const newP = this.addAndRemoveParts(p0.value, p1.value);

        ko.lbs[p1.index] = newP;

        // ❗ vorsicht index shift
        ko.lbs.splice(p0.index, 1);

        return;
    }

    // -------------------------------
    // fall B: einfach überschreiben
    // -------------------------------
    ko.lbs.splice(p0.index, 1);
}

    getMaterial(index) {
        return this.lm[index] || this.lm[1] || {
            nme: "default",
            s: 1.9,
            co: "white",
            l: "m",
            p: 0,
            pu: 0
        };
    }

    geteumat(p) {
        const mat = this.getMaterial(p.m)
        p.eu += Number(p.m2 * mat.p)
        p.eu += Number((p.mkante * mat.pu).toFixed(2))

        return p.eu
    }
    eukan(p) {
    }
    euts(p) {

    }
    eubt(p) {

    }
    euso(p) {

    }
    eurwvb(p) {

    }

    makeblocks(inn) {
        const tokens = String(inn)
            .trim()
            .replace("  ", " ")
            .split(" ");
        const commentIndex = tokens.findIndex(token => String(token).startsWith("#"));
        let r = tokens
            .slice(0, commentIndex >= 0 ? commentIndex : tokens.length)
            .filter(token => {
                const text = String(token);
                if (text === "-u") return true;
                // A leading "-" disables a whole DSL block without deleting it.
                // Numeric values such as x=-10 or u=-8g are not affected.
                if (/^-/.test(text)) return false;
                return true;
            })

        return r
    }



    makeWDHp(ko) {
        for (let e of ko.lbs.slice(1)) {
            if (/^\d+,/.test(e)) {
                this.fuua(ko, e)
                //     this.fuua(ko, e.slice(1))



                // alert("a u _ "+JSON.stringify(gg))

            } else if (/[awdhp]/.test(e[0])) {

                // this["fuu" + e[0]](ko, e.slice(1))
                this["fuu" + e[0]](ko, e.slice(1))

            }
        }
    }

    makeM(ko) {
        for (let e of ko.lbs.slice(1)) {
            if (/[m]/.test(e[0])) {

                this["fuum"](ko, e.slice(1))

            }
        }
    }


    iterLbsToFuu(ko, fs = "pamwdhxyzcnuostl") {

        // function err2(er) {
        //     // alert(er)
        //     console.log("err2", er)
        //     // document.getElementById("err").innerHTML = er

        // }
        for (let e of ko.lbs.slice(1)) {
            this.applyToken(ko, e);
        //     if (e[0] == "-" || /[-]xxxx/.test(e)) {
        //         //      continue
        //     }
        //     if (e[0]=="#") {
        //         ko.ali=e.slice(1)
        //     }
        //     let re = new RegExp(e[0])
        //     //alert(e)

        //     if (typeof this["fuu" + e[0]] === 'function' && fs.includes(e[0])) {
        //         try {
        //             this["fuu" + e[0]](ko, e.slice(1))

        //         } catch (error) {
        //             this.err += error + error.stack
        //             if (DEBUG == 1) {


        //                 err2(this.err)
        //             } else {
        //                 err2("Zeile: " + ko.innk + " <br>Fehler bei: " + e)

        //             }
        //         }
        //     }
        }
    }


    makeParts_step1(ko) {

    for (const pp of ko.j) {
        ko.jj.push(pp);
    }

    for (const pp of ko.jj) {

        const existing = ko[pp] || {};

        ko[pp] = Object.assign({
            nme: pp,
            x: 0,
            y: 0,
            z: 0,
            dz: 0,
            s: ko.s || 0,
            co: this.getMaterial(1).co,
            ox: 0,
            oy: 0,
            oz: 0,
            u: [0, 0, 0, 0],
            m: ko.m,
            mkante: 0,
            nx: [1, 0],
            ny: [1, 0],
            nz: [1, 0],
            eu: 0,
            eus: {},
            n: 1
        }, existing);

        // ❌ KEIN w,d,h hier!
        // ❌ KEIN Überschreiben!
    }
}


    // sp3(str, numdf = 1, padf = "a", nopadf = "x") {

    //     var paSet = new Set(PARTS.split(""));
    //     var pa = [];
    //     var nopa = [];
    //     var nums = [];
    //     var numsa = [];

    //     str.split(',').forEach(part => {
    //         // Match either:
    //         // - signed numbers: [+/-]?\d+
    //         // - single letters: [a-zA-Z]
    //         // - or fallback to any char (if needed)
    //         const tokens = part.match(/([+-]?\d+)|[a-zA-Z]/g);

    //         if (tokens) {
    //             tokens.forEach(token => {
    //                 if (/^[+-]?\d+$/.test(token)) {
    //                     nums.push(Number(token));
    //                 } else if (token.length === 1 && /[a-zA-Z]/.test(token)) {
    //                     (paSet.has(token) ? pa : nopa).push(token);
    //                 }
    //             });
    //         }
    //     });

    //     if (nums.length == 0) {
    //         if (Array.isArray(numdf)) {

    //             nums = numdf
    //         } else {
    //             nums.push(numdf)

    //         }
    //     }
    //     // if (nums.length == 1) {
    //     //     nums.push(0.1)
    //     // }
    //     if (pa.length == 0) {
    //         if (padf.length > 1) {
    //             pa = [...padf]
    //         } else {
    //             pa.push(padf)
    //         }
    //     }
    //     if (nopa.length == 0) { nopa.push(nopadf) }

    //     return { pa, nopa, nums, numsa }
    // }
    evaluateAndReplace1(input, k) {
        // Ersetze W mit seinem numerischen Wert (nur wenn es alleine steht)
        input = input.replace(/w/g, k.w);
        input = input.replace(/d/g, k.d);
        input = input.replace(/h/g, k.h);
        if (/[-+*/]/.test(input)) {
            input = this.rechenausdrueckeImTextBerechnen(input)
            return input
        } else {
            return input
        }
        // Suche alle Ausdrücke: Zahl [Operator] Zahl
        return input.replace(/(-?\d+(?:\.\d+)?)(\s*[-+*/]\s*)(-?\d+(?:\.\d+)?)/g, (_, left, op, right) => {
            const a = parseFloat(left);
            const b = parseFloat(right);
            const operator = op.trim();

            let result;
            switch (operator) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/': result = b !== 0 ? a / b : 'NaN'; break;
                default: result = 'NaN';
            }

            // Rückgabe ersetzt den Originalausdruck durch das Ergebnis
            return result;
        });
    }

evaluateAndReplace(input, k) {
    input = String(input).trim();

    // nur einzelne w/d/h ersetzen, nicht Buchstaben in Namen
    input = input
        .replace(/\bw\b/g, String(k.w))
        .replace(/\bd\b/g, String(k.d))
        .replace(/\bh\b/g, String(k.h));

    // nur reine Rechenausdrücke auswerten
    if (/^[0-9+\-*/().\s]+$/.test(input) && /[+\-*/]/.test(input)) {
        try {
            const result = Function('"use strict"; return (' + input + ')')();

            if (Number.isFinite(result)) {
                return String(result);
            }
        } catch (e) {
            console.warn("Rechenausdruck nicht auswertbar:", input, e);
        }
    }

    return input;
}

    rechenausdrueckeImTextBerechnen(text) {
        const regex = /\b\d+(?:\s*[-+*/]\s*\d+)+\b/g;

        return text.replace(regex, (ausdruck) => {
            try {
                const wert = eval(ausdruck);
                return wert;
            } catch {
                return ausdruck;
            }
        });
    }

	sp3(k, str, numdf = 1, padf = "a", nopadf = "x") {
    const paSet = new Set(PARTS.split(""));

    let pa = [];
    let nopa = [];
    let nums = [];
    let prefs = [];
    let numsa = [];
    let corners = [];

    /* --------------------------------------------------
       0. SPLIT (zentrale Struktur)
    -------------------------------------------------- */

    let segments = str.split(",").map(e => this.evaluateAndReplace(e.trim(), k));

    /* --------------------------------------------------
       1. SEGMENTE DURCHGEHEN
    -------------------------------------------------- */

    for (let seg of segments) {

        if (!seg) continue;

        /* ----------------------------------------------
           1.1 KORPUS.TEIL+ECKE (z. B. a12.g4)
        ---------------------------------------------- */

        let refMatch = seg.match(/^([a-z][a-z0-9]*)\.([a-z])(\d)$/);

        if (refMatch) {
            corners.push({
                korpus: refMatch[1],
                teil: refMatch[2],
                ecke: Number(refMatch[3])
            });
            nopa.push(seg);
            continue;
        }

        /* ----------------------------------------------
           1.2 REINER NAME (a12, regal7)
        ---------------------------------------------- */

        if (/^[a-z][a-z0-9]*$/.test(seg)) {
            nopa.push(seg);
            continue;
        }

        /* ----------------------------------------------
           1.3 ZAHL + RICHTUNG (z. B. 8gl)
        ---------------------------------------------- */

        const zbRegex = /(-?\d+(?:\.\d+)?)([a-zA-Z]+)/g;

        seg = seg.replace(zbRegex, (match, num, letters) => {

            const value = Number(num);

            const dir = letters[0] || null;
            const mod = letters.length > 1 ? letters.slice(1) : null;

            numsa.push({
                num: value,
                dir: dir,
                mod: mod
            });

            return "";
        });

        /* ----------------------------------------------
           1.4 TOKENISIERUNG REST
        ---------------------------------------------- */

        const tokens = seg.match(/\+|-?\d+(?:\.\d+)?|[a-zA-Z]/g);
        let plusBuffer = "";

        if (tokens) {
            for (let token of tokens) {

                if (token === "+") {
                    plusBuffer += "+";
                    plusBuffer = plusBuffer.slice(-2);
                    continue;
                }

                if (/^-?\d+(?:\.\d+)?$/.test(token)) {
                    nums.push(Number(token));
                    prefs.push(plusBuffer);
                    plusBuffer = "";
                    continue;
                }

                if (token.length === 1 && /[a-zA-Z]/.test(token)) {
                    (paSet.has(token) ? pa : nopa).push(token);
                }
            }
        }
    }

    /* --------------------------------------------------
       2. DEFAULTS
    -------------------------------------------------- */

    if (nums.length === 0) {
        nums = Array.isArray(numdf) ? numdf : [numdf];
        prefs = nums.map(() => "");
    }

    pa = pa.length ? pa : [padf];
    nopa = nopa.length ? nopa : [nopadf];

    /* --------------------------------------------------
       3. RETURN
    -------------------------------------------------- */
	    return {
        pa,        // teile (l,r,g,...)
        nopa,      // namen (a12, regal7, a12.g4)
        nums,      // zahlen
        prefs,     // prefix (+)
        numsa,     // zahlen + richtung
        corners,   // strukturierte refs
        segments   // original struktur (wichtig!)
    };
}

    sp3o(k, str, numdf = 1, padf = "a", nopadf = "x") {
        
        const paSet = new Set(PARTS.split(""));

        let pa = [];
        let nopa = [];
        let nums = [];
        let prefs = [];
        let numsa = [];

        /* --------------------------------------------------
           0. Vorverarbeitung
        -------------------------------------------------- */

        let astr = str.split(",");
        let na = [];

        for (let e of astr) {
            e = this.evaluateAndReplace(e, k);
            na.push(e);
        }

        str = na.join(",");
        str = str.replace(/,(?!\d)|(?<!\d),/g, "");

        /* --------------------------------------------------
           1. Zahl + Richtungsblock (z.B. 8gl, -5rt)
        -------------------------------------------------- */

        const zbRegex = /(-?\d+(?:\.\d+)?)([a-zA-Z]+)/g;

        str = str.replace(zbRegex, (match, num, letters) => {

            const value = Number(num);

            const dir = letters[0] || null;
            const mod = letters.length > 1 ? letters.slice(1) : null;

            numsa.push({
                num: value,
                dir: dir,
                mod: mod
            });

            return ""; // aus String entfernen
        });

        /* --------------------------------------------------
           2. Tokenisierung Rest
        -------------------------------------------------- */

        const tokens = str.match(/\+|-?\d+(?:\.\d+)?|[a-zA-Z]/g);
        let plusBuffer = "";

        if (tokens) {
            for (let token of tokens) {

                if (token === "+") {
                    plusBuffer += "+";
                    plusBuffer = plusBuffer.slice(-2);
                    continue;
                }

                if (/^-?\d+(?:\.\d+)?$/.test(token)) {
                    nums.push(Number(token));
                    prefs.push(plusBuffer);
                    plusBuffer = "";
                    continue;
                }

                if (token.length === 1 && /[a-zA-Z]/.test(token)) {
                    (paSet.has(token) ? pa : nopa).push(token);
                }
            }
        }

        /* --------------------------------------------------
           3. Defaults
        -------------------------------------------------- */

        if (nums.length === 0) {
            nums = Array.isArray(numdf) ? numdf : [numdf];
            prefs = nums.map(() => "");
        }

        pa = pa.length ? pa : [padf];
        nopa = nopa.length ? nopa : [nopadf];

        /* --------------------------------------------------
           4. Ergebnis
        -------------------------------------------------- */
        return { pa, nopa, nums, prefs, numsa };
    }

    
resolvePar(ko, str) {

    if (typeof str !== "string") return str;
    if (!str.includes("(")) return str;

    return str.replace(/([a-z0-9]+)\(([^)]+)\)/g, function (_, prefix, inside) {

        let out = [];

        for (let i = 0; i < inside.length; i++) {

            let part = inside[i];

            // Default aus Korpus holen (falls vorhanden)
            let def = "";

            if (ko && ko.u_defaults && ko.u_defaults[part] != null) {
                def = ko.u_defaults[part];
            }

            out.push(prefix + (def || "") + part);
        }

        return out.join(" ");
    });
}

    ispa(k, pa) {
        if (Object.keys(k).includes(pa)) {
            // let re = new RegExp(pa)

            // if (re.test(ko.j)) {
            return true
        } else {
            return false
        }
    }

    handleSockel(k, height) {
        if (k._h_before_leg == null) {
            k._h_before_leg = k.h
        } else {
            k.h = k._h_before_leg
        }

        const amount = Number(height);
        k.leg = 0
        k.legCount = 0
        k.roll = 0
        k.rollCount = 0

        if (!Number.isFinite(amount) || amount <= 0) {
            k.ug = 0
            return
        }

        k.ug = amount
        k.h -= amount
    }

    handleLegs(k, height, count = 4) {

        // -------------------------------------------------
        // Reset alte Unterbauten
        // -------------------------------------------------
        // k.ug = 0
        // k.leg = 0

        // alte Beine entfernen
        const oldLegs = ["g0", "g3", "g4", "g7"]
        k.jj = k.jj.filter(p => !oldLegs.includes(p))
        for (const oldLeg of oldLegs) delete k[oldLeg]

        if (k._h_before_leg == null) {
            k._h_before_leg = k.h
        } else {
            k.h = k._h_before_leg
        }

        if (!height || height <= 0) {
            k.leg = 0
            k.legCount = 0
            k.roll = 0
            k.rollCount = 0
            return
        }

        // -------------------------------------------------
        // Neue Beine setzen
        // -------------------------------------------------
        k.roll = 0
        k.rollCount = 0
        k.leg = height
        k.legCount = count
        k.h -= height
        const legs = count === 2 ? ["g0", "g3"] : ["g0", "g3", "g4", "g7"]
        const legSize = 4

        for (let part of legs) {
            if (!k.jj.includes(part)) {
                k.jj.push(part)
            }
        }

        const legParts = {
            g0: {
                w: legSize, d: legSize, h: height,
                x: 0, y: 0, z: 0,
                m: k.m,
                s: legSize
            },
            g3: {
                w: legSize, d: legSize, h: height,
                x: (Number(k.w) || 0) - legSize, y: 0, z: 0,
                m: k.m,
                s: legSize
            },
            g4: {
                w: legSize, d: legSize, h: height,
                x: 0, y: (Number(k.d) || 0) - legSize, z: 0,
                m: k.m,
                s: legSize
            },
            g7: {
                w: legSize, d: legSize, h: height,
                x: (Number(k.w) || 0) - legSize,
                y: (Number(k.d) || 0) - legSize,
                z: 0,
                m: k.m,
                s: legSize
            }
        }

        for (const part of legs) {
            k[part] = legParts[part]
        }

        // -------------------------------------------------
        // Optional: Defaults setzen (Material etc.)
        // -------------------------------------------------
        // falls du eigenes Material willst:
        // k.m_leg = k.m
    }

    handleRollers(k, height, count = 4) {
        const oldLegs = ["g0", "g3", "g4", "g7"]
        k.jj = k.jj.filter(p => !oldLegs.includes(p))
        for (const oldLeg of oldLegs) delete k[oldLeg]

        if (k._h_before_leg == null) {
            k._h_before_leg = k.h
        } else {
            k.h = k._h_before_leg
        }

        if (!height || height <= 0) {
            k.leg = 0
            k.legCount = 0
            k.roll = 0
            k.rollCount = 0
            return
        }

        k.leg = height
        k.legCount = count
        k.roll = height
        k.rollCount = count
        k.h -= height

        const rollers = count === 2 ? ["g0", "g3"] : ["g0", "g3", "g4", "g7"]
        const rollSize = 5

        for (let part of rollers) {
            if (!k.jj.includes(part)) k.jj.push(part)
        }

        const rollerParts = {
            g0: {
                w: rollSize, d: rollSize, h: height,
                x: 0, y: 0, z: 0,
                m: k.m,
                s: rollSize,
                roll: 1
            },
            g3: {
                w: rollSize, d: rollSize, h: height,
                x: (Number(k.w) || 0) - rollSize, y: 0, z: 0,
                m: k.m,
                s: rollSize,
                roll: 1
            },
            g4: {
                w: rollSize, d: rollSize, h: height,
                x: 0, y: (Number(k.d) || 0) - rollSize, z: 0,
                m: k.m,
                s: rollSize,
                roll: 1
            },
            g7: {
                w: rollSize, d: rollSize, h: height,
                x: (Number(k.w) || 0) - rollSize,
                y: (Number(k.d) || 0) - rollSize,
                z: 0,
                m: k.m,
                s: rollSize,
                roll: 1
            }
        }

        for (const part of rollers) {
            k[part] = rollerParts[part]
        }
    }

    applyLegSpec(k) {
        const token = [...(k.lbs || [])]
            .reverse()
            .find(item => /^leg[=:]/i.test(String(item || "")));
        if (!token) return;

        const raw = String(token).split(/[=:]/).slice(1).join("=").trim();
        const [heightRaw, countRaw = "4"] = raw.split(",").map(value => value.trim());
        const height = Number(heightRaw);
        const count = Number(countRaw);

        if (!Number.isFinite(height) || height <= 0) return;
        this.handleLegs(k, height, count === 2 ? 2 : 4);
    }


    


buildParts(k){

  const W = Number(k.w) || 0;
  const D = Number(k.d) || 0;
  const H = Number(k.h) || 0;
  const baseZ = Number(k.leg) > 0 ? Number(k.leg) : 0;
  const rel = v => !v ? 0 : Number(v);
  const explodeX = Math.max(0, rel(k.xx));
  const explodeY = Math.max(0, rel(k.xy));
  const explodeZ = Math.max(0, rel(k.xz));

  let order = (k.p || "").split("");
  if (k.jj?.includes("gg") && !order.includes("gg")) order.push("gg");
  const inside = {
    l: rel(k.ul),
    r: rel(k.ur),
    f: rel(k.uf),
    b: rel(k.ub),
    g: rel(k.ug),
    t: rel(k.ut)
  };

  const thickAxis = {
    l:"w", r:"w", v:"w",
    g:"h", t:"h", c:"h",
    b:"d", f:"d", a:"d"
  };
  const verticalRuns = [];
  const shelfRuns = [];

  const addInlineDrawers = () => {
    if (k.ski == null) return;

    const args = Array.isArray(k.ski)
      ? k.ski
      : String(k.ski).split(",").map(v => v.trim()).filter(Boolean);
    const count = Math.max(1, Math.round(Number(args[0] || 1)));
    const drawerH = Math.max(0.1, Number(args[1] || 14));
    const matIndex = Number(args[2] || 3);
    const mat = this.getMaterial(matIndex);
    const S = Number(mat?.s || k.s || 1.9);

    const innerL = inside.l;
    const innerR = inside.r;
    const innerF = inside.f;
    const innerB = inside.b;
    const innerG = inside.g;
    const innerW = Math.max(0.1, W - innerL - innerR);
    const innerD = Math.max(0.1, D - innerF - innerB);
    const frontD = S;
    const sideD = Math.max(0.1, innerD - frontD);
    const bodyY = innerF + frontD;

    const addPart = (name, values) => {
      const part = k[name] || {};
      Object.assign(part, {
        nme: name,
        x: 0,
        y: 0,
        z: 0,
        dz: 0,
        s: S,
        co: mat?.co || k.co,
        ox: 0,
        oy: 0,
        oz: 0,
        u: [0, 0, 0, 0],
        m: matIndex,
        mkante: 0,
        nx: [1, 0],
        ny: [1, 0],
        nz: [1, 0],
        eu: 0,
        eus: {},
        n: 1
      }, values);
      k[name] = part;
      if (!k.jj.includes(name)) k.jj.push(name);
    };

    for (let i = 0; i < count; i++) {
      const n = i + 1;
      const z = innerG + i * drawerH;
      const prefix = `sk${n}`;

      addPart(prefix + "l", {
        w: S, d: sideD, h: drawerH,
        x: innerL, y: bodyY, z
      });
      addPart(prefix + "r", {
        w: S, d: sideD, h: drawerH,
        x: innerL + innerW - S, y: bodyY, z
      });
      addPart(prefix + "f", {
        w: innerW, d: frontD, h: drawerH,
        x: innerL, y: innerF, z
      });
      addPart(prefix + "b", {
        w: innerW, d: S, h: drawerH,
        x: innerL, y: bodyY + sideD - S, z
      });
      addPart(prefix + "g", {
        w: innerW, d: sideD, h: S,
        x: innerL, y: bodyY, z
      });
    }
  };

  function cloneShelfParts(){
    if (!order.includes("c")) return;

    let shelfCount = Math.floor(H / 33);

// 🔥 User Override
if (k.c && k.c.n != null) {
  shelfCount = Number(k.c.n);
}
    if (shelfCount <= 1) return;

    for (let i = 1; i < shelfCount; i++) {
      const name = "c" + i;

      if (!k[name]) k[name] = structuredClone(k.c || {});
      k[name].nme = name;

      if (!order.includes(name)) order.push(name);
      if (!k.jj.includes(name)) k.jj.push(name);
    }
  }

  cloneShelfParts();

  for (const p of order){

    const basePart = p[0];       // c1 → c
    const o = k[p];
    if (!o) continue;

    o.m = o.m ?? k.m;
    o.s = Number(o.s ?? k.s ?? 0);
    const S = o.s;

    if (p === "gg") {
      Object.assign(o, {
        w: W,
        d: S,
        h: rel(k.ug),
        x: 0,
        y: 0,
        z: 0
      });
      continue;
    }

    let w = W - inside.l - inside.r;
    let d = D - inside.f - inside.b;
    let h = H - inside.g - inside.t;

    let x = inside.l;
    let y = inside.f;
    let z = baseZ + inside.g;

    if (basePart === "r") x = W - inside.r - S;
    if (basePart === "v") x = W / 2 - S / 2;
    if (basePart === "b") y = D - inside.b - S;
    if (basePart === "t") z = baseZ + H - inside.t - S;

    const ul = rel(o.ul), ur = rel(o.ur);
    const uf = rel(o.uf), ub = rel(o.ub);
    const ug = rel(o.ug), ut = rel(o.ut);

    w -= ul + ur;
    d -= uf + ub;
    h -= ug + ut;

    x += ul;
    y += uf;
    z += ug;

    if (thickAxis[basePart] === "w") w = S;
    if (thickAxis[basePart] === "d") d = S;
    if (thickAxis[basePart] === "h") h = S;
    if (basePart === "v") x = W / 2 - w / 2 + ul;

    if (basePart === "c") {
      const shelves = order.filter(x => x[0] === "c");
      const idx = shelves.indexOf(p);
      const count = shelves.length;

      z = baseZ + inside.g + ((idx + 1) * ((H - inside.g - inside.t) / (count + 1))) - S / 2 + rel(o.ug);
      h = S;

      const cut = verticalRuns[verticalRuns.length - 1];
      if (cut) {
        w = Math.max(0, cut.x - x);
      }
    }

    if (basePart === "v") {
      const cut = shelfRuns[shelfRuns.length - 1];
      if (cut) {
        h = Math.max(0, cut.z - z);
      }
    }

    if (basePart === "l") x -= explodeX;
    if (basePart === "r") x += explodeX;
    if (basePart === "f") y -= explodeY;
    if (basePart === "b") y += explodeY;
    if (basePart === "g") z -= explodeZ;
    if (basePart === "t") z += explodeZ;

    Object.assign(o, { w, d, h, x, y, z });

    if (basePart === "v") verticalRuns.push({ x: o.x, w: o.w });
    if (basePart === "c") shelfRuns.push({ z: o.z, h: o.h });

    if (basePart === "l") inside.l += S;
    if (basePart === "r") inside.r += S;
    if (basePart === "f") inside.f += S;
    if (basePart === "b") inside.b += S;
    if (basePart === "g") inside.g += S;
    if (basePart === "t") inside.t += S;
  }

  addInlineDrawers();
}

applyPartOrderIntersections(k) {
  const order = (k.p || "")
    .split("")
    .filter(part => k[part]);

  const verticalRuns = [];
  const shelfRuns = [];

  for (const p of order) {
    const basePart = p[0];
    const o = k[p];
    if (!o) continue;

    if (basePart === "c") {
      const cut = verticalRuns[verticalRuns.length - 1];
      if (cut) {
        o.w = Math.max(0, Number(cut.x || 0) - Number(o.x || 0));
      }
    }

    if (basePart === "v") {
      const cut = shelfRuns[shelfRuns.length - 1];
      if (cut) {
        o.h = Math.max(0, Number(cut.z || 0) - Number(o.z || 0));
      }
    }

    if (basePart === "v") verticalRuns.push({ x: o.x, w: o.w });
    if (basePart === "c") shelfRuns.push({ z: o.z, h: o.h });
  }
}

prepareInteriorLayoutParts(k) {
  if (k.layout == null && k.cols == null) return;
  k.p = String(k.p || "").replace(/[cv]/g, "");
  k.j = k.p;
}

applyInteriorLayout(k) {
  const specText = String(k.layout ?? k.cols ?? "").trim();
  if (!specText) return;

  const matIndex = Number(k.v?.m ?? k.c?.m ?? k.m ?? 1);
  const mat = this.getMaterial(matIndex);
  const defaultS = Number(mat?.s ?? k.s ?? 1.9);
  const vS = Number(k.v?.s ?? defaultS);
  const cS = Number(k.c?.s ?? defaultS);

  const leftX = Number(k.l?.x ?? 0) + Number(k.l?.w ?? 0);
  const rightX = Number(k.r?.x ?? k.w ?? 0);
  const bottomZ = Number(k.g?.z ?? 0) + Number(k.g?.h ?? 0);
  const topZ = Number(k.t?.z ?? k.h ?? 0);
  const frontY = Number(k.g?.y ?? k.c?.y ?? k.v?.y ?? 0);
  const innerD = Number(k.c?.d ?? k.v?.d ?? k.g?.d ?? k.d ?? 0);
  const innerW = Math.max(0, rightX - leftX);
  const innerH = Math.max(0, topZ - bottomZ);

  const parts = specText
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length || innerW <= 0 || innerH <= 0) return;

  let columns = parts.map(part => {
    const [widthRaw = "", shelvesRaw = "1"] = part.split(":").map(value => value.trim());
    return {
      widthRaw,
      compartments: Math.max(1, Math.round(Number(shelvesRaw || 1) || 1))
    };
  });

  if (columns.length === 1 && /^\d+$/.test(columns[0].widthRaw)) {
    const count = Math.max(1, Math.round(Number(columns[0].widthRaw)));
    const compartments = columns[0].compartments;
    columns = Array.from({ length: count }, () => ({
      widthRaw: "1rest",
      compartments
    }));
  }

  const verticalCount = Math.max(0, columns.length - 1);
  const fixedWidth = columns.reduce((sum, column) => {
    const value = Number(column.widthRaw);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const restWeight = columns.reduce((sum, column) => {
    const match = String(column.widthRaw).match(/^(\d+(?:\.\d+)?)?rest$/i);
    return sum + (match ? Number(match[1] || 1) : 0);
  }, 0);
  const restWidth = Math.max(0, innerW - fixedWidth - verticalCount * vS);

  columns = columns.map(column => {
    const match = String(column.widthRaw).match(/^(\d+(?:\.\d+)?)?rest$/i);
    const fixed = Number(column.widthRaw);
    const width = match
      ? (restWeight ? restWidth * Number(match[1] || 1) / restWeight : 0)
      : (Number.isFinite(fixed) ? fixed : 0);
    return {
      ...column,
      width: Math.max(0, width)
    };
  });

  const makePart = (name, base, values) => {
    const source = structuredClone(base || {});
    const part = Object.assign({
      nme: name,
      x: 0,
      y: frontY,
      z: 0,
      d: innerD,
      s: values.h ?? defaultS,
      co: mat?.co || k.co,
      ox: 0,
      oy: 0,
      oz: 0,
      u: [0, 0, 0, 0],
      m: matIndex,
      mkante: 0,
      nx: [1, 0],
      ny: [1, 0],
      nz: [1, 0],
      eu: 0,
      eus: {},
      n: 1
    }, source, values, { nme: name });

    k[name] = part;
    if (!k.jj.includes(name)) k.jj.push(name);
    return part;
  };

  let x = leftX;
  columns.forEach((column, columnIndex) => {
    const columnName = columnIndex + 1;

    if (columnIndex > 0) {
      makePart(`v${columnName - 1}`, k.v, {
        w: vS,
        d: innerD,
        h: innerH,
        x: x,
        y: frontY,
        z: bottomZ,
        s: vS
      });
      x += vS;
    }

    const shelfCount = Math.max(0, column.compartments - 1);
    for (let shelfIndex = 1; shelfIndex <= shelfCount; shelfIndex++) {
      makePart(`c${columnName}_${shelfIndex}`, k.c, {
        w: column.width,
        d: innerD,
        h: cS,
        x,
        y: frontY,
        z: bottomZ + shelfIndex * (innerH / column.compartments) - cS / 2,
        s: cS
      });
    }

    x += column.width;
  });
}


    getCabinet(k, pp, s) {
        let m = this.lm
        let aug = k?.ug ?? 0;
        let leg = k?.leg ?? 0;
        let legCount = k?.legCount ?? (leg > 0 ? 4 : 0);
        let isRoller = Number(k?.roll ?? 0) > 0;
        let supportSize = isRoller ? 5 : 4;

        let base = leg > 0 ? leg : aug;
        aug = base
        let aut = k?.ut ?? 0;
        let aul = k?.ul ?? 0;
        let aur = k?.ur ?? 0;
        let by = k?.b?.y ?? 0;
        let fs = k?.f?.s ?? 0;
        let cs = k?.c?.s ?? 0;
        let bs = k?.b?.s ?? 0;
        let ls = k?.l?.s ?? 0;
        let rs = k?.r?.s ?? 0;
        let gs = k?.g?.s ?? 0;
        let vs = this.resolveInputValue(k, k?.v?.s ?? 0);
        let gz = k?.g?.z + base ?? 0;

        let guf = k.g.uf ? k.g.uf : 0;
        k.nam = "fff"
        let ts = k?.t?.s ?? 0;
        var p = {
            l: {
                w: s,
                d: k.d - bs - fs,
                h: Number(k.h - ts - gs),
                x: Number(-k.xx) + aul,
                y: Number(fs),
                z: gs + aug,
                s: ls
            },
            // passleiste links
            ll: {
                w: aul,
                d: m[1].s,
                h: k.h,
                x: 0,
                y: 1,
                z: aug,
                s: ls
            },
            r: {
                w: s,
                d: Number(k.d - bs - fs),
                h: Number(k.h - ts - gs),
                x: Number(aul + k.w - rs + k.xx),
                y: Number(fs),
                z: gs + aug,
                s: rs
            },
            // passleiste rechts
            rr: {
                w: aur,
                d: m[1].s,
                h: k.h,
                x: aul + k.w,
                y: 1,
                z: aug,
                s: rs
            },
            g: {
                w: k.w - ls - rs,
                d: k.d - fs - bs - gub - guf,
                h: gs,
                x: aul + ls,
                y: fs+guf,
                z: gz - k.xz,
                s: gs
            },
            // passleiste unten
            gg: leg > 0 ? null : {
                w: aul + k.w + aur,
                d: 1.9,
                h: aug,
                x: 0,
                y: 1,
                z: 0,
                s: 1.9
            },

            g0: leg > 0 && legCount >= 2 ? {
                w: supportSize,
                d: supportSize,
                h: leg,
                x: 0,
                y: 0,
                z: 0,
                s: supportSize,
                roll: isRoller ? 1 : 0
            } : null,

            g3: leg > 0 && legCount >= 2 ? {
                w: supportSize,
                d: supportSize,
                h: leg,
                x: aul + k.w + aur - supportSize,
                y: 0,
                z: 0,
                s: supportSize,
                roll: isRoller ? 1 : 0
            } : null,

            g4: leg > 0 && legCount >= 4 ? {
                w: supportSize,
                d: supportSize,
                h: leg,
                x: 0,
                y: k.d - supportSize,
                z: 0,
                s: supportSize,
                roll: isRoller ? 1 : 0
            } : null,

            g7: leg > 0 && legCount >= 4 ? {
                w: supportSize,
                d: supportSize,
                h: leg,
                x: aul + k.w + aur - supportSize,
                y: k.d - supportSize,
                z: 0,
                s: supportSize,
                roll: isRoller ? 1 : 0
            } : null,
            // beine unten
            gl: {
                w: aul + k.w + aur,
                d: 1.9,
                h: aug,
                x: 0,
                y: 1,
                z: 0,
                s: 1.9
            },
            t: {
                w: k.w - ls - rs,
                d: k.d - fs - bs,
                h: ts,
                x: aul + ls,
                y: fs,
                z: k.h + k.xz - ts + aug,
                s: ts
            },
            // passleiste oben
            tt: {
                w: k.w + aul + aur,
                d: m[1].s,
                h: aut,
                x: 0,
                y: 1,
                z: k.h + aug,
                s: ts
            },
            c: {
                w: k.w - ls - rs,
                d: k.d - bs - fs,
                h: cs,
                x: aul + ls,
                y: fs,
                z: (k.h / 2) + aug,
                s: cs

            },
            e: {
                w: k.w,
                d: k.d - fs - bs,
                h: cs,
                x: k.xx,
                y: fs,
                z: k.h / 2,
                s: cs

            },
            b: {
                w: k.w - ls - rs,
                d: bs,
                h: k.h - gs - ts,
                // h: (k.t.z)-(k.g.z+m[k.g.m].s),
                x: aul + ls,
                y: k.d - bs + k.xy,
                z: aug + gs,
                s: aug + bs

            },
            f: {
                w: k.w - ls - rs,
                h: k.h - gs - ts,
                x: aul + ls,
                d: fs,
                y: -k.xy,
                z: aug + gs,
                s: fs

                // it: 1,
                // ir: 1,
                // ig: 1,
                // il: 1
            },
            v: {
                w: vs || s,
                d: k.d - fs - bs,
                h: k.h - ts - gs,
                x: k.w / 2 - s / 2,
                y: fs,
                z: gs,
                s: vs || s

            },
            a: {
                w: k.w,
                d: k.d,
                h: k.s,
                x: 0,
                y: 0,
                z: k.h
            },
            // u: {
            //     w: k.w,
            //     d: k.s,
            //     h: k.ig,
            //     x: 0,
            //     y: 0,
            //     z: 0
            // }
        }

        return p[pp]
    }


	    getDist(ko, p1, p2) {
        // let f = bl.split("_")
        // let kk = f[0]
        // let kkk = f[1]
        //   let a=getByPath(kk)
        // alert(p1+p2)
        let cu = this.corners(p1)
        let np = this.corners(p2)
        // let x =Math.abs(np[0] - cu[0])
        // let y =Math.abs(np[1] - cu[1])
        // let z =Math.abs(np[2] - cu[2])

        let x = (np[0] - cu[0])
        let y = (np[1] - cu[1])
        let z = (np[2] - cu[2])
        return { x: x, y: y, z: z }

	    }

	    parsePointRef(ref, fallbackKorpus = null) {
	        const text = String(ref || "").trim();
	        if (!text) return null;

	        if (text.includes(",")) {
	            const parts = text.split(",").map(part => part.trim());
	            if (parts.length === 2 && /^\d+$/.test(parts[1])) {
	                return [
	                    parts[0] || fallbackKorpus,
	                    null,
	                    parts[1]
	                ];
	            }
	            return [
	                parts[0] || fallbackKorpus,
	                parts[1] ? normalizePartKey(parts[1]) : null,
	                parts[2] ?? "0"
	            ];
	        }

	        const parsed = this.getKorParCor([fallbackKorpus, null, "0"], text);
	        if (parsed?.[1]) parsed[1] = normalizePartKey(parsed[1]);
	        return parsed;
	    }

	    resolvePointDistanceExpression(ko, raw, axis = "x") {
	        const source = String(raw ?? "").trim();
	        if (!source.includes("_")) return null;

	        const axisIndex = { x: 0, y: 1, z: 2 }[axis] ?? 0;
	        let changed = false;
	        const resolvedPositionCache = new Map();

	        const cornerAsArray = corner => {
	            if (Array.isArray(corner)) return corner;
	            if (corner == null) return [0];
	            const text = String(corner).trim();
	            return text ? [...text].filter(ch => /\d/.test(ch)).map(Number) : [0];
	        };

	        const localCornerPoint = (obj, partName, corner) => {
	            if (!obj) return null;

	            const target = partName ? obj[partName] : obj;
	            if (!target) return null;

	            const baseX = partName ? Number(obj[partName]?.x || 0) : 0;
	            const baseY = partName ? Number(obj[partName]?.y || 0) : 0;
	            const baseZ = partName ? Number(obj[partName]?.z || 0) : 0;
	            const w = Number(target.w || 0);
	            const d = Number(target.d || 0);
	            const h = Number(target.h || 0);
	            const oz = Number(target.oz || 0) * Math.PI / 180;
	            const right = [w * Math.cos(oz), w * Math.sin(oz), 0];
	            const back = [d * Math.cos(oz + Math.PI / 2), d * Math.sin(oz + Math.PI / 2), 0];

	            const oneCorner = idx => {
	                const i = Number(idx || 0);
	                const sx = (i === 2 || i === 3 || i === 6 || i === 7) ? 1 : 0;
	                const sy = i >= 4 ? 1 : 0;
	                const sz = (i === 1 || i === 2 || i === 5 || i === 6) ? 1 : 0;
	                return [
	                    baseX + right[0] * sx + back[0] * sy,
	                    baseY + right[1] * sx + back[1] * sy,
	                    baseZ + h * sz
	                ];
	            };

	            const corners = cornerAsArray(corner).map(oneCorner);
	            return corners.reduce((sum, p) => [
	                sum[0] + p[0],
	                sum[1] + p[1],
	                sum[2] + p[2]
	            ], [0, 0, 0]).map(v => v / corners.length);
	        };

	        const resolveBasePosition = name => {
	            if (!name) return null;
	            if (resolvedPositionCache.has(name)) return resolvedPositionCache.get(name);

	            const obj = name === ko?.nme ? ko : this.oks[name];
	            if (!obj) return null;

	            resolvedPositionCache.set(name, [Number(obj.x || 0), Number(obj.y || 0), Number(obj.z || 0)]);

	            const tar = Array.isArray(obj.tar) ? obj.tar : [];
	            if (!tar[0]) return resolvedPositionCache.get(name);

	            const cur = Array.isArray(obj.cur) ? obj.cur : [obj.nme, null, "0"];
	            const targetCorner = resolveWorldCorner([tar[0], tar[1] ?? null, tar[2] ?? "3"]);
	            const curLocal = localCornerPoint(obj, cur[1] ?? null, cur[2] ?? "0");
	            if (!targetCorner || !curLocal) return resolvedPositionCache.get(name);

	            const base = [
	                targetCorner[0] - curLocal[0] + Number(obj.x || 0),
	                targetCorner[1] - curLocal[1] + Number(obj.y || 0),
	                targetCorner[2] - curLocal[2] + Number(obj.z || 0)
	            ];
	            resolvedPositionCache.set(name, base);
	            return base;
	        };

	        const resolveWorldCorner = ref => {
	            const obj = ref?.[0] === ko?.nme ? ko : this.oks[ref?.[0]];
	            const base = resolveBasePosition(ref?.[0]);
	            const local = localCornerPoint(obj, ref?.[1] ?? null, ref?.[2] ?? "0");
	            if (!base || !local) return null;

	            return [
	                base[0] + local[0],
	                base[1] + local[1],
	                base[2] + local[2]
	            ];
	        };

	        const replaced = source.replace(/\(([^()]*_[^()]*)\)/g, (match, spec) => {
	            const refs = String(spec).split("_").map(s => s.trim()).filter(Boolean);
	            if (refs.length < 2) return match;

	            const p1 = this.parsePointRef(refs[0], ko?.nme);
	            const p2 = this.parsePointRef(refs[1], p1?.[0] || ko?.nme);
	            if (!p1 || !p2) return match;

	            const a = resolveWorldCorner(p1);
	            const b = resolveWorldCorner(p2);
	            if (!a || !b) return match;

	            const value = Math.abs(Number(b[axisIndex]) - Number(a[axisIndex]));
	            if (!Number.isFinite(value)) return match;

	            changed = true;
	            return String(this.roundExprNumber(value));
	        });

	        if (!changed || !/^[0-9+\-*/().\s]+$/.test(replaced)) return null;

	        try {
	            const value = Function('"use strict"; return (' + replaced + ')')();
	            return Number.isFinite(value) ? this.roundExprNumber(value) : null;
	        } catch {
	            return null;
	        }
	    }

	    resolveDeferredDistanceExpressions() {
	        const dimAxis = {
	            w: "x", x: "x",
	            d: "y", y: "y",
	            h: "z", z: "z"
	        };
	        const hasDistanceExpr = value => /\([^()]*_[^()]*\)/.test(String(value || ""));

	        for (let pass = 0; pass < 3; pass++) {
	            let changed = false;
	            const names = [...Object.keys(this.oks)];

	            for (const name of names) {
	                const k = this.oks[name];
	                if (!k?.lbs?.length) continue;

	                let needsRebuild = false;
	                let fitChanged = false;

	                for (const token of k.lbs.slice(1)) {
	                    const m = String(token || "").match(/^([^=:]+)[=:](.+)$/);
	                    if (!m) continue;

	                    const path = m[1].trim().split(".");
	                    const key = path[path.length - 1];
	                    if (path.length === 1 && key === "fit") {
	                        if (this.applyFitSpec(k, m[2])) {
	                            needsRebuild = true;
	                            fitChanged = true;
	                            changed = true;
	                        }
	                        continue;
	                    }

	                    if (!hasDistanceExpr(m[2])) continue;

	                    const axis = dimAxis[key];
	                    if (!axis) continue;

	                    const value = this.resolvePointDistanceExpression(k, m[2], axis);
	                    if (!Number.isFinite(value)) continue;

	                    const target = path.slice(0, -1).reduce((obj, part) => obj?.[part], k) || k;
	                    if (!target || Number(target[key]) === value) continue;

	                    target[key] = value;
	                    needsRebuild = true;
	                    changed = true;
	                }

	                if (!needsRebuild) continue;

	                const savedI = clonePlainValue(k.i);
	                const savedCur = clonePlainValue(k.cur);
	                const savedTar = clonePlainValue(k.tar);
	                const savedParent = k.parent;
	                const previousLastKo = this.lastko;

	                this.lastko = savedTar?.[0] || savedI?.[2] || "";
	                const rebuilt = this.new__Korp(k.lbs.join(" "));
	                rebuilt.comment = k.comment || rebuilt.comment || "";
	                if (!fitChanged) {
	                    rebuilt.i = savedI;
	                    rebuilt.cur = savedCur;
	                    rebuilt.tar = savedTar;
	                }
	                rebuilt.parent = savedParent;
	                this.oks[name] = rebuilt;
	                this.lastko = previousLastKo;
	            }

	            if (!changed) break;
	        }
	    }

	    applyFitSpec(ko, spec) {
	        const refs = String(spec || "").split("_").map(s => s.trim()).filter(Boolean);
	        if (refs.length < 2) return false;

	        const p1 = this.parsePointRef(refs[0], ko?.nme);
	        const p2 = this.parsePointRef(refs[1], p1?.[0] || ko?.nme);
	        if (!p1 || !p2) return false;
	        const hasPoint = ref => {
	            const obj = ref?.[0] === ko?.nme ? ko : this.oks[ref?.[0]];
	            if (!obj) return false;
	            return !ref?.[1] || Boolean(obj[ref[1]]);
	        };
	        if (!hasPoint(p1) || !hasPoint(p2)) return false;

	        const distanceExpr = `(${refs[0]}_${refs[1]})`;
	        let w = this.resolvePointDistanceExpression(ko, distanceExpr, "x");
	        let d = this.resolvePointDistanceExpression(ko, distanceExpr, "y");
	        let h = this.resolvePointDistanceExpression(ko, distanceExpr, "z");

	        if (![w, d, h].every(Number.isFinite)) {
	            const a = this.corners(p1);
	            const b = this.corners(p2);
	            if (!a || !b) return false;

	            w = Math.abs(Number(b[0]) - Number(a[0]));
	            d = Math.abs(Number(b[1]) - Number(a[1]));
	            h = Math.abs(Number(b[2]) - Number(a[2]));
	        }
	        const before = JSON.stringify({
	            w: ko.w,
	            d: ko.d,
	            h: ko.h,
	            cur: ko.cur,
	            tar: ko.tar,
	            i: ko.i
	        });

	        if (Number.isFinite(w)) ko.w = w;
	        if (Number.isFinite(d)) ko.d = d;
	        if (Number.isFinite(h)) ko.h = h;

	        ko.tar = [p1[0], p1[1] ?? null, String(p1[2] ?? "0")];
	        ko.cur = [ko.nme, null, "0"];
	        this.syncIFromConnection(ko, "tar");
	        this.syncConnectionFromI(ko);
	        return before !== JSON.stringify({
	            w: ko.w,
	            d: ko.d,
	            h: ko.h,
	            cur: ko.cur,
	            tar: ko.tar,
	            i: ko.i
	        });
	    }

	    getKorParCor1(def, aa = null) {
        if (!aa) {
            aa = ["a", null, "b"].filter(v => v != null).join("");

        }
        if (/^[0-9]$/.test(aa)) {  // 2
            def[2] = Number(aa)
        } else if (/^[a-z]$/.test(aa)) {  // a
            def[0] = aa
        } else if (/^[a-z][0-9]$/.test(aa)) {  // a3
            def[0] = aa[0]
            def[2] = Number(aa[1])
        } else if (/[a-z][a-z][0-9]/.test(aa)) {  // ag2
            def[0] = aa[0]
            def[1] = aa[1]
            def[2] = Number(aa[2])
        }
        def[2] = this.trailingDigitsToArray(aa)
        return def
    }



    getKorParCor0(def, aa = null) {
        if (!aa) {
            aa = ["a", null, "b"].filter(v => v != null).join("");

        }
        if (/^[0-9]$/.test(aa)) {  // 2
            def[2] = Number(aa)
        } else if (/^[a-z]$/.test(aa)) {  // a
            def[0] = aa
        } else if (/^[a-z][0-9]$/.test(aa)) {  // a3
            def[0] = aa[0]
            def[2] = Number(aa[1])
        } else if (/[a-z][a-z][0-9]/.test(aa)) {  // ag2
            def[0] = aa[0]
            def[1] = aa[1]
            def[2] = Number(aa[2])
        }
        def[2] = this.trailingDigitsToArray(aa)
        return def
    }


    getKorParCor(def, aa = null) {

    if (!aa) return def;

    aa = String(aa).trim();

    let kor = null;
    let part = null;
    let cor = null;

    function parseCorner(str) {
        if (!str) return null;

        // nur Ziffern erlaubt
        if (!/^\d+$/.test(str)) return null;

        // jede Ziffer in Zahl wandeln
        return [...str].map(d => Number(d));
    }

    // -------------------------------------------------
    // 0) Nur Zahl → Corner direkt
    // -------------------------------------------------
    if (/^\d+$/.test(aa)) {
        def[2] = parseCorner(aa);
        return def;
    }

    // -------------------------------------------------
    // 1) Punkt-Notation
    // -------------------------------------------------
    if (aa.includes(".")) {

        const parts = aa.split(".");
        kor = parts[0];

        const rest = parts[1] || "";
        const match = rest.match(/^([a-z])?(\d+)?$/);

        if (match) {
            part = match[1] || null;
            cor = parseCorner(match[2]);
        }
    }

    // -------------------------------------------------
    // 2) Kein Punkt
    // -------------------------------------------------
    else {

        const match = aa.match(/^([a-z])([a-z])?(\d+)?$/);

        if (match) {
            kor = match[1];
            part = match[2] || null;
            cor = parseCorner(match[3]);
        }
    }

    if (kor !== null) def[0] = kor;
    if (part !== null) def[1] = part;
    if (cor !== null) def[2] = cor;

    return def;
}

    trailingDigitsToArray(str) {
        const m = str.match(/\d+$/);
        if (!m) return null;

        const digits = m[0].split('').map(n => Number(n));
        return digits.length === 1 ? digits[0] : digits;
    }



    

    



    localCorner(bb, idx) {

        return {
            x: (idx & 1) ? bb.max.x : bb.min.x,
            y: (idx & 2) ? bb.max.y : bb.min.y,
            z: (idx & 4) ? bb.max.z : bb.min.z
        };
    }

    corners(s) {
        // alert("s: "+s)
        let ob, pa, corner, obj
        var x, y, z

        ob = this.oks[s[0]]
        pa = s[1]
        corner = Number(s[2])
        if (pa) {

            obj = ob[pa]
            x = obj.x + ob.x
            y = obj.y + ob.y
            z = obj.z + ob.z
        } else {
            obj = ob
            x = obj.x
            y = obj.y
            z = obj.z
        }

        let oz = obj?.oz ?? 0;

        let a = oz * Math.PI / 180
        let c = 90 * Math.PI / 180
        var b = Math.atan(obj.d / obj.w)
        var dia = obj.w / Math.cos(b)
        let isp




        var cs = [
            // 0
            [x,
                y,
                z
            ],  // np
            // 1
            [
                x,
                y,
                z + obj.h
            ],  // left top
            // 2
            [
                x + obj.w * Math.cos(a),
                y + obj.w * Math.sin(a),
                z + obj.h
            ],  // right top
            // 3
            [
                x + obj.w * Math.cos(a),
                y + obj.w * Math.sin(a),
                z
            ],  // right bottom
            // 4
            [
                x + obj.d * Math.cos(a + c),
                y + obj.d * Math.sin(a + c),
                z],  // bac bott left bottom

            // 5
            [
                x + obj.d * Math.cos(a + c),
                y + obj.d * Math.sin(a + c),
                z + obj.h],  // bac bott left bottom

            // 6
            [
                x + (dia) * Math.cos(a + b),
                y + (dia) * Math.sin(a + b),
                z + obj.h],  // bac bott left bottom
            //  7
            [
                x + (dia) * Math.cos(a + b),
                y + (dia) * Math.sin(a + b),
                z],  // bac bott left bottom

        ]
        let re = cs[Number(corner)]
        //alert(re)

        return re
    }



    summeEinerStruktur(obj, feldnamen) {
        const sum = {};
        for (const feld of feldnamen) {
            sum[feld] = 0;
        }

        // Ebene 1
        for (const feld of feldnamen) {
            if (obj?.[feld] != null) {
                sum[feld] += obj[feld];
            }
        }

        // Ebene 2
        for (const key in obj) {
            const sub = obj[key];
            if (typeof sub === 'object') {
                for (const feld of feldnamen) {
                    if (sub?.[feld] != null) {
                        sum[feld] += sub[feld];
                    }
                }
            }
        }

        return sum;
    }




    



 applyRelativeValue(base, expr){

    if(!expr) return base

    if(expr.startsWith("+")){
        const v = Number(expr.slice(1))
        if(Number.isFinite(v)) return base + v
    }

    if(expr.startsWith("*")){
        const v = Number(expr.slice(1))
        if(Number.isFinite(v)) return base * v
    }

    if(expr.startsWith("/")){
        const v = Number(expr.slice(1))
        if(Number.isFinite(v) && v !== 0) return base / v
    }

    return base
}


    makeParts_step2(ko) {
        var arra = []
        var logi
        var s
        if (ko.ty == "f") {  // frame modus
            for (var paart of ko.jj) {
                ko[paart].s = this.getMaterial(ko[paart].m).s
                s = ko[paart].s

                let o = this.getFrame(ko, paart, s)

                ko[paart] = Object.assign(ko[paart], o)
            }
        } else {
            for (var paart of ko.jj) {
                ko[paart].s = this.getMaterial(ko[paart].m).s
                s = ko[paart].s
                let o = this.buildParts(ko) || {}
                ko[paart] = Object.assign(ko[paart], o)
                // (dd(o))
                // ko[paart] = { ...o }
                o.nam = ko.nme + "-" + paart
                this.lpa.push(o)
            }
        }
    }

    moveSmallestToEnd(arr) {
        if (arr.length === 0) return arr;

        const min = Math.min(...arr);
        const index = arr.indexOf(min);

        // Remove the smallest element
        arr.splice(index, 1);

        // Push it to the end
        arr.push(min);

        return arr;
    }




    getFrame(k, pp, s) {
        let m = this.lm
        let fs = k?.f?.s ?? 5;
        let cs = k?.c?.s ?? 5;
        let cn = k?.c?.n ?? 0;
        // (cn)
        let bs = k?.b?.s ?? 5;
        let ls = k?.l?.s ?? 5;
        let rs = k?.r?.s ?? 5;
        let gs = k?.g?.s ?? 5;
        let gz = k?.g?.z ?? 5;
        let ts = k?.t?.s ?? 5;
        var p = {
            l: {
                d: s,
                w: k.d,
                h: Number(k.h - ts - gs),
                x: Number(-k.xx),
                y: Number(fs),
                z: Number(gs),
                s: ls
            },
            r: {
                d: s,
                w: k.d,
                h: Number(k.h - ts - gs),
                x: Number(k.w - k.d + k.xx),
                y: Number(fs),
                z: gs,
                s: rs
            },
            g: {
                w: k.w - k.d * 2,
                d: s,
                h: k.d,
                x: k.d,
                y: fs,
                z: gz - k.xz,
                s: gs
            },
            t: {
                w: k.w - k.d * 2,
                d: s,
                h: k.d,
                x: k.d,
                y: fs,
                z: k.h + k.xz - k.d,
                s: ts

            },
            c: {
                w: k.w - k.d * 2,
                d: s,
                h: k.d,
                x: k.d,
                y: fs,
                z: k.h / 2 - k.d / 2,
                s: cs

            },
            e: {
                w: k.w,
                d: k.d - fs - bs,
                h: cs,
                x: k.xx,
                y: fs,
                z: k.h / 2,
                s: cs

            },
            b: {
                w: k.w - ls - rs,
                d: bs,
                h: k.h - gs - ts - gz,
                // h: (k.t.z)-(k.g.z+m[k.g.m].s),
                x: ls,
                y: k.d - bs + k.xy,
                z: gs + gz,
                s: bs

            },
            f: {
                w: k.w - k.d * 2,
                h: k.h - 2 * k.d,
                x: k.d,
                d: fs,
                y: 0,
                z: k.d,
                s: fs

                // it: 1,
                // ir: 1,
                // ig: 1,
                // il: 1
            },
            // v: {
            //     w: m[k.v.m].s,
            //     d: k.d - fs - bs,
            //     h: k.h - ts - gs,
            //     x: k.w / 2 - m[k.v.m].s / 2,
            //     y: fs,
            //     z: gs,
            //     s: m[k.v.m].s

            // },
            a: {
                w: k.w,
                d: k.d,
                h: k.s,
                x: 0,
                y: 0,
                z: k.h
            },
            // u: {
            //     w: k.w,
            //     d: k.s,
            //     h: k.ig,
            //     x: 0,
            //     y: 0,
            //     z: 0
            // }
        }

        return p[pp]
    }





    addToParent(ko) {
        if (/[\.]/.test(ko.nme)) {
            var paren = ko.nme.split(".")[0]
            var chil = ko.nme.split(".")[1]

            for (let kk in ko.pats) {
                // copy korpus to parent
                // if (paren == kk) {
                ko[kk].z += ko.zz
                this.oks[paren][chil + kk] = ko[kk]
                // (dd(this.oks[paren]["pats"]))
                // }
            }
        }

        return ko
    }


    trimInput(ko) {
        ko = ko.trim()
        ko = ko.replace("  ", " ")
        return ko
    }

	createPartSplitMatrix(ko, ob) {
	    if (!ko || !ob) return false;

	    const axes = [
	        { axis: "x", dim: "w", key: "sx" },
	        { axis: "y", dim: "d", key: "sy" },
	        { axis: "z", dim: "h", key: "sz" }
	    ];
	    const spreadAxisByPart = {
	        l: "x", r: "x", v: "x",
	        f: "y", b: "y", a: "y",
	        g: "z", t: "z", c: "z"
	    };
	    const basePart = String(ob.nme || "").charAt(0).toLowerCase();

	    const active = axes
	        .map(spec => {
	            const split = Array.isArray(ob[spec.key])
	                ? ob[spec.key]
	                : (ob[spec.key] != null ? [ob[spec.key]] : null);
	            if (!split) return null;
	            const countRaw = String(split?.[0] ?? 1).trim().replace(/s$/i, "");
	            const countNum = Number(countRaw);
	            const count = Math.max(1, Math.round(Number.isFinite(countNum) ? countNum : 1));
	            const spreadRaw = String(split?.[1] ?? "").trim();
	            const spreadMode = split.length < 2 || /s$/i.test(spreadRaw);
	            const isThicknessSpread = spreadMode && spec.axis === spreadAxisByPart[basePart];
	            let start = isThicknessSpread ? 0 : Number(ob?.[spec.axis] || 0);
	            const fullDim = Number((isThicknessSpread ? ko?.[spec.dim] : ob[spec.dim]) || 0);
	            if (count <= 1 || !Number.isFinite(fullDim) || fullDim <= 0) return null;

	            const spreadValue = Number(spreadRaw.replace(/s$/i, ""));
	            const gapValue = Number.isFinite(spreadValue) ? spreadValue : 0;
	            const partDim = isThicknessSpread
	                ? (Number.isFinite(spreadValue) && spreadValue > 0 ? spreadValue : Number(ob[spec.dim] || 0))
	                : (fullDim - gapValue * (count - 1)) / count;
	            let gap = isThicknessSpread
	                ? Math.max(0, count > 1 ? (fullDim - partDim * count) / (count - 1) : 0)
	                : gapValue;
	            if (isThicknessSpread) {
	                gap = Math.max(0, (fullDim - partDim * count) / (count + 1));
	                start = gap;
	            }
	            if (!Number.isFinite(partDim) || partDim <= 0) return null;
	            if (!Number.isFinite(gap)) return null;

	            return {
	                ...spec,
	                count,
	                gap,
	                partDim,
	                start
	            };
	        })
	        .filter(Boolean);

	    if (!active.length) return false;

	    const base = structuredClone(ob);
	    const baseName = ob.nme;

	    for (const spec of active) {
	        ob[spec.dim] = spec.partDim;
	        ob[spec.axis] = spec.start;
	    }

	    const resetSplitSpec = part => {
	        for (const spec of axes) {
	            part[spec.key] = [1, 0];
	        }
	    };

	    resetSplitSpec(ob);

	    const walk = (axisIndex, indices) => {
	        if (axisIndex >= active.length) {
	            if (indices.every(i => i === 0)) return;

	            const clone = structuredClone(base);
	            const suffix = active
	                .map((spec, i) => indices[i] ? `${indices[i]}${spec.axis}` : "")
	                .join("");

	            clone.nme = baseName + suffix;

	            for (let i = 0; i < active.length; i++) {
	                const spec = active[i];
	                const idx = indices[i];
	                clone[spec.dim] = spec.partDim;
	                clone[spec.axis] = spec.start + idx * (spec.partDim + spec.gap);
	            }

	            resetSplitSpec(clone);
	            clone.nx = [1, 0];
	            clone.ny = [1, 0];
	            clone.nz = [1, 0];

	            ko[clone.nme] = clone;
	            if (!ko.jj.includes(clone.nme)) ko.jj.push(clone.nme);
	            return;
	        }

	        const spec = active[axisIndex];
	        for (let i = 0; i < spec.count; i++) {
	            walk(axisIndex + 1, [...indices, i]);
	        }
	    };

	    walk(0, []);
	    return true;
	}

	expandPartValueSequences(ko) {
	    if (!ko?.jj) return;

	    const axisByDim = { w: "x", d: "y", h: "z" };
	    const dimByAxis = { x: "w", y: "d", z: "h" };
	    const partNames = [...ko.jj];

	    const parseSegmentList = (values, fullDim) => {
	        const slash = String(values[0] ?? "").match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
	        if (slash) {
	            const count = Math.max(1, Math.round(Number(slash[1])));
	            const gapEntry = values.slice(1).map(value => String(value)).find(value => /^g-?\d|^-?\d+(?:\.\d+)?g$/i.test(value));
	            const gap = gapEntry ? Math.abs(Number(gapEntry.replace(/^g/i, "").replace(/g$/i, ""))) : 0;
	            const denominator = Number(slash[2]);
	            const size = denominator > 0 ? Number(fullDim || 0) / denominator : 0;
	            return Array.from({ length: count }, (_, index) => ({
	                value: size,
	                offset: index * (size + gap)
	            })).filter(segment => Number.isFinite(segment.value) && segment.value > 0);
	        }

	        const entries = values.map((value, index) => {
	            const text = stripValueAnnotation(value);
	            if (/^g-?\d+(?:\.\d+)?$/i.test(text) || /^-?\d+(?:\.\d+)?g$/i.test(text)) {
	                return { type: "globalGap", value: Math.abs(Number(text.replace(/^g/i, "").replace(/g$/i, ""))) };
	            }
	            if (typeof value === "string" && /rest$/i.test(value)) {
	                const weight = Number(String(value).replace(/rest$/i, ""));
	                return { type: "rest", weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
	            }
	            const n = Number(text);
	            if (!Number.isFinite(n)) return null;
	            if (n < 0) return { type: "gap", value: Math.abs(n) };
	            if (index === values.length - 1 && n === 1) return { type: "rest", weight: 1 };
	            return { type: "segment", value: n };
	        }).filter(Boolean);
	        const globalGap = entries.find(entry => entry.type === "globalGap")?.value || 0;
	        const layoutEntries = entries.filter(entry => entry.type !== "globalGap");

	        const used = layoutEntries.reduce((sum, entry) => {
	            if (entry.type === "segment" || entry.type === "gap") return sum + entry.value;
	            return sum;
	        }, 0);
	        const segmentCount = layoutEntries.filter(entry => entry.type === "segment" || entry.type === "rest").length;
	        const restWeight = layoutEntries.reduce((sum, entry) => sum + (entry.type === "rest" ? entry.weight : 0), 0);
	        const restTotal = Math.max(0, Number(fullDim || 0) - used - globalGap * Math.max(0, segmentCount - 1));

	        const segments = [];
	        let offset = 0;
	        for (let i = 0; i < layoutEntries.length; i++) {
	            const entry = layoutEntries[i];
	            if (entry.type === "gap") {
	                offset += entry.value;
	                continue;
	            }
	            const value = entry.type === "rest" && restWeight
	                ? restTotal * entry.weight / restWeight
	                : entry.value;
	            segments.push({ value, offset });
	            offset += value;
	            if (globalGap && layoutEntries.slice(i + 1).some(next => next.type === "segment" || next.type === "rest")) {
	                offset += globalGap;
	            }
	        }

	        return segments;
	    };

	    for (const name of partNames) {
	        const base = ko[name];
	        if (!base) continue;

	        const dimKey = Array.isArray(base[base.__primarySequenceDim])
	            ? base.__primarySequenceDim
	            : ["w", "d", "h"].find(key => Array.isArray(base[key]));
	        const posKey = ["x", "y", "z"].find(key => Array.isArray(base[key]));
	        if (!dimKey && !posKey) continue;

	        const axis = dimKey ? axisByDim[dimKey] : posKey;
	        const segments = dimKey
	            ? parseSegmentList(base[dimKey], Number(base["_" + dimKey + "Full"] ?? base[dimKey]?.[0] ?? base[dimByAxis[axis]] ?? 0))
	            : base[posKey].map(value => ({ value: Number(value), offset: Number(value) })).filter(item => Number.isFinite(item.value));

	        if (!segments.length) continue;

	        const original = structuredClone(base);
	        const originalPos = Number(original[axis] || 0);
	        const sequenceValues = {};
	        for (const key of ["w", "d", "h", "x", "y", "z"]) {
	            if (Array.isArray(original[key])) sequenceValues[key] = original[key];
	        }
	        const countSequenceItems = (key, values) => {
	            if (key === dimKey) return segments.length;
	            if (
	                ["w", "d", "h"].includes(key) &&
	                dimKey &&
	                JSON.stringify(values) === JSON.stringify(sequenceValues[dimKey])
	            ) {
	                return segments.length;
	            }
	            return values.length;
	        };
	        const itemCount = Math.max(
	            segments.length,
	            ...Object.entries(sequenceValues).map(([key, values]) => countSequenceItems(key, values))
	        );

	        while (segments.length < itemCount) {
	            const prev = segments[segments.length - 1] || { value: 0, offset: 0 };
	            segments.push({ ...prev });
	        }

	        const applyIndexedValues = (target, index, segment) => {
	            for (const key of ["w", "d", "h", "x", "y", "z"]) {
	                const values = sequenceValues[key];
	                if (!values) continue;
	                if (key === dimKey) {
	                    target[key] = segment.value;
	                    continue;
	                }
	                if (
	                    ["w", "d", "h"].includes(key) &&
	                    dimKey &&
	                    JSON.stringify(values) === JSON.stringify(sequenceValues[dimKey])
	                ) {
	                    target[key] = segment.value;
	                    continue;
	                }
	                const raw = values[index] ?? values[values.length - 1];
	                const n = Number(stripValueAnnotation(raw));
	                if (Number.isFinite(n)) target[key] = n;
	            }
	            if (dimKey) target[axis] = originalPos + segment.offset;
	        };

	        applyIndexedValues(base, 0, segments[0]);

	        for (let i = 1; i < itemCount; i++) {
	            const clone = structuredClone(original);
	            clone.nme = `${name}${i}${axis}`;
	            applyIndexedValues(clone, i, segments[i]);
	            clone.nx = [1, 0];
	            clone.ny = [1, 0];
	            clone.nz = [1, 0];
	            ko[clone.nme] = clone;
	            if (!ko.jj.includes(clone.nme)) ko.jj.push(clone.nme);
	        }
	    }
	}



	    
	
	    createNxyz(ko, ob, xyzpara) {

    let lastko;

    // CONNECT-ZIELE:
    // x = rechts
    // y = hinten
    // z = oben
   const corr = {
    x: { tar: 3, cur: 0 },
    y: { tar: 4, cur: 0 },
    z: { tar: 1, cur: 0 }
};

    const isPart = ob != null && ob !== ko;
    if (ob == null) ob = structuredClone(ko);

    const dimofxyz = WDHXYZ[xyzpara];

    const splitKey = "s" + xyzpara;
    const split = isPart && Array.isArray(ob[splitKey]) ? ob[splitKey] : null;
    let nnnn = split || ob["n" + xyzpara] || [10];
    const rowSpec = Array.isArray(nnnn) ? nnnn : [nnnn, 0];

    if (!split) ob["n" + xyzpara] = nnnn;

    const count = Math.max(0, Math.round(Number(rowSpec[0] || 0)));
    const rawGap = String(rowSpec[1] ?? 0).trim();
    const rasterGap = rawGap.match(/^([-+]?(?:\d+(?:\.\d+)?|\.\d+))r$/i);
    let gap = rasterGap
        ? Number(rasterGap[1]) - Number(ob[dimofxyz] || 0)
        : Number(rawGap || 0);
    if (!Number.isFinite(gap)) gap = 0;

    // If a part is repeated along an axis without an explicit gap,
    // distribute the copies evenly across the parent container dimension.
    // This makes eb.reihe.z.N fill the cabinet height and similarly
    // repeats along x behave evenly if used for e.g. middle supports.
    if (isPart && count > 1 && gap === 0 && Number.isFinite(ko[dimofxyz]) && Number.isFinite(ob[dimofxyz])) {
        const partOffset = Number(ob[xyzpara] || 0);
        const totalPartSize = Number(ob[dimofxyz]) * count;
        const availableSpace = Number(ko[dimofxyz]) - partOffset - totalPartSize;
        if (availableSpace > 0 && count > 1) {
            gap = availableSpace / (count - 1);
        }
    }

    if (split && count > 1) {
        const fullDim = Number(ob[dimofxyz] || 0);
        const splitDim = (fullDim - gap * (count - 1)) / count;
        if (Number.isFinite(splitDim) && splitDim > 0) {
            ob[dimofxyz] = splitDim;
        }
    }

    if (count > 1) {

        // Startwerte merken
        let prevW = ob.w;
        let prevD = ob.d;
        let prevH = ob.h;

        // erstes Element als Parent
        let prevName = ob.nme;
        const progressionValues = {};

        for (let j = 1; j < count; j++) {

            const nn = ob.nme + j + xyzpara;

            let kk = Object.assign({}, ob);

            // =================================================
            // PROGRESSIVE PARAMETER
            // =================================================

            for (const param of ko.nn) {

                const key = param[0];

                if (!PMETER1.includes(key)) continue;

                const val = Number(param.slice(1));
                const prev = Number(progressionValues[key] ?? ob[key]);

                if (Number.isFinite(prev) && Number.isFinite(val)) {
                    kk[key] = prev + val;
                    progressionValues[key] = kk[key];
                }
            }

            if (!isPart) {
                for (const partName of kk.jj || []) {
                    if (!kk[partName]) continue;
                    kk[partName].s = this.getMaterial(kk[partName].m).s;
                    const nextPart = this.buildParts(kk)?.[partName] || {};
                    kk[partName] = Object.assign(kk[partName], nextPart);
                }
            }

            kk.bbw = kk.w;
            kk.bbd = kk.d;
            kk.bbh = kk.h;

            prevW = kk.w;
            prevD = kk.d;
            prevH = kk.h;

            // =================================================
            // ROTATION
            // =================================================

            for (const rot of ["ox", "oy", "oz"]) {
                const raw = String(ob["_" + rot + "Raw"] ?? "").trim();
                if (raw.startsWith("+")) {
                    const step = Number(raw.slice(1));
                    if (Number.isFinite(step)) kk[rot] = Number(ob[rot] || 0) + j * step;
                } else if (rot === "oz") {
                    kk[rot] = 0;
                }
            }

            // =================================================
            // NAME / RESET
            // =================================================

            kk.nme = nn;

            kk.nx = [1, 0];
            kk.ny = [1, 0];
            kk.nz = [1, 0];

            lastko = nn;

            // =================================================
            // CONNECT AUTOMATIK
            // =================================================

            const cc = corr[xyzpara];

            if (!isPart && cc) {
                kk.tar = [prevName, null, cc.tar];
                kk.cur = [kk.nme, null, cc.cur];
                kk[xyzpara] = gap;
            }

            if (isPart) {
                kk[dimofxyz] = ob[dimofxyz];
                kk[xyzpara] = Number(ob[xyzpara] || 0) + j * (Number(ob[dimofxyz]) + gap);
                ko[nn] = structuredClone(kk);
                if (!ko.jj.includes(nn)) ko.jj.push(nn);
                prevName = nn;
                continue;
            }

            // =================================================
            // SPEICHERN
            // =================================================

            this.oks[nn] = structuredClone(kk);

            this.jj.push(nn);

            this.cloneChildKorpusse(ob.nme, nn);

            // this.lastko = nn;

            prevName = nn;
        }
    }
}  // end createK





    



    summeWerte(obj, keys) {
        const sum = {};

        for (const k of keys) {
            sum[k] = 0;
        }

        for (const key1 in obj) {
            const o1 = obj[key1];

            for (const k of keys) {
                if (o1?.[k] != null) sum[k] += o1[k];
            }

            for (const key2 in o1) {
                const o2 = o1[key2];
                for (const k of keys) {
                    if (o2?.[k] != null) sum[k] += o2[k];
                }
            }
        }

        return sum;
    }




}  // end class
