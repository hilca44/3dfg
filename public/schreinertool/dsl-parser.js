export function splitDslList(value) {
  return String(value ?? "")
    .split(",")
    .map(part => part.trim());
}

export function splitDslPath(value) {
  return String(value ?? "")
    .split(".")
    .map(part => part.trim());
}

export function splitDslWords(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function splitLegacyCompactChars(value) {
  return String(value ?? "").split("");
}
