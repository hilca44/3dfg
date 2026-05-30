import { EditorState, RangeSetBuilder } from "https://esm.sh/@codemirror/state@6";
import { EditorView, Decoration, ViewPlugin, WidgetType, hoverTooltip, keymap } from "https://esm.sh/@codemirror/view@6";
import { defaultKeymap, history, historyKeymap } from "https://esm.sh/@codemirror/commands@6";
import { autocompletion, completionKeymap, completionStatus, startCompletion } from "https://esm.sh/@codemirror/autocomplete@6";
import { baseCommands, materialSuggest, 
  parameterOptionsByProperty } from "./suggest.js?v=arrayparse39";
import { splitDslList } from "./dsl-parser.js?v=dockparse1";

let editorView = null;
let textarea = null;
let originalValue = null;
let syncing = false;
let commandOptions = [];
let helpByToken = new Map();
let forcedCompletionMode = null;
let syntaxErrorLine = null;
let syntaxErrorMessage = "";
let syntaxErrorToken = "";
let colorPaletteEl = null;

const modernPartOptions = [
  ["sl", "linke Seite"],
  ["sr", "rechte Seite"],
  ["bo", "Boden"],
  ["de", "Deckel"],
  ["rw", "Rueckwand"],
  ["fr", "Front"],
  ["eb", "Einlegeboden"],
  ["mw", "Mittelwand"]
];

const legacyPartToModern = {
  l: "sl",
  r: "sr",
  g: "bo",
  t: "de",
  b: "rw",
  f: "fr",
  c: "eb",
  v: "mw"
};

const modernActionOptions = [
  ["cut.", "cut.[x|y|z].[anzahl,[abstand:<zahl>a|raster:<zahl>r]]"],
  ["dre.", "dre.[x|y|z].[grad]"],
  ["reihe.", "reihe.[x|y|z].[anzahl,[abstand]]"],
  ["copy.", "copy.[x|y|z].[anzahl,[abstand]]"],
  ["fit=", "fit=[korpus,teil,ecke]_[korpus,teil,ecke]"],
  ["dock.", "dock.[ziel]"],
  // ["sta.", "stapeln"],
  // ["aus.", "ausrichten"],
  // ["zen.", "zentrieren"],
  ["push.", "push.[wert]"]
];

const axisOptions = [
  ["x.", "X-Richtung"],
  ["y.", "Y-Richtung"],
  ["z.", "Z-Richtung"]
];

const propertyOptions = [
  ["mat.", "mat.[nummer]"],
  ["push.", "push.[wert]"],
  ["x.", "x.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["y.", "y.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["z.", "z.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["breit.", "breit.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["breite.", "breite.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["lang.", "lang.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["tief.", "tief.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["tiefe.", "tiefe.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["hoch.", "hoch.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["hoehe.", "hoehe.[zahl|(formel)|eigenschaft|Korpus.eigenschaft|GLOBALE_VAR]"],
  ["anz.", "anz.[zahl]"]
];

const defaultParameterOptions = [
  ["(", "mathematischer Ausdruck: (wert+wert)"],
  ["+", "Rechenoperation addieren"],
  ["-", "Rechenoperation subtrahieren"],
  ["*", "Rechenoperation multiplizieren"],
  ["/", "Rechenoperation dividieren"],
  ["breit", "Eigenschaft dieses Korpus"],
  ["Korpus.eigenschaft", "Eigenschaft eines anderen Korpus"],
  ["GLOBALE_VAR", "globale Projektvariable: gross geschrieben"],
  ["1", "kleinster Standardwert"],
  ["2", "kleiner Standardwert"],
  ["5", "mittlerer Standardwert"],
  ["10", "groesserer Standardwert"]
];

// const parameterOptionsByProperty = {
//   hoch: [
//     ["1", "Material 1"],
//     ["2", "Material 2"],
//     ["3", "Material 3"]
//   ],
//   mat: [
//     ["1", "Material 1"],
//     ["2", "Material 2"],
//     ["3", "Material 3"]
//   ],
//   o: [
//     ["9", "9 Grad, z-Achse default"],
//     ["45", "45 Grad, z-Achse default"],
//     ["90", "90 Grad, z-Achse default"],
//     ["-45", "-45 Grad, z-Achse default"],
//     ["45x", "45 Grad um x"],
//     ["45y", "45 Grad um y"],
//     ["45z", "45 Grad um z"]
//   ],
//   u: [
//     ["2f", "2 cm vorne"],
//     ["2b", "2 cm hinten"],
//     ["2f,1b", "vorne und hinten"],
//     ["8g", "8 cm unten"]
//   ],
//   x: defaultParameterOptions,
//   y: defaultParameterOptions,
//   z: defaultParameterOptions,
//   wdh: [
//     ["1", "1 cm"],
//     ["2", "2 cm"],
//     ["5", "5 cm"],
//     ["10", "10 cm"]
//   ],
//   w: [
//     ["40", "40 cm"],
//     ["60", "60 cm"],
//     ["80", "80 cm"],
//     ["120", "120 cm"]
//   ],
//   breit: [
//     ["40", "40 cm"],
//     ["60", "60 cm"],
//     ["80", "80 cm"],
//     ["120", "120 cm"]
//   ],
//   d: [
//     ["30", "30 cm"],
//     ["40", "40 cm"],
//     ["60", "60 cm"]
//   ],
//   tief: [
//     ["30", "30 cm"],
//     ["40", "40 cm"],
//     ["60", "60 cm"]
//   ],
//   hoch: [
//     ["30", "30 cm"],
//     ["72", "72 cm"],
//     ["100", "100 cm"],
//     ["200", "200 cm"]
//   ],
//   s: [
//     ["1.6", "16 mm"],
//     ["1.9", "19 mm"],
//     ["2.5", "25 mm"],
//     ["3.8", "38 mm"]
//   ],
//   stk: [
//     ["1.6", "16 mm"],
//     ["1.9", "19 mm"],
//     ["2.5", "25 mm"],
//     ["3.8", "38 mm"]
//   ],
//   sx: [
//     ["2", "in 2 Teile"],
//     ["3", "in 3 Teile"],
//     ["3,5", "3 Teile, Abstand 5"]
//   ],
//   sy: [
//     ["2", "in 2 Teile"],
//     ["3", "in 3 Teile"],
//     ["2,1", "2 Teile, Abstand 1"]
//   ],
//   sz: [
//     ["2", "in 2 Teile"],
//     ["4,2", "4 Teile, Abstand 2"]
//   ],
//   co: [
//     ["white", "White"],
//     ["wheat", "Wheat"],
//     ["cornflowerblue", "Cornflower Blue"],
//     ["gray", "Gray"]
//   ],
//   n: [
//     ["2", "2 Wiederholungen"],
//     ["3", "3 Wiederholungen"],
//     ["4", "4 Wiederholungen"]
//   ],
//   nz: [
//     ["2", "2 in z"],
//     ["3", "3 in z"],
//     ["4", "4 in z"]
//   ]
// };

function isModernCompletionLabel(label) {
  return !String(label || "").includes("=");
}

function readTextareaValue() {
  return originalValue.get.call(textarea);
}

function writeTextareaValue(value) {
  originalValue.set.call(textarea, value);
}

function setEditorText(value) {
  if (!editorView) return;
  const next = String(value ?? "");
  const current = editorView.state.doc.toString();
  if (current === next) return;

  syncing = true;
  editorView.dispatch({
    changes: { from: 0, to: current.length, insert: next }
  });
  syncing = false;
}

function insertIntoInnEditor(text) {
  if (!editorView || !textarea) return false;

  const value = String(text ?? "");
  if (!value) return false;

  const selection = editorView.state.selection.main;
  const before = editorView.state.sliceDoc(Math.max(0, selection.from - 1), selection.from);
  const after = editorView.state.sliceDoc(selection.to, selection.to + 1);
  const prefix = before && !/\s/.test(before) ? " " : "";
  const suffix = after && !/\s/.test(after) ? " " : "";
  const insert = `${prefix}${value}${suffix}`;
  const anchor = selection.from + insert.length - suffix.length;

  editorView.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: { anchor },
    userEvent: "input"
  });
  editorView.focus();
  writeTextareaValue(editorView.state.doc.toString());
  dispatchTextareaInput();
  window.recordReloadHistory?.();
  return true;
}

function dispatchTextareaInput() {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function patchTextareaValue() {
  originalValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  Object.defineProperty(textarea, "value", {
    configurable: true,
    get() {
      return originalValue.get.call(this);
    },
    set(value) {
      originalValue.set.call(this, value);
      if (!syncing) setEditorText(value);
    }
  });
}

async function loadCommands() {
  baseCommands.forEach(([token, detail]) => helpByToken.set(token, detail));

  const makeCommandOption = ([label, detail], index) => ({
    label,
    detail,
    type: "keyword",
    boost: 1000 - index,
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      if (completion.label === "mat.") {
        requestAnimationFrame(() => startCompletion(view));
      }
    }
  });

  commandOptions = baseCommands
    .filter(([label]) => isModernCompletionLabel(label))
    .map(makeCommandOption);
}

function partOptionsForContext(context) {
  const line = context.state.doc.lineAt(context.pos);
  const textBeforeCursor = line.text.slice(0, context.pos - line.from);
  const head = textBeforeCursor.trim().split(/\s+/)[0]?.split(".")[0] || "";
  const fromLine = partsFromPValue(line.text.match(/\b(?:teil|p)[=.]([^\s]+)/i)?.[1] || "");
  const fromProject = partsFromPValue(window.PR?.oks?.[head]?.p || window.PR?.oks?.[head]?.j || "");
  const parts = fromLine.length ? fromLine : fromProject;
  
  // Wenn keine Teile aus Kontext/Zeile/Projekt gefunden, filtere nach verfügbaren Teilen
  if (!parts.length) {
    // Versuche, verfügbare Teile aus dem Korpus zu erhalten
    const availablePartsFromCorpus = head && window.PR?.oks?.[head]
      ? partsFromPValue(window.PR.oks[head].p || window.PR.oks[head].j || "")
      : [];
    
    // Wenn Corpus Teile definiert, nutze nur diese; sonst alle möglich
    if (availablePartsFromCorpus.length > 0) {
      const details = new Map(modernPartOptions);
      return availablePartsFromCorpus.map(part => [part, details.get(part) || part]);
    }
    
    return modernPartOptions;
  }

  const details = new Map(modernPartOptions);
  return parts.map(part => [part, details.get(part) || part]);
}

function partsFromPValue(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const parts = splitDslList(text).map(part => part.toLowerCase());

  const valid = new Set(modernPartOptions.map(([part]) => part));
  return parts.filter((part, index) => valid.has(part) && parts.indexOf(part) === index);
}

function partCompletionOptions(context) {
  return partOptionsForContext(context).map(([part, detail]) => ({
    label: `${part}.`,
    detail,
    type: "variable",
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      requestAnimationFrame(() => startCompletion(view));
    }
  }));
}

function modernActionCompletionOptions() {
  return modernActionOptions.map(([action, detail]) => ({
    label: action,
    detail,
    type: "keyword",
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      requestAnimationFrame(() => startCompletion(view));
    }
  }));
}

function axisCompletionOptions() {
  return axisOptions.map(([axis, detail]) => ({
    label: axis,
    detail,
    type: "constant",
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      requestAnimationFrame(() => startCompletion(view));
    }
  }));
}

function partListCompletionOptions(token) {
  const text = token.text || "";
  const separatorIndex = /^(?:teil|p)[=.]/i.test(text) ? text.search(/[=.]/) : text.indexOf("=");
  const valueStart = separatorIndex + 1;
  const valueBeforeCursor = text.slice(valueStart, token.cursor);
  const lastComma = valueBeforeCursor.lastIndexOf(",");
  const segmentStart = valueStart + lastComma + 1;
  const prefix = text.slice(valueStart, segmentStart);
  const used = new Set(
    splitDslList(valueBeforeCursor.slice(0, Math.max(0, lastComma)))
      .map(part => part.toLowerCase())
      .filter(Boolean)
  );

  const partOptions = modernPartOptions
    .filter(([part]) => !used.has(part))
    .map(([part, detail], index) => ({
      label: part,
      detail,
      type: "variable",
      boost: 500 - index,
      apply(view, completion, from, to) {
        const insert = completion.label;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length }
        });
      }
    }));

  return {
    from: token.from + segmentStart,
    options: partOptions,
    validFor: /^[a-z,]*$/i
  };
}

function corpusPropertyCompletionOptions() {
  return propertyOptions.map(([property, detail]) => ({
    label: property,
    detail: `Korpus: ${detail}`,
    type: "property",
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      requestAnimationFrame(() => startCompletion(view));
    }
  }));
}

function propertyCompletionOptions(part) {
  const partDetail = modernPartOptions.find(([key]) => key === part)?.[1] || "Teil";

  return propertyOptions.map(([property, detail]) => ({
    label: property,
    detail: `${partDetail}: ${detail}`,
    type: "property",
    apply(view, completion, from, to) {
      view.dispatch({
        changes: { from, to, insert: completion.label },
        selection: { anchor: from + completion.label.length }
      });
      requestAnimationFrame(() => startCompletion(view));
    }
  }));
}

function branchCompletionOptions() {
  return [
    {
      label: "Teile dieses Korpus ändern",
      detail: "Teile dieses Korpus ändern",
      type: "keyword",
      apply(view, completion, from, to) {
        forcedCompletionMode = "parts";
        view.dispatch({ selection: { anchor: from } });
        requestAnimationFrame(() => startCompletion(view));
      }
    }
  ].concat(corpusPropertyCompletionOptions());
}

function parameterCompletionOptions(property) {
  const key = property.toLowerCase();
  if (key === "co") return colorCompletionOptions();

  const options = parameterOptionsByProperty[key] || defaultParameterOptions;

  return options.map(([label, detail], index) => ({
    label,
    detail,
    type: "constant",
    boost: 1000 - index,
    apply: label
  }));
}

function availableColorOptions() {
  const colors = typeof window !== "undefined" ? window.colors : null;
  const source = colors && typeof colors === "object" ? Object.entries(colors) : [];

  return source
    .map(([key, value]) => [
      key,
      value?.de || value?.name || key,
      value?.css || "#cccccc"
    ])
    .filter(([key]) => /^[a-z][a-z0-9_-]*$/i.test(String(key)))
    .sort(([a], [b]) => a.localeCompare(b));
}

function isLightCssColor(css) {
  if (typeof document === "undefined") return false;

  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  document.body.appendChild(probe);

  const rgb = getComputedStyle(probe).color.match(/\d+/g)?.map(Number) || [0, 0, 0];
  probe.remove();

  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000 > 175;
}

function applyColorText(el, css) {
  el.style.color = css;
  if (isLightCssColor(css)) {
    el.style.textShadow = "0 0 1px rgba(0,0,0,.9), 0 1px 1px rgba(0,0,0,.45)";
  }
}

function colorCssForToken(token) {
  const text = String(token || "");
  const hex = text.match(/#([0-9a-f]{6})\b/i);
  if (hex) return `#${hex[1]}`;

  const mat = text.match(/(?:^|\.|\b)(?:m|mat)[.,]\d+(?:\.\d+)?,([a-z][a-z0-9_-]*)\b/i);
  if (mat) return window.colors?.[mat[1].toLowerCase()]?.css || "";

  const materialColor = text.match(/(?:^|\.|\b)co[=.](#?[0-9a-f]{6}|[a-z][a-z0-9_-]*)\b/i);
  if (materialColor) {
    const value = materialColor[1].toLowerCase();
    return value.startsWith("#") ? value : window.colors?.[value]?.css || "";
  }

  return "";
}

class ColorInlineWidget extends WidgetType {
  constructor(css) {
    super();
    this.css = css;
  }

  eq(other) {
    return other.css === this.css;
  }

  toDOM() {
    const swatch = document.createElement("span");
    swatch.className = "cm-c3-inline-color";
    swatch.style.background = this.css;
    swatch.title = this.css;
    return swatch;
  }

  ignoreEvent() {
    return true;
  }
}

function colorCompletionOptions(options = {}) {
  return availableColorOptions().map(([key, name, css], index) => {
    return {
      label: key,
      detail: `${name} ${css}`,
      type: "color",
      boost: 1000 - index,
      apply: key,
      render(completion) {
        const row = document.createElement("span");
        row.className = "cm-c3-color-completion";
        row.style.setProperty("--cm-c3-color-css", css);

        const swatch = document.createElement("span");
        swatch.className = "cm-c3-color-swatch";
        swatch.style.background = css;

        const code = document.createElement("span");
        code.className = "cm-c3-color-code";
        code.textContent = css;
        code.title = completion.label;
        applyColorText(code, css);

        const nameText = document.createElement("span");
        nameText.className = "cm-c3-color-name";
        nameText.textContent = name;
        applyColorText(nameText, css);

        row.append(swatch, code, nameText);
        return row;
      }
    };
  });
}

function materialValueOptions(values, step) {
  return values.map(([label, detail], index) => ({
    label,
    detail,
    type: "constant",
    boost: 1000 - index,
    apply(view, completion, from, to) {
      applyMaterialStep(view, completion.label, from, to, step);
    }
  }));
}

function applyMaterialStep(view, value, from, to, step) {
  const needsComma = !step.final;
  const hasCommaAfter = view.state.doc.sliceString(to, to + 1) === ",";
  const insert = value + (needsComma && !hasCommaAfter ? "," : "");
  const anchor = from + value.length + (needsComma ? 1 : 0);

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor },
    userEvent: "input.complete"
  });

  if (needsComma) {
    requestAnimationFrame(() => startCompletion(view));
  }
}

function materialFieldSegment(token) {
  const match = token.text.match(/^(?:m|mat)\./i);
  if (!match) return null;

  const fieldNames = ["thickness", "color", "price", "edgePrice"];
  let start = match[0].length;

  for (let index = 0; index < fieldNames.length; index++) {
    const comma = token.text.indexOf(",", start);
    const end = comma >= 0 ? comma : token.text.length;

    if (token.cursor >= start && token.cursor <= end) {
      return {
        name: fieldNames[index],
        index,
        from: token.from + start,
        to: token.from + end,
        value: token.text.slice(start, end)
      };
    }

    if (comma < 0) return null;
    start = comma + 1;
  }

  return null;
}

function materialStepCompletion(token) {
  const field = materialFieldSegment(token);
  if (!field) return null;

  if (field.name === "color") {
    return {
      from: field.from,
      to: field.to,
      options: colorCompletionOptions({ useNames: true }).map(option => ({
        ...option,
        apply(view, completion, from, to) {
          applyMaterialStep(view, completion.label, from, to, { final: false });
        }
      })),
      validFor: /^[a-z0-9_-]*$/i
    };
  }

  const config = {
    thickness: {
      values: materialSuggest.thickness,
      final: false,
      validFor: /^[\d.]*$/,
      detail: "Dicke in mm"
    },
    price: {
      values: materialSuggest.price,
      final: false,
      validFor: /^[\d.]*$/,
      detail: "Preis pro Quadratmeter"
    },
    edgePrice: {
      values: materialSuggest.edgePrice,
      final: true,
      validFor: /^[\d.]*$/,
      detail: "Preis pro Meter Kante"
    }
  }[field.name];

  if (!config) return null;

  return {
    from: field.from,
    to: field.to,
    options: materialValueOptions(config.values, config),
    validFor: config.validFor
  };
}

function materialColorCompletion(token) {
  const segment = materialColorSegment(token);
  if (segment) {
    return {
      from: segment.from,
      to: segment.to,
      options: colorCompletionOptions({ useNames: true }),
      validFor: /^[a-z0-9_-]*$/i
    };
  }

  return null;
}

function materialColorSegment(token) {
  const match = token.text.match(/^((?:m|mat)[.,]\d+(?:\.\d+)?),([^,\s]*)(?:,|$)/i);
  if (!match) return null;

  const segmentStart = match[1].length + 1;
  const segmentEnd = segmentStart + (match[2] || "").length;
  if (token.cursor < segmentStart || token.cursor > segmentEnd) return null;

  return {
    from: token.from + segmentStart,
    to: token.from + segmentEnd,
    value: match[2] || ""
  };
}

function materialColorSegmentAt(state, pos) {
  return materialColorSegment(tokenAround(state, pos));
}

function ensureColorPalette() {
  if (colorPaletteEl) return colorPaletteEl;

  colorPaletteEl = document.createElement("div");
  colorPaletteEl.className = "cm-c3-color-palette hidden";
  colorPaletteEl.addEventListener("mousedown", event => event.preventDefault());
  document.body.appendChild(colorPaletteEl);
  return colorPaletteEl;
}

function hideColorPalette() {
  if (colorPaletteEl) colorPaletteEl.classList.add("hidden");
}

function applyPaletteColor(key) {
  if (!editorView) return;

  const segment = materialColorSegmentAt(editorView.state, editorView.state.selection.main.head);
  if (!segment) return;

  editorView.dispatch({
    changes: { from: segment.from, to: segment.to, insert: key },
    selection: { anchor: segment.from + key.length },
    userEvent: "input.complete"
  });
  editorView.focus();
}

function updateColorPalette(view) {
  const segment = materialColorSegmentAt(view.state, view.state.selection.main.head);
  if (!segment) {
    hideColorPalette();
    return;
  }

  const colors = availableColorOptions();
  if (!colors.length) {
    hideColorPalette();
    return;
  }

  const palette = ensureColorPalette();
  palette.innerHTML = "";

  for (const [key, name, css] of colors) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cm-c3-color-palette-item";
    item.style.setProperty("--cm-c3-color-css", css);
    item.title = `${name} ${css}`;

    const swatch = document.createElement("span");
    swatch.className = "cm-c3-color-palette-swatch";
    swatch.style.background = css;

    const label = document.createElement("span");
    label.className = "cm-c3-color-palette-label";
    label.textContent = key;

    if (key === segment.value.toLowerCase()) item.classList.add("active");
    item.append(swatch, label);
    item.addEventListener("click", () => applyPaletteColor(key));
    palette.appendChild(item);
  }

  const coords = view.coordsAtPos(segment.from);
  if (!coords) {
    hideColorPalette();
    return;
  }

  palette.classList.remove("hidden");
  const width = Math.min(420, window.innerWidth - 16);
  palette.style.width = `${width}px`;

  const left = Math.max(8, Math.min(coords.left, window.innerWidth - width - 8));
  const top = Math.min(coords.bottom + 8, window.innerHeight - palette.offsetHeight - 8);
  palette.style.left = `${left}px`;
  palette.style.top = `${Math.max(8, top)}px`;
}

function tokenAround(state, pos) {
  const line = state.doc.lineAt(pos);
  let from = pos;
  let to = pos;

  while (from > line.from && !/\s/.test(line.text[from - line.from - 1])) from--;
  while (to < line.to && !/\s/.test(line.text[to - line.from])) to++;

  return {
    from,
    to,
    text: state.doc.sliceString(from, to),
    cursor: pos - from
  };
}

function isFirstLineToken(state, from) {
  const line = state.doc.lineAt(from);
  return line.text.slice(0, from - line.from).trim() === "";
}

function currentCorpusNames() {
  return new Set(
    Object.values(window.PR?.oks || {})
      .map(ko => ko?.nme)
      .filter(Boolean)
      .map(String)
  );
}

function childCorpusNameOptions(name) {
  const names = currentCorpusNames();
  const options = [];
  let suffix = 1;

  while (options.length < 8 && suffix < 100) {
    const next = `${name}${suffix}`;
    suffix++;

    if (names.has(next)) continue;

    options.push({
      label: next,
      detail: `neuer Korpus, erbt von ${name}`,
      type: "variable",
      apply(view, completion, from, to) {
        applyCorpusName(view, completion.label, from, to);
      }
    });
  }

  return options;
}

function applyCorpusName(view, label, from, to) {
  const insert = `${label} `;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length }
  });
  requestAnimationFrame(() => startCompletion(view));
}

function corpusNameCompletionOptions(current) {
  const name = current || "a";
  const names = currentCorpusNames();

  if (current && names.has(current)) {
    return childCorpusNameOptions(current);
  }

  return [
    {
      label: name,
      detail: "Korpusname",
      type: "variable",
      apply(view, completion, from, to) {
        applyCorpusName(view, completion.label, from, to);
      },
      info: "Der erste Wert jeder Zeile ist der Korpusname. Danach werden Teile und Korpuseigenschaften direkt vorgeschlagen."
    },
    {
      label: `${name}1`,
      detail: "Vererbung: Variante vom Grundnamen",
      type: "variable",
      apply(view, completion, from, to) {
        applyCorpusName(view, completion.label, from, to);
      },
      info: `${name}1 erbt die Default-Werte vom Korpus ${name}, solange sie nicht ueberschrieben werden.`
    },
    {
      label: `b.${name}`,
      detail: "Vererbung: Bezug auf einen anderen Korpus",
      type: "variable",
      apply(view, completion, from, to) {
        applyCorpusName(view, completion.label, from, to);
      },
      info: `Mit Punkt kann ein Name auf einen bestehenden Korpus/Default verweisen, z.B. b.${name}.`
    },
  ];
}

function completionSource(context) {
  const word = context.matchBefore(/[A-Za-zÄÖÜäöüß0-9_.=#,+\-*/()]*/);
  if (!word) return null;

  if (forcedCompletionMode === "parts") {
    forcedCompletionMode = null;
    return {
      from: context.pos,
      options: partCompletionOptions(context),
      validFor: /^$/
    };
  }

  if (forcedCompletionMode === "corpus") {
    forcedCompletionMode = null;
    return {
      from: context.pos,
      options: corpusPropertyCompletionOptions(),
      validFor: /^$/
    };
  }

  const token = tokenAround(context.state, context.pos);
  const materialStep = materialStepCompletion(token);
  if (materialStep) return materialStep;

  if (/^(?:teil|p)[=.]/i.test(token.text) && token.cursor > token.text.search(/[=.]/)) {
    return partListCompletionOptions(token);
  }

  const valueSeparatorMatch = token.text.match(/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*\.)?([a-z]+)[=.]/i);
  const valueSeparatorIndex = valueSeparatorMatch ? valueSeparatorMatch[0].length - 1 : -1;
  if (valueSeparatorIndex >= 0 && token.cursor > valueSeparatorIndex) {
    const head = token.text.slice(0, valueSeparatorIndex);
    const property = (head.match(/(?:^|\.)([a-z]+)$/i)?.[1] || "").toLowerCase();

    if (property) {
      return {
        from: token.from + valueSeparatorIndex + 1,
        to: token.to,
        options: parameterCompletionOptions(property),
        validFor: /^[A-Za-z0-9.,+\-*/()]*$/
      };
    }
  }

  if (isFirstLineToken(context.state, word.from)) {
    return {
      from: word.from,
      options: corpusNameCompletionOptions(word.text),
      validFor: /^[A-Za-z0-9_.-]*$/
    };
  }

  const modernPartMatch = word.text.match(/^((?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*)\.([a-z]*)$/i);
  if (modernPartMatch) {
    return {
      from: word.from + modernPartMatch[1].length + 1,
      options: [
        ...modernActionCompletionOptions(),
        ...propertyCompletionOptions(modernPartMatch[1].toLowerCase())
      ],
      validFor: /^[a-z]*$/i
    };
  }

  const modernAxisMatch = word.text.match(/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*\.)?(cut|teilen|tei|dre|reihe|wid|copy|kop|sta|aus|zen)\.([xyz]?)$/i);
  if (modernAxisMatch) {
    return {
      from: word.from + word.text.lastIndexOf(".") + 1,
      options: axisCompletionOptions(),
      validFor: /^[xyz]*$/i
    };
  }

  if (word.from === word.to) {
    const before = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos);
    if (!/\s/.test(before) && !context.explicit) return null;

    return {
      from: context.pos,
      options: branchCompletionOptions(),
      validFor: /^$/
    };
  }

  return {
    from: word.from,
    options: commandOptions,
    validFor: /^[A-Za-z0-9_.=#,+\-*/()]*$/
  };
}

function classForToken(token, index) {
  if (index === 0) return "cm-c3-name";
  if (/^-/.test(token)) return "cm-c3-disabled";
  if (/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*\.)?(?:cut|teilen|tei|dre|reihe|wid|copy|kop|dock|verbinden|vbn|connect|con|sta|aus|zen|push)(?:[.=]|$)/i.test(token)) return "cm-c3-command";
  if (/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*\.)?(?:mat|breit|breite|lang|tief|tiefe|hoch|hoehe|anz|stk)(?:[=.])/i.test(token)) return "cm-c3-command";
  if (/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)(?:,(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw))*\.)?(?:x|y|z|breit|breite|tief|tiefe|hoch|hoehe|anz|stk)\./i.test(token)) return "cm-c3-command";
  if (/^(?:teil|p)\./i.test(token)) return "cm-c3-parts";
  if (/^mat\.\d/i.test(token)) return "cm-c3-material";
  if (/^\d+([,.]\d+)*$/.test(token)) return "cm-c3-number";
  if (/^(cur|tar)=/i.test(token)) return "cm-c3-link";
  if (/^(c|n|sc|box|r\[)/i.test(token)) return "cm-c3-command";
  return "";
}

function buildDecorations(view) {
  const builder = new RangeSetBuilder();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;

    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const matches = [...text.matchAll(/\S+/g)];
      const errorTokenStart = syntaxErrorLine === line.number && syntaxErrorToken
        ? text.indexOf(syntaxErrorToken)
        : -1;

      if (syntaxErrorLine === line.number && errorTokenStart < 0) {
        builder.add(line.from, line.from, Decoration.line({
          class: "cm-c3-error-line",
          attributes: syntaxErrorMessage ? { title: syntaxErrorMessage } : {}
        }));
        builder.add(line.from, line.to, Decoration.mark({ class: "cm-c3-error-text" }));
      }

      for (const match of matches) {
        const token = match[0];
        const start = line.from + match.index;
        const end = start + token.length;
        const isErrorToken = syntaxErrorLine === line.number &&
          errorTokenStart === match.index &&
          token === syntaxErrorToken;

        if (isErrorToken) {
          builder.add(start, end, Decoration.mark({
            class: "cm-c3-error-text",
            attributes: syntaxErrorMessage ? { title: syntaxErrorMessage } : {}
          }));
          continue;
        }
        // Dock validation: if dock token misses a target corpus, mark as error
        try {
          if (/^dock\./i.test(token) || /^i=/i.test(token)) {
            const spec = /^dock\./i.test(token) ? token.slice(5) : token.slice(2);
            const parts = splitDslList(spec).map(p => String(p || "").trim());
            const modernParts = ["sl","sr","bo","de","rw","fr","eb","mw"];
            const legacyParts = ["l","r","g","t","b","f","c","v"];
            const first = (parts[0] || "").toLowerCase();

            // Wenn nur zwei Werte angegeben sind und der erste ein Teil-Token ist,
            // dann fehlt der Zielkorpus (z.B. "dock.fr,0" statt "dock.a,fr,0").
            if (parts.length === 2 && (modernParts.includes(first) || legacyParts.includes(first))) {
              builder.add(start, end, Decoration.mark({
                class: "cm-c3-error-text",
                attributes: { title: "Dock: Zielkorpus fehlt" }
              }));
              pos = line.to + 1;
              break;
            }
          }
        } catch (e) {
          // ignore parsing errors here
        }

        const cls = classForToken(token, match.index === 0 ? 0 : 1);
        if (cls) builder.add(start, end, Decoration.mark({ class: cls }));

        const colorCss = colorCssForToken(token);
        if (colorCss) {
          builder.add(end, end, Decoration.widget({
            widget: new ColorInlineWidget(colorCss),
            side: 1
          }));
        }
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

const c3HighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || update.transactions.length) {
      if (update.docChanged) {
        syntaxErrorLine = null;
        syntaxErrorMessage = "";
      }
      this.decorations = buildDecorations(update.view);
    }
  }
}, {
  decorations: value => value.decorations
});

function tokenAt(state, pos) {
  const line = state.doc.lineAt(pos);
  let start = pos;
  let end = pos;

  while (start > line.from && !/\s/.test(line.text[start - line.from - 1])) start--;
  while (end < line.to && !/\s/.test(line.text[end - line.from])) end++;

  return {
    from: start,
    to: end,
    text: state.doc.sliceString(start, end)
  };
}

function helpForToken(token) {
  if (helpByToken.has(token)) return helpByToken.get(token);

  if (/^(sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:cut|teilen|tei)\.[xyz]\./i.test(token)) return "Teil in Richtung schneiden";
  if (/^(sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.dre\.[xyz]\./i.test(token)) return "Teil um Achse drehen";
  if (/^(?:reihe|wid)\.[xyz]\./i.test(token)) return "Korpus in Richtung als Reihe wiederholen";
  if (/^(?:copy|kop)\.[xyz]\./i.test(token)) return "Korpus in Richtung kopieren";
  if (/^(?:push|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.push)[=.]/i.test(token)) return "Einzug / Ueberstand setzen";
  if (/^(?:dock|verbinden|vbn|ver|connect|con)(?:\.|$)/i.test(token)) return "an einen Zielpunkt andocken";
  if (/^dre\.[xyz]\./i.test(token)) return "Korpus um Achse drehen";
  if (/^(?:mat|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.mat)[=.]/i.test(token)) return "Material setzen";
  if (/^(?:breit|breite|lang|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:breit|breite|lang))[=.]/i.test(token)) return "Breite setzen";
  if (/^(?:tief|tiefe|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:tief|tiefe))[=.]/i.test(token)) return "Tiefe setzen";
  if (/^(?:hoch|hoehe|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:hoch|hoehe))[=.]/i.test(token)) return "Hoehe setzen";
  if (/^(?:anz|stk|(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.(?:anz|stk))[=.]/i.test(token)) return "Staerke setzen";

  const normalized = token
    .replace(/\d+([,.]\d+)*/g, "9")
    .replace(/=[^,\s]+/g, "=9");

  return helpByToken.get(normalized) || "";
}

const c3Hover = hoverTooltip((view, pos) => {
  const token = tokenAt(view.state, pos);
  if (!token.text) return null;

  const help = helpForToken(token.text);
  if (!help) return null;

  return {
    pos: token.from,
    end: token.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-c3-help";
      dom.textContent = help;
      return { dom };
    }
  };
});

// Plugin: show a small hint when the cursor is at the start (Spalte 1) of any line
class StartOfLineHintPlugin {
  constructor(view) {
    this.view = view;
    this.dom = document.createElement("div");
    this.dom.className = "cm-c3-start-hint";
    this.dom.style.position = "fixed";
    this.dom.style.padding = "10px 16px";
    this.dom.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    this.dom.style.color = "#fff";
    this.dom.style.borderRadius = "6px";
    this.dom.style.fontSize = "14px";
    this.dom.style.fontWeight = "500";
    this.dom.style.pointerEvents = "auto";
    this.dom.style.zIndex = "10000";
    this.dom.style.display = "none";
    this.dom.style.whiteSpace = "nowrap";
    this.dom.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)";
    this.dom.style.cursor = "default";
    document.body.appendChild(this.dom);
    this.updateScheduled = false;
  }

  update(update) {
    if (update.selectionSet && !this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.updateScheduled = false;
        this.showHintIfAtLineStart(update.view);
      });
    }
  }

  showHintIfAtLineStart(view) {
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);

    if (pos === line.from) {
      try {
        const coords = view.coordsAtPos(pos);
        if (coords) {
          this.dom.textContent = "💡 Cursor am Anfang – Enter zum Autocomplete";
          // Position: rechts vom Cursor, ein wenig darunter
          this.dom.style.left = `${Math.max(10, coords.left + 30)}px`;
          this.dom.style.top = `${Math.max(10, coords.top + 25)}px`;
          this.dom.style.display = "block";
          return;
        }
      } catch (e) {
        // Layout not ready yet
      }
    }
    this.dom.style.display = "none";
  }

  destroy() {
    this.dom.remove();
  }
}

const startOfLineHintPlugin = ViewPlugin.fromClass(StartOfLineHintPlugin);

function createEditorHost() {
  let host = document.getElementById("innEditor");
  if (host) return host;

  host = document.createElement("div");
  host.id = "innEditor";
  host.className = "view";
  textarea.insertAdjacentElement("afterend", host);
  return host;
}

function createEditor() {
  const host = createEditorHost();

  editorView = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: readTextareaValue(),
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        autocompletion({ override: [completionSource] }),
        c3HighlightPlugin,
        c3Hover,
        EditorView.lineWrapping,
        EditorView.updateListener.of(update => {
          if (update.docChanged || update.selectionSet || update.focusChanged) {
            updateColorPalette(update.view);
          }

          if (!update.docChanged || syncing) return;

          syncing = true;
          writeTextareaValue(update.state.doc.toString());
          syncing = false;
          dispatchTextareaInput();
        })
      ]
    })
  });
}

function setSyntaxError(lineNumber, message = "", token = "") {
  syntaxErrorLine = Number(lineNumber) || null;
  syntaxErrorMessage = String(message || "");
  syntaxErrorToken = String(token || "");
  if (!editorView) return;

  editorView.dispatch({ effects: [] });

  if (syntaxErrorLine) {
    const line = editorView.state.doc.line(Math.min(syntaxErrorLine, editorView.state.doc.lines));
    const tokenIndex = syntaxErrorToken ? line.text.indexOf(syntaxErrorToken) : -1;
    editorView.dispatch({
      selection: { anchor: line.from + Math.max(0, tokenIndex) },
      scrollIntoView: true
    });
  }
}

function clearSyntaxError() {
  setSyntaxError(null, "");
}

function showInnEditor() {
  const host = document.getElementById("innEditor");
  if (!host || !textarea) return false;

  textarea.style.display = "none";
  host.style.display = "block";
  document.body.classList.add("inn-editor-active");
  setEditorText(readTextareaValue());
  return true;
}

function hideInnEditor() {
  const host = document.getElementById("innEditor");
  if (host) host.style.display = "none";
  hideColorPalette();
  document.body.classList.remove("inn-editor-active");
}

function updateVisualViewportVars() {
  const vv = window.visualViewport;
  const keyboardInset = vv
    ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    : 0;

  document.documentElement.style.setProperty("--keyboard-inset", `${keyboardInset}px`);
  document.body.classList.toggle("keyboard-open", keyboardInset > 80);
}

function keepEditorVisible() {
  const host = document.getElementById("innEditor");
  if (!host || host.style.display === "none") return;

  setTimeout(() => {
    updateVisualViewportVars();
    editorView?.requestMeasure();
  }, 80);
}

let contextCompletionTimer = null;

function tokenHasCompletionContext() {
  if (!editorView) return false;

  const pos = editorView.state.selection.main.head;
  const token = tokenAround(editorView.state, pos);
  if (!token.text) return false;

  const valueSeparator = token.text.search(/[=.]/);
  if (valueSeparator >= 0 && token.cursor > valueSeparator) return true;
  if (/^(?:m|mat)\.[^ \t]*$/i.test(token.text.slice(0, token.cursor))) return true;
  if (/^(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.[a-z]*$/i.test(token.text.slice(0, token.cursor))) return true;
  if (/^(?:(?:sl|sr|ls|rs|bo|de|rw|fr|eb|mw)\.)?(?:cut|teilen|tei|dre|reihe|wid|copy|kop|sta|aus|zen)\.[xyz]*$/i.test(token.text.slice(0, token.cursor))) return true;

  const before = editorView.state.sliceDoc(Math.max(0, pos - 1), pos);
  return /\s/.test(before);
}

function scheduleContextCompletion() {
  clearTimeout(contextCompletionTimer);
  contextCompletionTimer = setTimeout(() => {
    if (completionStatus(editorView.state)) return;
    if (tokenHasCompletionContext()) startCompletion(editorView);
  }, 120);
}

function setupMobileKeyboardHandling() {
  updateVisualViewportVars();

  const vv = window.visualViewport;
  vv?.addEventListener("resize", updateVisualViewportVars);
  vv?.addEventListener("scroll", updateVisualViewportVars);
  window.addEventListener("orientationchange", () => setTimeout(updateVisualViewportVars, 250));

  const host = document.getElementById("innEditor");
  host?.addEventListener("mouseup", scheduleContextCompletion);
  host?.addEventListener("touchend", scheduleContextCompletion);
  host?.addEventListener("keyup", event => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      scheduleContextCompletion();
    }
  });

}

async function initCodeMirrorEditor() {
  textarea = document.getElementById("inn");
  if (!textarea || editorView) return;

  await window.colorsReady;
  await loadCommands();
  patchTextareaValue();
  createEditor();
  setupMobileKeyboardHandling();
  window.setInnSyntaxError = setSyntaxError;
  window.clearInnSyntaxError = clearSyntaxError;
  window.showInnEditor = showInnEditor;
  window.hideInnEditor = hideInnEditor;
  window.syncInnEditorFromTextarea = () => setEditorText(readTextareaValue());
  window.insertIntoInnEditor = insertIntoInnEditor;

  if (window.CURRENT_STATE === "inn" || window.currentState === "inn") {
    showInnEditor();
  }

  if (window.pendingInnSyntaxError) {
    const { line, message, token } = window.pendingInnSyntaxError;
    showInnEditor();
    setSyntaxError(line, message, token);
  }
}

initCodeMirrorEditor().catch(err => {
  console.warn("CodeMirror konnte nicht gestartet werden:", err);
});
