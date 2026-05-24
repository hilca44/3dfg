import fs from "fs";

const out = "public/schreinertool/docs/spickzettel-ultra-kompakt.pdf";

const W = 842;
const H = 595;
const M = 22;

function esc(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function rgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

class PdfPage {
  constructor() {
    this.ops = [];
  }

  rect(x, y, w, h, fill, stroke = null, lineWidth = 0.6) {
    if (fill) this.fill(fill);
    if (stroke) this.stroke(stroke);
    this.ops.push(`${lineWidth} w ${x} ${y} ${w} ${h} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
  }

  fill(hex) {
    const [r, g, b] = rgb(hex);
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  }

  stroke(hex) {
    const [r, g, b] = rgb(hex);
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  }

  text(text, x, y, size = 8, font = "F1", color = "#1f2933") {
    this.fill(color);
    this.ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`);
  }

  code(text, x, y, size = 7.2, color = "#24313d") {
    this.text(text, x, y, size, "F2", color);
  }

  line(x1, y1, x2, y2, color = "#d8dee6", lineWidth = 0.5) {
    this.stroke(color);
    this.ops.push(`${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }
}

const sections = [
  {
    title: "Grundform",
    color: "#2f80ed",
    items: [
      ["Projekt", "projekt m19wh m8gr"],
      ["Korpus", "a p=lrgtbc w=80 d=40 h=72"],
      ["Kurz", "a 80,40,72"],
      ["Name", "a, b, c ... / a1 erbt von a"]
    ]
  },
  {
    title: "Teile",
    color: "#0f9f6e",
    items: [
      ["p", "Teile am Korpus"],
      ["l r", "linke / rechte Seite"],
      ["g t", "Boden / Deckel"],
      ["b f", "Rueckwand / Front"],
      ["c v", "Fachboden / Mittelseite"],
      ["vc/cv", "Reihenfolge bestimmt, wer durchlaeuft"]
    ]
  },
  {
    title: "Masse + Position",
    color: "#7c3aed",
    items: [
      ["w d h", "Breite / Tiefe / Hoehe"],
      ["x y z", "links-rechts / vorne-hinten / unten-oben"],
      ["+3", "relativ addieren"],
      ["3,5,7", "Liste / Sequenz"],
      ["dito", "letzte Sequenz wiederholen"]
    ]
  },
  {
    title: "Material",
    color: "#8b5e34",
    items: [
      ["m19wh", "Material 1: 19 mm weiss"],
      ["m=2", "Korpusmaterial"],
      ["b.m=2", "Teilmaterial"],
      ["v.s=3", "Teilstaerke in cm"]
    ]
  },
  {
    title: "Aendern",
    color: "#f59e0b",
    items: [
      ["u=8gs", "Sockel unten"],
      ["f.u=0.4", "Front umlaufend kleiner"],
      ["c.u=2f", "Fachboden vorne kuerzer"],
      ["l.u=7f,9tg", "links: vorne, oben/unten kuerzen"],
      ["leg=22,4", "4 Beine, 22 cm"]
    ]
  },
  {
    title: "Innenaufteilung",
    color: "#16a34a",
    items: [
      ["layout=30:4,240:2,rest:3", "Spaltenbreite:Faecher"],
      ["cols=3:4", "3 gleiche Spalten, 4 Faecher"],
      ["v.s=3 c.s=2", "Mittelseite/Fachboden staerker"],
      ["rest", "nimmt verbleibende Breite"]
    ]
  },
  {
    title: "Wiederholen + Split",
    color: "#0891b2",
    items: [
      ["nx=3,10", "3x in X mit Abstand 10"],
      ["nz=4,20", "4x in Z mit Abstand 20"],
      ["f.sx=3,5", "Front in X teilen"],
      ["f.sz=2,4", "Front in Z teilen"],
      ["l.h=40,30,g6,1", "ungleiche Stuecke + Rest"]
    ]
  },
  {
    title: "Verbinden",
    color: "#dc2626",
    items: [
      ["i", "mit vorherigem Korpus verbinden"],
      ["i=a,,0_b,,3", "Punkt auf Punkt"],
      ["0-3", "vordere Ecken"],
      ["4-7", "hintere Ecken"],
      ["06", "Diagonal/Zentrum"]
    ]
  },
  {
    title: "Aliase",
    color: "#475569",
    items: [
      ["sk=a,14,3", "Schubkaesten in a"],
      ["soc=8", "Sockelblende"],
      ["leg=22,2", "2 Beine"],
      ["...,e", "Alias sichtbar ausschreiben"]
    ]
  }
];

const examples = [
  "schrank m19wh",
  "a p=lrgtb w=300 d=60 h=220 layout=30:4,240:2,rest:3",
  "a p=lrgtbvc w=80 d=40 h=72 v.x=9",
  "b sk=a,14,3",
  "c p=lrgtbc 60,40,72 i=a,,0_a,,3"
];

const page = new PdfPage();

page.rect(0, 0, W, H, "#f7f9fb");
page.rect(0, H - 58, W, 58, "#17212b");
page.text("schreinertool / 3dfg", M, H - 24, 18, "F1", "#ffffff");
page.text("Ultra-kompakter Spickzettel - 1 Seite", M, H - 43, 9, "F1", "#c9d4df");
page.text("Prinzip: Textzeile -> Korpus / Teile / Ausgabe", W - 280, H - 31, 10, "F1", "#d9f99d");

const cardW = (W - M * 2 - 16) / 3;
const cardH = 132;
const gap = 8;
let idx = 0;
for (const section of sections) {
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  const x = M + col * (cardW + gap);
  const yTop = H - 76 - row * (cardH + gap);
  const y = yTop - cardH;

  page.rect(x, y, cardW, cardH, "#ffffff", "#d7dee8", 0.5);
  page.rect(x, yTop - 20, cardW, 20, section.color);
  page.text(section.title, x + 8, yTop - 14, 9.5, "F1", "#ffffff");

  let cy = yTop - 34;
  for (const [key, desc] of section.items) {
    page.code(key, x + 8, cy, 7.2, section.color);
    const wrapped = wrap(desc, 31);
    page.text(wrapped[0] || "", x + 78, cy, 6.8, "F1", "#27313d");
    for (let i = 1; i < Math.min(wrapped.length, 2); i++) {
      cy -= 8;
      page.text(wrapped[i], x + 78, cy, 6.8, "F1", "#27313d");
    }
    cy -= 12;
  }

  idx++;
}

const footY = 20;
page.rect(M, footY, W - 2 * M, 74, "#fffdf7", "#ead7a6", 0.6);
page.rect(M, footY + 54, W - 2 * M, 20, "#a16207");
page.text("Beispiele zum Kopieren", M + 8, footY + 60, 9, "F1", "#ffffff");
let exY = footY + 42;
for (const ex of examples) {
  page.code(ex, M + 10, exY, 7.2, "#3f2f12");
  exY -= 10;
}
page.text("Farben: Blau=Grundform, Gruen=Teile/Layout, Violett=Masse, Gelb=Aendern, Rot=Verbinden.", W - 390, footY + 7, 6.8, "F1", "#6b5b35");

const content = page.ops.join("\n");
const objects = [];
function addObject(body) {
  objects.push(body);
  return objects.length;
}

const font1 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const font2 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
const stream = Buffer.from(content, "latin1");
const contentObj = addObject(`<< /Length ${stream.length} >>\nstream\n${content}\nendstream`);
const pageObj = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentObj} 0 R >>`);
const pagesObj = addObject(`<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>`);
objects[pageObj - 1] = objects[pageObj - 1].replace("/Parent 0 0 R", `/Parent ${pagesObj} 0 R`);
const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

let pdf = "%PDF-1.4\n";
const offsets = [0];
for (let i = 0; i < objects.length; i++) {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i < offsets.length; i++) {
  pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

fs.writeFileSync(out, Buffer.from(pdf, "latin1"));
console.log(out);
