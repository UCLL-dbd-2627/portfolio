// Runs every check in checks.js against a freshly reset database, using the
// SAME widget-execution code the live dashboard uses (backend/src/widgets.js)
// -- so grading can never drift from what students actually see running.
//
// Exports `executeCheck` as the single shared core both this file AND
// capture_fixtures.js build on -- one place that knows how to run a check
// and produce its result "slots" (one per fixture file it touches).
// run_tests.js compares those slots to frozen fixtures; capture_fixtures.js
// writes them AS the new fixtures. Neither duplicates the other's logic.
//
// Also exports `runChecks(filter)`. Run directly, it's also a CLI:
//   DATABASE_URL=postgres://... node run_tests.js [week/id]
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");

// The widgets/db modules live at ROOT/backend/src/... when ROOT is the repo
// root (CLI usage, or the standalone `grading` container, which mounts the
// whole repo). But when this file is required from INSIDE the backend
// container itself (the "Run full check" button's code path), that
// container's own app root has no nested backend/ folder -- its widgets.js
// is directly at ROOT/src/widgets. Check which layout actually exists on
// disk (not try/catch on the require -- that would also mask a real error,
// like a missing `npm install`, as if it were just the wrong path).
const usesNestedBackendLayout = fs.existsSync(path.join(ROOT, "backend/src/widgets.js"));
const widgetsPath = usesNestedBackendLayout ? path.join(ROOT, "backend/src/widgets") : path.join(ROOT, "src/widgets");
const dbPath = usesNestedBackendLayout ? path.join(ROOT, "backend/src/db") : path.join(ROOT, "src/db");
const { findWidget, runQueryWidget, runActionWidget, substituteParams } = require(widgetsPath);
const { pool } = require(dbPath);

const checks = require("./checks");
const { snapRounding } = require("./rounding");

const DB_URL = process.env.DATABASE_URL || "postgres://databasement:databasement@localhost:5432/databasement";

function psql(sql) {
  execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`, { stdio: "pipe" });
}

function psqlFile(file) {
  execSync(`psql "${DB_URL}" -v ON_ERROR_STOP=1 -f ${JSON.stringify(file)}`, { stdio: "pipe" });
}

// Runs a multi-statement SQL block by writing it to a temp file first, not
// via `psql -c`. A multi-line string passed through `-c` gets shell-escaped
// (JSON.stringify -> a shell command string), which turns real newlines
// into literal backslash-n text -- and \copy and other meta-commands need
// an actual newline to terminate, so that silently breaks. Writing to a
// real file sidesteps the whole shell-escaping question.
function runSqlScript(sqlText) {
  const tmpFile = path.join(os.tmpdir(), `reset-step-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sqlText);
  try {
    psqlFile(tmpFile);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function resetDb({ skipGeolocation = false } = {}) {
  psql("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE, CREATE ON SCHEMA public TO PUBLIC;");
  psqlFile(path.join(ROOT, "db/schema.sql"));
  const loadOrder = [
    "product_category_name_translation", "sellers", "products", "customers",
    "geolocation", "orders", "order_items", "order_payments", "order_reviews",
  ];
  // KEEP IN SYNC with db/load_seed.sh: sample is the default, full is opt-in.
  const wantFull = process.env.USE_FULL_DATASET === "true";
  const seedDir = wantFull && fs.existsSync(path.join(ROOT, "db/seed/full")) && fs.readdirSync(path.join(ROOT, "db/seed/full")).length
    ? path.join(ROOT, "db/seed/full")
    : path.join(ROOT, "db/seed/sample");
  for (const table of loadOrder) {
    // geolocation is ~1M rows and no check touches it -- skip it for
    // grading resets specifically (the live dashboard's own seed load in
    // db/load_seed.sh is unaffected and still loads it for students to
    // explore). This is the single biggest cost in a reset against the
    // real dataset.
    if (skipGeolocation && table === "geolocation") continue;

    const file = path.join(seedDir, `${table}.csv`);
    if (!fs.existsSync(file)) continue;

    if (table === "products") {
      // KEEP IN SYNC with db/load_seed.sh's "products" case. The real
      // Olist dataset has categories on products that are missing from
      // product_category_name_translation (e.g. "pc_gamer") -- load into a
      // staging table (no FK enforced), backfill, then insert for real.
      runSqlScript(`
        CREATE TEMP TABLE products_staging (LIKE products INCLUDING ALL);
        \\copy products_staging FROM '${file}' WITH (FORMAT csv, HEADER true, NULL '')

        INSERT INTO product_category_name_translation (product_category_name, product_category_name_english)
        SELECT DISTINCT product_category_name, product_category_name
        FROM products_staging
        WHERE product_category_name IS NOT NULL
        ON CONFLICT (product_category_name) DO NOTHING;

        INSERT INTO products SELECT * FROM products_staging;
      `);
    } else if (table === "order_reviews") {
      // KEEP IN SYNC with db/load_seed.sh's "order_reviews" case. The
      // real dataset has a handful of duplicate review_id rows -- load
      // into a staging table without the primary key, then keep the most
      // recently created row per review_id.
      runSqlScript(`
        CREATE TEMP TABLE order_reviews_staging (LIKE order_reviews INCLUDING DEFAULTS);
        \\copy order_reviews_staging FROM '${file}' WITH (FORMAT csv, HEADER true, NULL '')

        INSERT INTO order_reviews
        SELECT DISTINCT ON (review_id) *
        FROM order_reviews_staging
        ORDER BY review_id, review_creation_date DESC NULLS LAST, review_answer_timestamp DESC NULLS LAST;
      `);
    } else {
      psql(`\\copy ${table} FROM '${file}' WITH (FORMAT csv, HEADER true, NULL '')`);
    }
  }
}

function loadExpected(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "expected", relPath), "utf8"));
}

// Postgres driver returns typed values (Date objects for timestamps, etc.)
// but fixtures are plain JSON. Round-trip both sides through JSON so a
// timestamp compares equal to its own ISO string instead of failing on type.
function normalize(rows) {
  return JSON.parse(JSON.stringify(rows));
}

// Resolves a check/case's params: either a literal `params` object (fixed
// values, fine when a widget doesn't depend on any specific row existing),
// or a `paramsQuery` (a SELECT run fresh against the CURRENT seed data,
// whose first row's columns become the params) -- this is what lets
// widgets like "process a refund" or "log in as this customer" work
// against ANY dataset (the small sample, the real ~99k-order data, or
// anything else) without a hardcoded ID that only exists in one of them.
async function resolveParams(client, entry) {
  if (entry.paramsQuery) {
    const { rows } = await client.query(entry.paramsQuery);
    if (rows.length === 0) {
      throw new Error(`paramsQuery returned no rows: ${entry.paramsQuery}`);
    }
    return rows[0];
  }
  return entry.params || {};
}

// The single shared core: runs one check against a freshly reset DB, and
// returns its result as a list of "slots" -- one per fixture file this
// check touches. run_tests.js compares each slot's rows to the frozen
// fixture; capture_fixtures.js writes each slot's rows AS the new fixture.
// Neither of those two files re-implements how a check actually runs.
// Deadlocks between two concurrent things resetting/touching the same
// database (e.g. someone runs `make test` from the CLI while the "Run full
// check" button is still mid-flight from the browser) are real but
// transient -- Postgres always picks a victim transaction and rolls it
// back, so the other side just needs to retry, not treat it as a genuine
// failure. Only retries on Postgres's actual deadlock code (40P01); any
// other error still fails immediately, same as before.
async function executeCheck(check, opts = {}) {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await executeCheckOnce(check, opts);
    } catch (err) {
      const isDeadlock = err && err.code === "40P01";
      if (!isDeadlock || attempt === MAX_ATTEMPTS) throw err;
      const backoffMs = 200 * attempt + Math.floor(Math.random() * 200);
      console.log(`  (deadlock detected on ${check.week}/${check.id}, retrying in ${backoffMs}ms -- attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

async function executeCheckOnce(check, { skipReset = false } = {}) {
  if (!skipReset) resetDb({ skipGeolocation: !check.needsGeolocation });
  const widget = findWidget(check.week, check.id);
  if (!widget) throw new Error(`widget not found in widgets.yaml: ${check.week}/${check.id}`);

  const slots = [];

  if (!check.action) {
    const result = await runQueryWidget(widget);
    if (!result.ok) throw new Error(result.error || "query failed");
    slots.push({ expected: check.expected, rows: result.rows });
  } else if (check.cases) {
    for (const c of check.cases) {
      const client = await pool.connect();
      let params;
      try {
        params = await resolveParams(client, c);
      } finally {
        client.release();
      }
      const result = await runActionWidget(widget, params);
      if (!result.ok) throw new Error(result.error || "action failed");
      if (c.expected) {
        slots.push({ expected: c.expected, rows: result.rows });
      } else if (c.countQuery) {
        const client2 = await pool.connect();
        const { rows } = await client2.query(c.countQuery);
        client2.release();
        slots.push({ countCheck: true, actualCount: result.rows.length, expectedCount: rows[0].n });
      }
    }
  } else {
    const client = await pool.connect();
    let params;
    try {
      params = await resolveParams(client, check);
    } finally {
      client.release();
    }
    const result = await runActionWidget(widget, params);
    if (!result.ok) throw new Error(result.error || "action failed");
    const client2 = await pool.connect();
    try {
      for (const v of check.verify || []) {
        const sql = substituteParams(v.sql, params, Object.keys(params));
        const r = await client2.query(sql);
        slots.push({ expected: v.expected, rows: r.rows });
      }
    } finally {
      client2.release();
    }
  }

  return slots;
}

// Turns a failed comparison into a short, student-friendly hint instead of
// assert.deepStrictEqual's raw diff (which can run to hundreds of lines and
// prints the full expected result). Deliberately says WHERE the result is
// wrong (row count / columns / ordering / first differing cell and your own
// value) but never prints the expected values -- the student still has to
// work out the fix. Returns null when the two match.
function explainMismatch(actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    return null;
  } catch (_) { /* fall through to a readable explanation */ }

  if (actual.length !== expected.length) {
    return `Row count is off: your query returned ${actual.length} rows, expected ${expected.length}. ` +
      `Check your joins, filters and any LIMIT / FETCH FIRST.`;
  }
  const cols = (rows) => (rows[0] ? Object.keys(rows[0]) : []);
  const ac = cols(actual), ec = cols(expected);
  if (ac.join(",") !== ec.join(",")) {
    return `Columns don't match. Expected: ${ec.join(", ")}. Yours: ${ac.join(", ")}. ` +
      `Check column names, order and aliases.`;
  }
  const key = (r) => JSON.stringify(r);
  const sameSet = [...actual].map(key).sort().join("|") === [...expected].map(key).sort().join("|");
  if (sameSet) {
    return `All the right rows, but in the wrong order. Check your ORDER BY (including tie-breakers).`;
  }
  for (let i = 0; i < actual.length; i++) {
    for (const c of ec) {
      if (JSON.stringify(actual[i][c]) !== JSON.stringify(expected[i][c])) {
        return `Row ${i + 1} differs in column "${c}" (your value: ${JSON.stringify(actual[i][c])}). ` +
          `Check rounding, grouping keys, NULL handling and ordering.`;
      }
    }
  }
  return "Result does not match the expected result.";
}

async function runChecks(filter) {
  const toRun = filter ? checks.filter((c) => `${c.week}/${c.id}` === filter) : checks;
  if (filter && toRun.length === 0) {
    throw new Error(`no check matches "${filter}"`);
  }

  const results = [];
  let needsReset = true; // always reset before the first check
  let geolocationLoaded = false; // tracks what's ACTUALLY loaded right now,
  // separate from needsReset -- the "skip reset between consecutive
  // non-action checks" optimization below assumes any query-type check can
  // run against whatever the last reset left behind, which was true right
  // up until a check that specifically needs geolocation existed: that
  // check must never silently inherit a reset an earlier, unrelated check
  // triggered with skipGeolocation.

  for (const check of toRun) {
    const label = `${check.week}/${check.id}`;
    const wantsGeolocation = !!check.needsGeolocation;
    const mustReset = needsReset || (wantsGeolocation && !geolocationLoaded);
    try {
      const slots = await executeCheck(check, { skipReset: !mustReset });
      if (mustReset) geolocationLoaded = wantsGeolocation;
      // Only action-type checks mutate anything -- a query check can never
      // contaminate what runs after it, so only force a reset if this
      // check just did (or might have, if it failed partway through).
      needsReset = !!check.action;
      for (const slot of slots) {
        if (slot.countCheck) {
          if (slot.actualCount !== slot.expectedCount) {
            throw new Error(`Row count is off: your query returned ${slot.actualCount} rows, expected ${slot.expectedCount}.`);
          }
        } else {
          const expected = loadExpected(slot.expected);
          // Columns listed in check.roundingColumns accept any valid rounding
          // (see rounding.js); check.hint is extra guidance shown on failure.
          const hint = explainMismatch(
            snapRounding(normalize(slot.rows), normalize(expected), check.roundingColumns),
            normalize(expected)
          );
          if (hint) throw new Error(check.hint ? `${hint} ${check.hint}` : hint);
        }
      }
      results.push({ label, pass: true });
    } catch (err) {
      needsReset = true; // be safe: an error might mean a partial mutation happened
      results.push({ label, pass: false, error: err.message });
    }
  }

  // Grading's own reset-skipping optimizations (fewer resets, skipping
  // geolocation when nothing about to run needs it) are only valid DURING
  // the run -- they say nothing about what state the database should be
  // left in once grading is done. But this is the same database a
  // student's live dashboard reads from, and whatever check happened to
  // run last determines what's sitting there afterward otherwise (e.g. an
  // action check with skipGeolocation leaves geolocation empty for anyone
  // who looks at the dashboard next, with zero connection to anything
  // actually being wrong). Always leave a complete, nothing-skipped
  // database behind when grading finishes, regardless of what ran last.
  resetDb();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  return { results, passed, failed };
}

module.exports = {
  runChecks, executeCheck, resetDb, psql, psqlFile, runSqlScript, loadExpected, normalize, ROOT, DB_URL,
  findWidget, runQueryWidget, runActionWidget, pool,
};

if (require.main === module) {
  (async () => {
    const filter = process.argv[2];
    const { results, passed, failed } = await runChecks(filter);
    for (const r of results) {
      console.log((r.pass ? "PASS  " : "FAIL  ") + r.label);
      if (!r.pass) console.log("      " + r.error);
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
