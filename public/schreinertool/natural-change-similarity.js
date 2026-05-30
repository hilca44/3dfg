export function normalizeNaturalChangeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/\b(schrank|korpus|regal|moebel|mobel)(breite|tiefe|hoehe|hohe|hoch|breit|tief)\b/g, "$1 $2")
    .replace(/\bpunkt\b/g, ".")
    .replace(/[._-]+/g, " ")
    .replace(/[^\p{L}\p{N},]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function naturalAliasWords(value) {
  return normalizeNaturalChangeText(value).split(/\s+/).filter(Boolean);
}

export function findNaturalAlias(text, rows) {
  const textWords = naturalAliasWords(text);
  const matches = rows
    .map(([key, aliases]) => {
      const score = naturalAliasWords(`${key} ${aliases}`).reduce((sum, word) => (
        sum + naturalAliasWordScore(word, textWords)
      ), 0);
      return { key, score };
    })
    .filter((entry) => entry.score >= 0.78)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { key: "", ambiguous: false };
  const best = matches[0].score;
  const tied = matches.filter((entry) => Math.abs(entry.score - best) < 0.12);
  return {
    key: tied.length === 1 ? tied[0].key : "",
    ambiguous: tied.length > 1,
    choices: tied.map((entry) => entry.key)
  };
}

function naturalAliasWordScore(aliasWord, textWords) {
  const word = normalizeNaturalChangeText(aliasWord);
  if (!word || !textWords.length) return 0;

  return textWords.reduce((best, textWord) => {
    if (word === textWord) return Math.max(best, 1);
    if (word.length <= 2 || textWord.length <= 2) return best;

    const score = fuzzyTokenScore(textWord, word);
    return Math.max(best, score >= 0.78 ? score : 0);
  }, 0);
}

function fuzzyTokenScore(queryToken, textToken) {
  if (!queryToken || !textToken) return 0;
  if (queryToken === textToken) return 1;
  if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) return 0.86;
  if (textToken.includes(queryToken) || queryToken.includes(textToken)) return 0.72;
  if (isSubsequence(queryToken, textToken)) return 0.58;

  const distance = levenshteinDistance(queryToken, textToken);
  const maxLength = Math.max(queryToken.length, textToken.length);
  if (maxLength <= 2) return 0;
  return Math.max(0, 1 - distance / maxLength);
}

function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function levenshteinDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const cur = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : Math.min(prev[j - 1], prev[j], cur[j - 1]) + 1;
    }
    prev.splice(0, prev.length, ...cur);
  }

  return prev[b.length];
}
