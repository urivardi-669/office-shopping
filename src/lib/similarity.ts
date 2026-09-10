function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter(Boolean);
}

// Levenshtein-based similarity ratio between 0 and 1.
function levenshteinRatio(a: string, b: string): number {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1 === s2) return 1;
  const m = s1.length;
  const n = s2.length;
  if (m === 0 || n === 0) return 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return 1 - dist / maxLen;
}

// Jaccard overlap: shared tokens over the union, so a single shared common word
// (e.g. "חלב") between otherwise unrelated products doesn't trigger a false match.
function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = new Set([...ta, ...tb]).size;
  return shared / union;
}

// One name fully contains the other as a whole word sequence, e.g.
// "חלב שקדים" vs "חלב שקדים 1 ליטר".
function isContainment(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length === 0 || nb.length === 0) return false;
  return na.includes(nb) || nb.includes(na);
}

export function isExactMatch(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function isSimilar(a: string, b: string): boolean {
  if (isExactMatch(a, b)) return true;
  if (isContainment(a, b)) return true;
  const lr = levenshteinRatio(a, b);
  const tr = tokenOverlapRatio(a, b);
  return lr >= 0.82 || tr >= 0.6;
}
