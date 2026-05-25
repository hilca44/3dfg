const LEGACY_PARTS = {
  l: "sl",
  r: "sr",
  g: "bo",
  t: "de",
  b: "rw",
  f: "fr",
  c: "eb",
  v: "mw"
};

const LEGACY_PROPS = {
  m: "mat",
  w: "breit",
  d: "tief",
  h: "hoch",
  s: "anz",
  u: "push"
};

const LEGACY_COLORS = {
  w: "white",
  wh: "white",
  b: "cornflowerblue",
  g: "gray",
  r: "indianred",
  o: "goldenrod",
  s: "silver",
  sw: "snow",
  iv: "ivory",
  cs: "silk",
  bt: "wheat",
  bl: "cornflowerblue",
  db: "darkblue",
  gr: "gray",
  lg: "lightgray",
  sg: "silver",
  dg: "dimgray",
  an: "anthracite",
  br: "brown",
  sb: "saddlebrown",
  um: "umber",
  nu: "walnut",
  ec: "burlywood",
  kh: "khaki",
  gn: "darkseagreen",
  ol: "olive",
  ys: "sage",
  ro: "indianred",
  we: "maroon",
  te: "terracotta"
};

function partName(value) {
  return LEGACY_PARTS[String(value || "").toLowerCase()] || "";
}

function partList(value) {
  const text = String(value || "");
  if (text.includes(",")) {
    const modern = text.split(",").map(part => part.trim()).filter(Boolean);
    return modern.every(part => part.length > 1) ? modern.join(",") : modern.map(partName).filter(Boolean).join(",");
  }

  return text
    .toLowerCase()
    .split("")
    .map(partName)
    .filter(Boolean)
    .join(",");
}

function propertyName(value) {
  const key = String(value || "").toLowerCase();
  return LEGACY_PROPS[key] || key;
}

function colorName(value) {
  const key = String(value || "").toLowerCase();
  return LEGACY_COLORS[key] || key;
}

function normalizeMaterialValues(rawValues) {
  const values = String(rawValues || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  if (values.length < 2) return values.join(",");

  const [thickness, color, third, fourth, fifth] = values;
  const out = [thickness, colorName(color)];

  if (third && /^\d/.test(third)) {
    out.push(third);
    if (fourth) out.push(fourth);
    return out.join(",");
  }

  if (fourth) out.push(fourth);
  if (fifth) out.push(fifth);
  return out.join(",");
}

function convertMaterial(token) {
  const compact = token.match(/^m([\d.]+)([a-z]{1,2})([a-z])?([\d.,]*)$/i);
  if (compact) {
    const values = [compact[1], colorName(compact[2])];
    if (compact[4]) values.push(...compact[4].split(",").filter(Boolean));
    return `mat.${values.join(",")}`;
  }

  const dotted = token.match(/^m\.(.+)$/i);
  return dotted ? `mat.${normalizeMaterialValues(dotted[1])}` : "";
}

function convertRepeat(axis, value) {
  const parts = String(value || "").split(",");
  const count = parts.shift() || "";
  const rest = parts.length ? `,${parts.join(",")}` : "";
  return `${axis}.anz.${count}${rest}`;
}

function convertPartToken(part, rest) {
  const modernPart = partName(part);
  if (!modernPart) return "";

  const split = rest.match(/^s([xyz])=(.+)$/i);
  if (split) return `${modernPart}.cut.${split[1].toLowerCase()}.${split[2]}`;

  const rotate = rest.match(/^o=([+-]?\d+(?:\.\d+)?)([xyz])$/i);
  if (rotate) return `${modernPart}.dre.${rotate[2].toLowerCase()}.${rotate[1]}`;

  const prop = rest.match(/^([a-z]+)([=:])(.+)$/i);
  if (prop) return `${modernPart}.${propertyName(prop[1])}.${prop[3]}`;

  return "";
}

function convertLegacyConnect(token) {
  const match = String(token || "").match(/^c([^_]+)_([^_]+)$/i);
  if (!match) return "";

  const parseRef = value => {
    const text = String(value || "").trim();
    const ref = text.match(/^([a-z][a-z0-9_-]*?)([lrgtbcfv])?(\d+)$/i);
    if (!ref) return text;

    const [, korpus, part, corner] = ref;
    return [
      korpus.toLowerCase(),
      part ? partName(part) : "",
      corner
    ].join(",");
  };

  return `dock.${match[1]}_${parseRef(match[2])}`;
}

function convertToken(token) {
  const raw = String(token || "");
  if (!raw || raw.startsWith("#")) return raw;
  if (/^-/.test(raw)) return raw;

  const legacyConnect = convertLegacyConnect(raw);
  if (legacyConnect) return legacyConnect;

  if (/^sc\d*$/i.test(raw)) return "";

  const material = convertMaterial(raw);
  if (material) return material;

  const parts = raw.match(/^p[=:](.+)$/i) || raw.match(/^p([lrgtbcfv]+)$/i);
  if (parts) {
    const modernParts = partList(parts[1]);
    return modernParts ? `p.${modernParts}` : raw;
  }

  const dims = raw.match(/^([mwdhsu])([=:])(.+)$/i);
  if (dims) return `${propertyName(dims[1])}.${dims[3]}`;

  const axis = raw.match(/^([xyz])([=:])(.+)$/i);
  if (axis) return `${axis[1].toLowerCase()}.${axis[3]}`;

  const compactAxis = raw.match(/^([xyz])((?:[+-]{1,2})?\d.*)$/i);
  if (compactAxis) return `${compactAxis[1].toLowerCase()}.${compactAxis[2]}`;

  const repeat = raw.match(/^n([xyz])=(.+)$/i);
  if (repeat) return convertRepeat(repeat[1].toLowerCase(), repeat[2]);

  const compactRepeat = raw.match(/^n(?:([xyz])([+-]?\d.*)|([+-]?\d.*)([xyz]))$/i);
  if (compactRepeat) {
    const axisName = (compactRepeat[1] || compactRepeat[4]).toLowerCase();
    const count = compactRepeat[2] || compactRepeat[3];
    return `${axisName}.anz.${count}`;
  }

  const rotate = raw.match(/^o=([+-]?\d+(?:\.\d+)?)([xyz])$/i);
  if (rotate) return `dre.${rotate[2].toLowerCase()}.${rotate[1]}`;

  const dock = raw.match(/^i(?:=(.+))?$/i);
  if (dock) return dock[1] ? `dock.${dock[1]}` : "dock";

  const partProp = raw.match(/^([lrgtbcfv](?:,[lrgtbcfv])*)\.(.+)$/i);
  if (partProp) {
    return partProp[1]
      .split(",")
      .map(part => convertPartToken(part, partProp[2]))
      .filter(Boolean)
      .join(" ") || raw;
  }

  const compactPartMaterial = raw.match(/^m([lrgtbcfv]+)(\d+)$/i);
  if (compactPartMaterial) {
    return compactPartMaterial[1]
      .toLowerCase()
      .split("")
      .map(part => `${partName(part)}.mat.${compactPartMaterial[2]}`)
      .filter(Boolean)
      .join(" ") || raw;
  }

  return raw;
}

function splitLineComment(line) {
  const text = String(line ?? "");
  const hash = text.search(/(?:^|\s)#/);
  if (hash < 0) return { code: text, comment: "" };
  return {
    code: text.slice(0, hash).trimEnd(),
    comment: text.slice(hash).trimStart()
  };
}

function convertLine(line) {
  const raw = String(line ?? "");
  const trimmed = raw.trim();
  if (!trimmed || /^[-#]/.test(trimmed)) return raw;

  const { code, comment } = splitLineComment(trimmed);
  const tokens = code.split(/\s+/).filter(Boolean);
  if (!tokens.length) return raw;

  const out = [tokens[0], ...tokens.slice(1).flatMap(token => convertToken(token).split(/\s+/).filter(Boolean))];
  return [out.join(" "), comment].filter(Boolean).join(" ");
}

export function convertLegacyToModern(inn = "") {
  return String(inn).split(/\r?\n/).map(convertLine).join("\n");
}

if (typeof window !== "undefined") {
  window.convertLegacyToModern = convertLegacyToModern;
}
