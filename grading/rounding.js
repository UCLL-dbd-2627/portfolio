// Rounding-tolerant comparison for columns where the question does not say how
// to round (e.g. an average). Used by run_tests.js for checks that list
// `roundingColumns` in checks.js.
//
// Idea: the answer key holds the value rounded to a certain number of decimals
// (say 4.17, i.e. 2). A student's value counts as correct if it is a valid
// rounding of the TRUE value, whatever the number of decimals they chose:
//   4        (rounded to 0 decimals)   -> accepted for key 4.17
//   4.2      (rounded to 1 decimal)    -> accepted for key 4.17
//   4.1667   (not rounded at all)      -> accepted for key 4.17
//   4.1 / 4.5 / 4.18                   -> rejected: not a rounding of 4.17
// So rounding is free, but a genuinely wrong average is still caught. (A flat
// "+/- 0.5" range would also accept wrong answers, so we don't use one.)

function decimals(s) {
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

const NUMBER = /^-?\d+(\.\d+)?$/;

function roundedMatch(actual, expected) {
  if (actual === expected) return true;
  if (actual === null || actual === undefined || expected === null || expected === undefined) return false;
  const a = String(actual).trim();
  const e = String(expected).trim();
  if (!NUMBER.test(a) || !NUMBER.test(e)) return false;
  const da = decimals(a);
  const de = decimals(e);
  if (da === de) return Number(a) === Number(e);
  const diff = Math.abs(Number(a) - Number(e));
  const eps = 1e-9;
  // Student rounded less (or not at all): key is round(true, de), so true is within half a unit of the key.
  if (da > de) return diff <= 0.5 * Math.pow(10, -de) + eps;
  // Student rounded more coarsely: allow for the key itself already being rounded.
  return diff <= 0.5 * Math.pow(10, -da) + 0.5 * Math.pow(10, -de) + eps;
}

// Returns a copy of `actual` where, in the listed columns, every value that is
// a valid rounding of the matching expected row's value is replaced by the
// expected value -- so the ordinary exact comparison (and the wrong-order /
// wrong-value hints) then work unchanged. Rows are matched on all OTHER
// columns, so row order does not matter for the matching.
function snapRounding(actual, expected, cols) {
  if (!cols || cols.length === 0) return actual;
  const rest = (r) =>
    JSON.stringify(Object.keys(r).filter((k) => !cols.includes(k)).sort().map((k) => [k, r[k]]));
  const pool = new Map();
  for (const e of expected) {
    const k = rest(e);
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k).push(e);
  }
  return actual.map((a) => {
    const candidates = pool.get(rest(a)) || [];
    const hit = candidates.find((e) => cols.every((c) => roundedMatch(a[c], e[c])));
    if (!hit) return a;
    const copy = { ...a };
    for (const c of cols) copy[c] = hit[c];
    return copy;
  });
}

module.exports = { roundedMatch, snapRounding };
