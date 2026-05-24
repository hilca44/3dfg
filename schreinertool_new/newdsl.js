export function parseNewDsl(text) {
  const db = {
    blocks: {}
  };

  const lines = text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const tokens = line.split(/\s+/);
    const id = tokens.shift();

    if (!id) continue;

    if (!db.blocks[id]) {
      db.blocks[id] = makeBlock(id);
    }

    for (const tok of tokens) {
      applyToken(db, id, tok);
    }
  }

  resolveCopies(db);
  resolvePositions(db);
  expandParts(db);

  return db;
}

/* -------------------------------------------------- */
/* BLOCK                                              */
/* -------------------------------------------------- */

function makeBlock(id) {
  return {
    id,

    w: 0,
    d: 0,
    h: 0,

    x: 0,
    y: 0,
    z: 0,

    p: "",

    relation: null,
    target: null,

    copy: null
  };
}

/* -------------------------------------------------- */
/* PARSER                                             */
/* -------------------------------------------------- */

function applyToken(db, id, tok) {
  const b = db.blocks[id];

  if (tok.startsWith("w.")) b.w = num(tok);
  else if (tok.startsWith("d.")) b.d = num(tok);
  else if (tok.startsWith("h.")) b.h = num(tok);

  else if (tok.startsWith("x.")) b.x = num(tok);
  else if (tok.startsWith("y.")) b.y = num(tok);
  else if (tok.startsWith("z.")) b.z = num(tok);

  else if (tok.startsWith("p.")) b.p = tok.slice(2);

  else if (tok.startsWith("copy.")) {
    b.copy = tok.slice(5);
  }

  else if (tok.startsWith("right.")) setRel(b, "right", tok.slice(6));
  else if (tok.startsWith("left.")) setRel(b, "left", tok.slice(5));
  else if (tok.startsWith("top.")) setRel(b, "top", tok.slice(4));
  else if (tok.startsWith("above.")) setRel(b, "above", tok.slice(6));
  else if (tok.startsWith("front.")) setRel(b, "front", tok.slice(6));
  else if (tok.startsWith("back.")) setRel(b, "back", tok.slice(5));

  else {
    console.warn("unknown token:", tok, "in", id);
  }
}

function setRel(b, rel, target) {
  b.relation = rel;
  b.target = target;
}

function num(tok) {
  return Number(tok.split(".").pop().replace(",", "."));
}

/* -------------------------------------------------- */
/* COPY                                               */
/* -------------------------------------------------- */

function resolveCopies(db) {
  for (const b of Object.values(db.blocks)) {
    if (!b.copy) continue;

    const src = db.blocks[b.copy];
    if (!src) {
      console.warn("copy target missing:", b.copy);
      continue;
    }

    const own = { ...b };

    Object.assign(b, structuredClone(src), own);

    b.id = own.id;
  }
}

/* -------------------------------------------------- */
/* POSITION                                           */
/* -------------------------------------------------- */

function resolvePositions(db) {
  let changed = true;
  let safety = 0;

  while (changed && safety++ < 20) {
    changed = false;

    for (const b of Object.values(db.blocks)) {
      if (!b.relation || !b.target) continue;

      const t = db.blocks[b.target];
      if (!t) continue;

      const before = `${b.x},${b.y},${b.z}`;

      if (b.relation === "right") {
        b.x = t.x + t.w;
        b.y = t.y;
        b.z = t.z;
      }

      if (b.relation === "left") {
        b.x = t.x - b.w;
        b.y = t.y;
        b.z = t.z;
      }

      if (b.relation === "top") {
        b.x = t.x;
        b.y = t.y;
        b.z = t.z + t.h;
      }

      if (b.relation === "above") {
        b.x = t.x;
        b.y = t.y;
      }

      if (b.relation === "front") {
        b.x = t.x;
        b.y = t.y - b.d;
        b.z = t.z;
      }

      if (b.relation === "back") {
        b.x = t.x;
        b.y = t.y + t.d;
        b.z = t.z;
      }

      const after = `${b.x},${b.y},${b.z}`;
      if (before !== after) changed = true;
    }
  }
}

/* -------------------------------------------------- */
/* PARTS                                              */
/* -------------------------------------------------- */

function expandParts(db) {
  const newBlocks = {};

  for (const b of Object.values(db.blocks)) {
    if (!b.p) continue;

    const t = 2; // Standardstärke

    if (b.p.includes("l")) {
      newBlocks[b.id + "_l"] = part(b, 0, 0, 0, t, b.h, b.d);
    }

    if (b.p.includes("r")) {
      newBlocks[b.id + "_r"] = part(b, b.w - t, 0, 0, t, b.h, b.d);
    }

    if (b.p.includes("g")) {
      newBlocks[b.id + "_g"] = part(b, 0, 0, 0, b.w, t, b.d);
    }

    if (b.p.includes("t")) {
      newBlocks[b.id + "_t"] = part(b, 0, 0, b.h - t, b.w, t, b.d);
    }

    if (b.p.includes("b")) {
      newBlocks[b.id + "_b"] = part(b, 0, b.d - t, 0, b.w, b.h, t);
    }

    if (b.p.includes("c")) {
      newBlocks[b.id + "_c"] = part(b, 0, 0, b.h / 2, b.w, t, b.d);
    }
  }

  Object.assign(db.blocks, newBlocks);
}

function part(parent, ox, oy, oz, w, h, d) {
  return {
    id: parent.id + "_part_" + Math.random().toString(36).slice(2, 6),

    w,
    h,
    d,

    x: parent.x + ox,
    y: parent.y + oy,
    z: parent.z + oz
  };
}