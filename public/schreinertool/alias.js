const PARTS = {
  sl: "l",
  ls: "l",
  sr: "r",
  rs: "r",
  bo: "g",
  de: "t",
  rw: "b",
  fr: "f",
  eb: "c",
  mw: "v"
};

const PROPS = {
  mat: "m",
  breit: "w",
  breite: "w",
  lang: "w",
  tief: "d",
  tiefe: "d",
  hoch: "h",
  hoehe: "h",
  stk: "s",
  push: "u"
};

const ACTIONS = new Set([
  "teilen",
  "dre",
  "reihe",
  "copy",
  "dock",
  "connect",
  "verbinden"
]);

const ALIASES = {
  sk(args) {
    const base = args[0] || "a";
    const height = args[1] || "14";
    const nz = args[2] || "3";

    return [
      "p.sl,sr,fr,rw,bo",
      `breit.${base}.eb.breit`,
      `tief.${base}.bo.tief`,
      `hoch.${height}`,
      `dock.${base},bo,1`,
      "push.-2",
      "mat.3",
      `z.anz.${nz}`
    ];
  },

  soc(args) {
    const height = args[0] || "8";
    return [`push.${height}gs`];
  },


  leg(args) {
    const height = args[0] || "8";
    const count = args[1] ? `,${args[1]}` : "";
    return [`leg.${height}${count}`];
  },

  legs(args) {
    const height = args[0] || "8";
    const count = args[1] || "4";
    return [`leg.${height},${count}`];
  }
};

function splitLineComment(line) {
  const text = String(line ?? "");
  const hash = text.search(/(?:^|\s)#/);
  if (hash < 0) return { code: text, comment: "" };
  return {
    code: text.slice(0, hash).trimEnd(),
    comment: text.slice(hash).trimStart()
  };
}

function partListToLegacy(value) {
  const parts = String(value ?? "")
    .split(",")
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  if (!parts.length) return "";
  if (parts.some(part => !PARTS[part])) return "";
  return parts.map(part => PARTS[part]).join("");
}

function partGroup(value) {
  const parts = String(value ?? "")
    .split(",")
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  return parts.length && parts.every(part => PARTS[part])
    ? parts
    : [];
}

function propKey(value) {
  const key = String(value ?? "").toLowerCase();
  return PROPS[key] || key;
}

function normalizeCompactValuePairs(value) {
  const text = String(value ?? "").trim();
  if (!text || text.includes(",") || /[()*/+-]/.test(text)) return text;
  if (!/(?:\d[a-zäöüß]|[a-zäöüß]\d)/i.test(text)) return text;

  const pairs = text.match(/[a-zäöüß]+-?\d+(?:\.\d+)?|-?\d+(?:\.\d+)?[a-zäöüß]+|\/[a-zäöüß]+|-?\d+(?:\.\d+)?/gi);
  return pairs && pairs.join("") === text ? pairs.join(",") : text;
}

function valueList(value) {
  return String(value ?? "")
    .split(",")
    .map(part => normalizeCompactValuePairs(part.trim()))
    .join(",");
}

function dotValue(property, value) {
  if (/^[A-ZÄÖÜ]/.test(String(property || ""))) {
    return { key: property, value: valueList(value) };
  }

  const key = propKey(property);
  const text = valueList(value);
  const row = text.match(/^n(\d+),g?(.+)$/i);
  const count = text.match(/^n(\d+)$/i);

  if (row && /^[xyz]$/.test(key)) return { key: `n${key}`, value: `${row[1]},${row[2]}` };
  if (count && /^[xyz]$/.test(key)) return { key: `n${key}`, value: count[1] };
  if (row && /^[wdh]$/.test(key)) return { key, value: `${row[1]}/${row[1]},g${row[2]}` };

  return { key, value: text };
}

function materialToken(token) {
  const match = String(token ?? "").match(/^mat\.(.+)$/i);
  if (!match) return "";

  const values = match[1].split(",").map(value => value.trim()).filter(Boolean);
  if (values.length < 2 || !/^-?\d+(?:\.\d+)?$/.test(values[0])) return "";
  return `m,${values.join(",")}`;
}

function legacyPartPath(part, rest, fallbackHead = "", modernPart = "") {
  if (fallbackHead && part === fallbackHead && modernPart) return `${modernPart}.${rest}`;
  return fallbackHead && part === fallbackHead ? `${fallbackHead}.${part}.${rest}` : `${part}.${rest}`;
}

function parseDslToken(token, fallbackHead = "") {
  const raw = String(token ?? "").trim();
  if (!raw) return "";
  if (/[=:]/.test(raw)) return raw;
  if (/^(dock|connect|verbinden)$/i.test(raw)) return "i";

  const material = materialToken(raw);
  if (material) return material;

  const partsToken = raw.match(/^p\.(.+)$/i);
  if (partsToken) {
    const legacy = partListToLegacy(partsToken[1]);
    return legacy ? `p=${legacy}` : raw;
  }

  const parts = raw.split(".");
  if (parts.length < 2) return raw;

  const hasInheritedHead = fallbackHead && parts[0] === fallbackHead && parts.length > 2;
  const body = hasInheritedHead ? parts.slice(1) : parts;
  const group = partGroup(body[0]);
  const part = group.length === 1 ? PARTS[group[0]] : "";
  const index = group.length ? 1 : 0;
  const actionRaw = String(body[index] || "");
  const action = actionRaw.toLowerCase();
  const axis = String(body[index + 1] || "").toLowerCase();
  const value = body.slice(index + 2).join(".");
  const propertyValue = body.slice(index + 1).join(".");

  if (action === "soc" && propertyValue) {
    return parseDslToken(`push.${propertyValue}gs`, fallbackHead);
  }

  if (group.length > 1) {
    return group
      .map(name => parseDslToken([name, ...body.slice(1)].join("."), fallbackHead))
      .join(" ");
  }

  if (/^[xyz]$/.test(action) && /^(?:anz|n)$/i.test(axis) && value) {
    return `n${action}=${valueList(value)}`;
  }

  if (action === "teilen" && part && /^[xyz]$/.test(axis) && value) {
    return legacyPartPath(part, `s${axis}=${valueList(value)}`, fallbackHead, body[0]);
  }

  if ((action === "reihe" || action === "copy") && /^[xyz]$/.test(axis) && value) {
    return part
      ? legacyPartPath(part, `n${axis}=${valueList(value)}`, fallbackHead, body[0])
      : `n${axis}=${valueList(value)}`;
  }

  if (action === "dre" && /^[xyz]$/.test(axis) && value) {
    return part
      ? legacyPartPath(part, `o=${valueList(value)}${axis}`, fallbackHead, body[0])
      : `o=${valueList(value)}${axis}`;
  }

  if (action === "dock" || action === "connect" || action === "verbinden") {
    const spec = [axis, value].filter(Boolean).join(".");
    return spec ? `i=${spec}` : "i";
  }

  if (!ACTIONS.has(action) && propertyValue) {
    const dot = dotValue(actionRaw, propertyValue);
    return part
      ? legacyPartPath(part, `${dot.key}=${dot.value}`, fallbackHead, body[0])
      : `${dot.key}=${dot.value}`;
  }

  return raw;
}

function expandLine(line) {
  const raw = String(line ?? "");
  const trimmed = raw.trim();
  if (!trimmed || /^[-#]/.test(trimmed)) return raw;

  const { code, comment } = splitLineComment(trimmed);
  const tokens = code.split(/\s+/).filter(Boolean);
  if (!tokens.length) return raw;

  const out = [];
  let head = tokens[0];

  const first = parseDslToken(tokens[0], "");
  if (first !== tokens[0] && tokens[0].split(".").length > 2) {
    head = tokens[0].split(".")[0];
    out.push(head, first);
  } else {
    out.push(tokens[0]);
    head = tokens[0].split(".")[0] || "";
  }

  for (const token of tokens.slice(1)) {
    out.push(parseDslToken(token, head));
  }

  return [out.join(" "), comment].filter(Boolean).join(" ");
}

export function expandModernSyntax(inn = "") {
  return String(inn).split(/\r?\n/).map(expandLine).join("\n");
}

function parseAliasToken(token) {
  const match = String(token ?? "").match(/^([a-z][a-z0-9_]*)=(.*)$/i);
  if (!match) return null;

  const alias = ALIASES[match[1].toLowerCase()];
  if (!alias) return null;

  return {
    alias,
    args: match[2].split(",").map(value => value.trim()).filter(Boolean)
  };
}

function expandAliasToken(token) {
  const parsed = parseAliasToken(token);
  return parsed ? parsed.alias(parsed.args) : [token];
}

function materializeAliasToken(token) {
  const parsed = parseAliasToken(token);
  if (!parsed) return [token];
  return parsed.args[3]?.toLowerCase() === "e" ? parsed.alias(parsed.args) : [token];
}

function mapTokenLines(inn, mapper) {
  return String(inn)
    .split(/\r?\n/)
    .map(line => line.trim() ? line.trim().split(/\s+/).flatMap(mapper).join(" ") : line)
    .join("\n");
}

export function expandAliases(inn = "") {
  return expandModernSyntax(mapTokenLines(inn, expandAliasToken));
}

export function materializeAliases(inn = "") {
  return mapTokenLines(inn, materializeAliasToken);
}

if (typeof window !== "undefined") {
  window.C3_ALIASES = ALIASES;
  window.expandModernSyntax = expandModernSyntax;
  window.expandAliases = expandAliases;
  window.materializeAliases = materializeAliases;
}
