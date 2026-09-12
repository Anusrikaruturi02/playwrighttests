/**
 * push-to-elastic.js
 * Reads test-results/results.json and indexes each Playwright test result
 * into Elasticsearch with correct keyword mapping (fixes Kibana Pass Rate %).
 *
 * Env vars:
 *   ELASTIC_URL      - e.g. https://my-cluster.es.us-east4.gcp.elastic.cloud
 *   ELASTIC_API_KEY  - API key (leave empty for local no-auth cluster)
 *   GITHUB_RUN_ID    - set automatically by GitHub Actions
 *   GITHUB_REF_NAME  - branch name, set automatically
 *   GITHUB_SHA       - commit SHA, set automatically
 */

const fs    = require("fs");
const http  = require("http");
const https = require("https");
const path  = require("path");

const ELASTIC_URL     = process.env.ELASTIC_URL     || "http://localhost:9200";
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY || "";
const INDEX           = "playwright-results";
const resultsFile     = path.join(__dirname, "..", "test-results", "results.json");

// ── Guard ─────────────────────────────────────────────────────────
if (!fs.existsSync(resultsFile)) {
  console.error("ERROR: test-results/results.json not found. Did the tests run?");
  process.exit(1);
}

// ── Read results ──────────────────────────────────────────────────
let raw;
try {
  raw = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
} catch (e) {
  console.error("ERROR: Could not parse results.json:", e.message);
  process.exit(1);
}

const runId  = process.env.GITHUB_RUN_ID   || ("local-" + Date.now());
const branch = process.env.GITHUB_REF_NAME || "local";
const commit = process.env.GITHUB_SHA      || "unknown";
const ts     = new Date().toISOString();

// ── Flatten suites → docs ──────────────────────────────────────────
const docs = [];

function walk(suites, parentTitle) {
  parentTitle = parentTitle || "";
  for (const suite of (suites || [])) {
    const suiteTitle = parentTitle
      ? parentTitle + " > " + suite.title
      : suite.title;

    for (const spec of (suite.specs || [])) {
      for (const testItem of (spec.tests || [])) {
        // Use FIRST result (initial attempt) for status
        const result = (testItem.results || [])[0] || {};
        const retries = Math.max(0, (testItem.results || []).length - 1);

        docs.push({
          "@timestamp" : ts,
          run_id       : String(runId),
          branch       : String(branch),
          commit       : String(commit),
          suite        : String(suiteTitle),
          test         : String(spec.title),
          status       : String(result.status || "unknown"),
          duration_ms  : Number(result.duration   || 0),
          retries      : Number(retries),
          worker_index : Number(result.workerIndex != null ? result.workerIndex : 0),
          file         : String(spec.file || ""),
          error        : result.error
            ? String(result.error.message || result.error || "").substring(0, 500)
            : null,
        });
      }
    }

    walk(suite.suites, suiteTitle);
  }
}

walk(raw.suites);

if (docs.length === 0) {
  console.warn("WARNING: No test documents found in results.json");
  process.exit(0);
}

// ── HTTP helper ───────────────────────────────────────────────────
const esUrl    = new URL(ELASTIC_URL);
const useHttps = esUrl.protocol === "https:";
const driver   = useHttps ? https : http;

function esRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data    = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (ELASTIC_API_KEY)
      headers["Authorization"] = "ApiKey " + ELASTIC_API_KEY;
    if (data)
      headers["Content-Length"] = Buffer.byteLength(data);

    const req = driver.request(
      {
        hostname : esUrl.hostname,
        port     : esUrl.port || (useHttps ? 443 : 80),
        path     : urlPath,
        method,
        headers,
      },
      res => {
        let raw = "";
        res.on("data", c => (raw += c));
        res.on("end",  () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Create index with keyword mapping (if not exists) ─────────────
// This ensures status is stored as "keyword" so Kibana KQL filters
// like status: "passed" work correctly and Pass Rate % is not 0%.
async function ensureIndex() {
  const check = await esRequest("HEAD", "/" + INDEX, null);
  if (check.status === 200) {
    console.log("Index exists: " + INDEX);
    return;
  }

  console.log("Creating index with keyword mapping: " + INDEX);
  const res = await esRequest("PUT", "/" + INDEX, {
    mappings: {
      properties: {
        "@timestamp" : { type: "date"    },
        run_id       : { type: "keyword" },
        branch       : { type: "keyword" },
        commit       : { type: "keyword" },
        suite        : { type: "keyword" },
        test         : { type: "keyword" },
        status       : { type: "keyword" },  // ← exact match for KQL
        duration_ms  : { type: "integer" },
        retries      : { type: "integer" },
        worker_index : { type: "integer" },
        file         : { type: "keyword" },
        error        : { type: "text"    },
      },
    },
  });

  if (res.status >= 200 && res.status < 300) {
    console.log("Index created successfully.");
  } else {
    console.error("Failed to create index: HTTP " + res.status + " " + res.body);
    process.exit(1);
  }
}

// ── Index each doc ────────────────────────────────────────────────
async function indexDocs() {
  console.log(
    "\nIndexing " + docs.length + " test result(s) → " +
    ELASTIC_URL + "/" + INDEX + "\n"
  );

  let ok = 0, fail = 0;

  for (const doc of docs) {
    try {
      const res = await esRequest("POST", "/" + INDEX + "/_doc", doc);
      if (res.status >= 200 && res.status < 300) {
        console.log("  [" + (doc.status || "?").padEnd(8) + "] " + doc.suite + " › " + doc.test);
        ok++;
      } else {
        console.error("  FAIL HTTP " + res.status + ": " + res.body.substring(0, 150));
        fail++;
      }
    } catch (e) {
      console.error("  NETWORK ERROR: " + e.message);
      fail++;
    }
  }

  const passed = docs.filter(d => d.status === "passed").length;
  const total  = docs.length;
  const rate   = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

  console.log("\n─────────────────────────────────");
  console.log("Indexed : " + ok + " / " + total);
  console.log("Errors  : " + fail);
  console.log("Pass Rate: " + rate + "% (" + passed + "/" + total + " passed)");
  console.log("─────────────────────────────────\n");

  if (fail > 0) process.exit(1);
}

async function main() {
  await ensureIndex();
  await indexDocs();
}

main().catch(e => { console.error(e); process.exit(1); });
