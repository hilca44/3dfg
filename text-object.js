const GLYPHS = {
  a:["01110","10001","10001","11111","10001","10001","10001"],
  b:["11110","10001","10001","11110","10001","10001","11110"],
  c:["01111","10000","10000","10000","10000","10000","01111"],
  d:["11110","10001","10001","10001","10001","10001","11110"],
  e:["11111","10000","10000","11110","10000","10000","11111"],
  f:["11111","10000","10000","11110","10000","10000","10000"],
  g:["01111","10000","10000","10111","10001","10001","01111"],
  h:["10001","10001","10001","11111","10001","10001","10001"],
  i:["11111","00100","00100","00100","00100","00100","11111"],
  j:["00111","00010","00010","00010","00010","10010","01100"],
  k:["10001","10010","10100","11000","10100","10010","10001"],
  l:["10000","10000","10000","10000","10000","10000","11111"],
  m:["10001","11011","10101","10101","10001","10001","10001"],
  n:["10001","11001","10101","10011","10001","10001","10001"],
  o:["01110","10001","10001","10001","10001","10001","01110"],
  p:["11110","10001","10001","11110","10000","10000","10000"],
  q:["01110","10001","10001","10001","10101","10010","01101"],
  r:["11110","10001","10001","11110","10100","10010","10001"],
  s:["01111","10000","10000","01110","00001","00001","11110"],
  t:["11111","00100","00100","00100","00100","00100","00100"],
  u:["10001","10001","10001","10001","10001","10001","01110"],
  v:["10001","10001","10001","10001","10001","01010","00100"],
  w:["10001","10001","10001","10101","10101","10101","01010"],
  x:["10001","10001","01010","00100","01010","10001","10001"],
  y:["10001","10001","01010","00100","00100","00100","00100"],
  z:["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],
  "1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00001","01110"],
  "_":["00000","00000","00000","00000","00000","00000","11111"],
  "-":["00000","00000","00000","11111","00000","00000","00000"]
};

const KORPUS_GLYPHS = {
  a: { p: "lrct" },
  b: { p: "lrgtc" },
  c: { p: "lgt" },
  d: "p=rgtl l.x=(h/10)" ,
  e: { p: "lgct" },
  f: { p: "lct" },
  g: "p=lcrgt r.u=-(h/2)t c.u=-(w/4)l",
  h: { p: "lrc" },
  i: { p: "lgt", w: 3, h: 7, advance: 4 },
  j: { p: "rgt" },
  k: { p: "lc" },
  l: { p: "lg" },
  m: { p: "lrc" },
  n: "p=lrv v.o=-29y" ,
  o: { p: "lrgt" },
  p: { p: "lrct" },
  q: { p: "lrgtc" },
  r: "p=lrtcv r.u=-(h/2)g v.u=-(h/2)t",
  s: "p=lrgct l.u=-(h/2)g r.u=-(h/2)t",
  t: { p: "tv" },
  u: { p: "lrg" },
  v: { p: "lrg" },
  w: { p: "lrgtc" },
  x: { p: "c" },
  y: { p: "rtc" },
  z: { p: "gt" },
  "0": { p: "lrgt" },
  "1": { p: "r", w: 3, h: 7 },
  "2": { p: "rgtc" },
  "3": { p: "rgtc" },
  "4": { p: "lrc" },
  "5": { p: "lgct" },
  "6": { p: "lgctr" },
  "7": { p: "rt" },
  "8": { p: "lrgtc" },
  "9": { p: "lrgtc" },
  "_": { p: "g" },
  "-": { p: "c" }
};

function safeNamePart(ch) {
  if (/^[a-z0-9]$/i.test(ch)) return ch.toLowerCase();
  if (ch === "_") return "us";
  if (ch === "-") return "mi";
  return "x";
}

function glyphRectangles(glyph) {
  const used = glyph.map(row => row.split("").map(() => false));
  const rects = [];

  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col] !== "1" || used[row][col]) continue;

      let maxW = 0;
      while (
        col + maxW < glyph[row].length &&
        glyph[row][col + maxW] === "1" &&
        !used[row][col + maxW]
      ) {
        maxW++;
      }

      let h = 1;
      while (row + h < glyph.length) {
        let ok = true;
        for (let x = 0; x < maxW; x++) {
          if (glyph[row + h][col + x] !== "1" || used[row + h][col + x]) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        h++;
      }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < maxW; x++) used[row + y][col + x] = true;
      }
      rects.push({ row, col, w: maxW, h });
    }
  }

  return rects;
}

function strokePart(rect) {
  return rect.w >= rect.h ? "g" : "l";
}

function cleanExpr(expr) {
  return String(expr ?? "").trim() || "H";
}

function cellExpr(heightExpr, factor = 1) {
  if (factor === 0) return "0";
  const base = `((${heightExpr})/7)`;
  return factor === 1 ? base : `(${base}*${factor})`;
}

function partSizeTokens(parts, sizeExpr) {
  return parts.split("").map(part => `${part}.s=${sizeExpr}`).join(" ");
}

function korpusGlyphSpec(def) {
  if (typeof def === "string") {
    const p = def.match(/(?:^|\s)p=([a-z]+)/i)?.[1] || "";
    const rest = def.replace(/(?:^|\s)p=[a-z]+/i, "").trim();
    return { p, rest };
  }
  return { ...def, rest: "" };
}

function materialOneThicknessNumber(project) {
  const value = Number(project.lm?.[1]?.s);
  if (Number.isFinite(value) && value > 0) return value;
  return Math.max(0, project.projectScalar("S", 0));
}

function parseTextPropertyLine(line) {
  const tokens = String(line ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const txtIndex = tokens.findIndex(token => /^txt[:=].+/i.test(token));
  if (txtIndex < 0) return null;

  const head = tokens[0];
  const text = tokens[txtIndex].replace(/^txt[:=]/i, "");
  const rest = tokens.filter((_, index) => index !== txtIndex);
  const getValue = key => {
    const token = rest.find(item => item.startsWith(`${key}=`));
    return token ? token.slice(key.length + 1) : "";
  };

  return {
    head,
    text,
    tokens: rest.slice(1),
    w: getValue("w"),
    d: getValue("d"),
    h: getValue("h")
  };
}

function lineTokenWithout(tokens, keys) {
  return tokens.filter(token => !keys.some(key => token.startsWith(`${key}=`)));
}

function glyphLine({
  name,
  glyph,
  widthExpr,
  depthExpr,
  heightExpr,
  sizeExpr,
  connect,
  comment
}) {
  const spec = korpusGlyphSpec(glyph);
  const partSizes = partSizeTokens(spec.p, sizeExpr);
  const rest = spec.rest ? ` ${spec.rest}` : "";
  return `${name} p=${spec.p} w=${widthExpr} d=${depthExpr} h=${heightExpr} s=${sizeExpr} ${partSizes}${rest}${connect} z=0 #${comment}`;
}

function visibleGlyphCount(text) {
  let count = 0;
  for (const ch of text) {
    if (KORPUS_GLYPHS[ch]) count++;
  }
  return count;
}

export function expandTextObjectLine(project, line) {
  const prop = parseTextPropertyLine(line);
  if (prop) {
    const text = prop.text.toLowerCase();
    const widthExpr = cleanExpr(prop.w || prop.h || "H");
    const depthExpr = cleanExpr(prop.d || "S");
    const heightExpr = cleanExpr(prop.h || prop.w || "H");
    const letterGap = materialOneThicknessNumber(project);
    const glyphCount = Math.max(1, visibleGlyphCount(text));
    const glyphWidthExpr = glyphCount > 1
      ? `((${widthExpr})-${project.roundExprNumber(letterGap * (glyphCount - 1))})/${glyphCount}`
      : widthExpr;
    const sizeExpr = `(${glyphWidthExpr})/7`;
    const anchorTokens = lineTokenWithout(prop.tokens, ["w", "d", "h", "p"]);
    const lines = [
      `${prop.head} p= w=${widthExpr} d=${depthExpr} h=${heightExpr}${anchorTokens.length ? ` ${anchorTokens.join(" ")}` : ""}`
    ];
    let emittedChars = 0;
    let pendingGap = 0;

    for (let charIndex = 0; charIndex < text.length; charIndex++) {
      const ch = text[charIndex];
      if (ch === " ") {
        pendingGap += project.projectScalar(widthExpr, 0) * 0.5 + letterGap;
        continue;
      }

      const glyph = KORPUS_GLYPHS[ch];
      if (!glyph) {
        pendingGap += project.projectScalar(widthExpr, 0) * 0.5 + letterGap;
        continue;
      }

      const name = `${prop.head}_txt${emittedChars}${safeNamePart(ch)}`;
      const gap = project.roundExprNumber((emittedChars ? letterGap : 0) + pendingGap);
      const connect = emittedChars ? ` i=3 x=${gap}` : " i=0 x=0";
      lines.push(glyphLine({
        name,
        glyph,
        widthExpr: glyphWidthExpr,
        depthExpr,
        heightExpr,
        sizeExpr,
        connect,
        comment: ch.toUpperCase()
      }));

      emittedChars++;
      pendingGap = 0;
    }

    return lines;
  }

  const match = String(line ?? "").trim().match(/^txt:([^,\s]+)(?:,([^\s]+))?/i);
  if (!match) return null;

  const text = match[1].toLowerCase();
  const heightExpr = cleanExpr(match[2] || "H");
  const height = Math.max(1, project.projectScalar(heightExpr, project.h || 20));
  const cell = height / 7;
  const letterGap = materialOneThicknessNumber(project);
  const prefix = `txt${project.textObjectIndex || 0}`;
  const lines = [];
  let charIndex = 0;
  let emittedChars = 0;
  let pendingGap = 0;

  for (const ch of text) {
    if (ch === " ") {
      pendingGap += cell * 4 + letterGap;
      charIndex++;
      continue;
    }

    const korpusGlyphDef = KORPUS_GLYPHS[ch];
    if (korpusGlyphDef) {
      const korpusGlyph = korpusGlyphSpec(korpusGlyphDef);
      const name = `${prefix}_${charIndex}${safeNamePart(ch)}`;
      const gw = korpusGlyph.w || 7;
      const gh = korpusGlyph.h || 7;
      const gap = project.roundExprNumber((emittedChars ? letterGap : 0) + pendingGap);
      const connect = emittedChars ? ` i=3 x=${gap}` : " x=0";
      const w = cellExpr(heightExpr, gw);
      const h = cellExpr(heightExpr, gh);
      const s = cellExpr(heightExpr);
      const partSizes = partSizeTokens(korpusGlyph.p, s);
      const rest = korpusGlyph.rest ? ` ${korpusGlyph.rest}` : "";
      lines.push(`${name} p=${korpusGlyph.p} w=${w} d=S h=${h} s=${s} ${partSizes}${rest}${connect} z=0 #${ch.toUpperCase()}`);
      emittedChars++;
      pendingGap = 0;
      charIndex++;
      continue;
    }

    const glyph = GLYPHS[ch];
    if (!glyph) {
      pendingGap += cell * 4 + letterGap;
      charIndex++;
      continue;
    }

    let strokeIndex = 0;
    for (const rect of glyphRectangles(glyph)) {
      const part = strokePart(rect);
      const name = `${prefix}_${charIndex}${safeNamePart(ch)}_${strokeIndex++}`;
      const charGap = (emittedChars ? letterGap : 0) + pendingGap;
      const x = project.roundExprNumber(charGap + rect.col * cell);
      const z = cellExpr(heightExpr, glyph.length - rect.row - rect.h);
      const w = cellExpr(heightExpr, rect.w);
      const h = cellExpr(heightExpr, rect.h);
      const s = cellExpr(heightExpr);
      const connect = emittedChars || strokeIndex > 1 ? " i=3" : "";
      lines.push(`${name} p=${part} w=${w} d=S h=${h} s=${s} ${part}.s=${s}${connect} x=${x} z=${z} #${ch.toUpperCase()}`);
    }

    emittedChars++;
    pendingGap = 0;
    charIndex++;
  }

  project.textObjectIndex = (project.textObjectIndex || 0) + 1;
  return lines;
}
