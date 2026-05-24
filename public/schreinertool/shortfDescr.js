const COLOR_NAMES = {
  wh: "weiss",
  bl: "blau",
  re: "rot",
  oc: "ocker"
};

const PART_NAMES = {
  b: "rueckwand",
  c: "mitte",
  f: "front",
  g: "unten",
  l: "links",
  r: "rechts",
  t: "oben",
  v: "steg",
  a: "korpus"
};

function parseAssignments(inn) {

  const out = [];
  const lines = inn.split(/\r?\n/);

  for (const line of lines) {
    const propertyMatches = line.matchAll(/\b([a-z]+)\.(?:m|mat)[=.](\d+)/gi);
    for (const m of propertyMatches) {
      out.push({
        part: m[1].toLowerCase(),
        materialId: Number(m[2])
      });
    }

    const matches = line.match(/m([a-z]+)(\d+)/gi);
    if (!matches) continue;

    for (const token of matches) {

      const m = token.match(/^m([a-z]+)(\d+)$/i);
      if (!m) continue;

      out.push({
        part: m[1].toLowerCase(),
        materialId: Number(m[2])
      });
    }
  }

  return out;
}

function extractDims(inn) {

  const m = inn.match(/\b(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\b/);
  if (!m) return null;

  return {
    w: m[1],
    d: m[2],
    h: m[3]
  };
}


function parseMaterials(inn) {

  const materials = {};
  const lines = inn.split(/\r?\n/);
  let nextIndex = 1;

  for (const line of lines) {
    const oldStyle = line.match(/^m(\d+)\s*,\s*([\d.]+)\s*,\s*([a-z]+)/i);
    if (oldStyle) {
      materials[Number(oldStyle[1])] = {
        thickness: Number(oldStyle[2]),
        color: oldStyle[3].toLowerCase()
      };
      nextIndex = Math.max(nextIndex, Number(oldStyle[1]) + 1);
      continue;
    }

    const modernMaterialMatches = line.matchAll(/\b(?:m|mat)\.([\d.]+),([a-zäöüß_-]+)/gi);
    for (const m of modernMaterialMatches) {
      materials[nextIndex++] = {
        thickness: Number(m[1]),
        color: m[2].toLowerCase()
      };
    }

    const materialMatches = line.matchAll(/\bm([\d.]+)([a-z]{1,2})([a-z])?[\d.,]*/gi);
    for (const m of materialMatches) {
      materials[nextIndex++] = {
        thickness: Number(m[1]),
        color: m[2].toLowerCase()
      };
    }
  }

  return materials;
}

function generateShortDescription(pr) {
  let inn = pr?.inn || "";
  if (!inn) return "";

  const mats = parseMaterials(inn);
  const assigns = parseAssignments(inn);
  const dims = extractDims(inn);
  const name = pr?.nme || inn.split(/\s+/)[0] || "projekt";

  let parts = [];

  if (pr?.bb?.x && pr?.bb?.y && pr?.bb?.z) {
    parts.push(
      `${name} ${Number(pr.bb.x).toFixed(1)}x${Number(pr.bb.y).toFixed(1)}x${Number(pr.bb.z).toFixed(1)} cm`
    );
  } else if (dims) {
    parts.push(
      `${name} ${dims.w}x${dims.d}x${dims.h} cm`
    );
  } else {
    parts.push(name);
  }

  for (const a of assigns) {

    const mat = mats[a.materialId];
    if (!mat) continue;

    const partName = PART_NAMES[a.part] || a.part;
    const color = COLOR_NAMES[mat.color] || mat.color;

    parts.push(
      `${partName} ${mat.thickness} mm ${color}`
    );
  }

  if (assigns.length === 0 && Array.isArray(pr?.lm)) {
    for (const mat of pr.lm.slice(1, 4)) {
      if (!mat) continue;
      const color = COLOR_NAMES[mat.co] || mat.co;
      const thickness = Number(mat.s) ? Number(mat.s) * 10 : mat.s;
      parts.push(`${thickness} mm ${color}`);
    }
  }

  return parts.join(", ").slice(0, 200);
}
