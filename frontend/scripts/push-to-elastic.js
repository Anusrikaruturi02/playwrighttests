/**
 * push-to-elastic.js
 * Reads frontend/test-results/results.json and indexes each test result
 * into Elasticsearch with a correct keyword mapping (ensures Pass Rate
 * calculations work correctly in Kibana dashboards).
 *
 * Required env vars:
 *   ELASTIC_URL      e.g. https://my-cluster.es.io:9243
 *   ELASTIC_API_KEY  API key (leave empty for local no-auth cluster)
 */

const fs    = require("fs");
const http  = require("http");
const https = require("https");
const path  = require("path");

const ELASTIC_URL     = process.env.ELASTIC_URL     || "http://localhost:9200";
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY || "";
const INDEX           = "playwright-results";

const resultsFile = path.join(__dirname, "..", "test-results", "results.json");

if (!fs.existsSync(resultsFile)) {
  console.error("test-results/results.json not found. Did the tests run?");
  process.exit(1);
}

const raw     = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
const runId   = process.env.GITHUB_RUN_ID   || ("local-" + Date.now());
const branch  = process.env.GITHUB_REF_NAME || "local";
const commit  = process.env.GITHUB_SHA      || "unknown";
const ts      = new Date().toISOString();

// Flatten suites -> specs -> results
const docs = [];
function walk(suites, parentTitle) {
  parentTitle = parentTitle || "";
  for (const suite of (suites || [])) {
    const suiteTitle = parentTitle ? (parentTitle + " > " + suite.title) : suite.title;
    for (const spec of (suite.specs || [])) {
      for (const testItem of (spec.tests || [])) {
        const result = (testItem.results || [])[0] || {};
        docs.push({
          "@timestamp" : ts,
          run_id       : String(runId),
          branch       : String(branch),
          commit       : String(commit),
          suite        : String(suiteTitle),
          test         : String(spec.title),
          status       : String(result.status || "unknown"),
          duration_ms  : Number(result.duration  || 0),
          retries      : Number(result.retry      || 0),
          worker_index : Number(result.workerIndex != null ? result.workerIndex : 0),
          file         : String(spec.file || ""),
          error        : result.error ? String(result.error.message || "").substring(0, 500) : null,
        });
      }
    }
    walk(suite.suites, suiteTitle);
  }
}
walk(raw.suites);

if (docs.length === 0) {
  console.warn("No test documents found in results.json");
  process.exit(0);
}

// ── HTTP helper ───────────────────────────────────────────────────
const url      = new URL(ELASTIC_URL);
const useHttps = url.protocol === "https:";
const driver   = useHttps ? https : http;

function esRequest(method, pathStr, body) {
  return new Promise((resolve, reject) => {
    const data    = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (ELASTIC_API_KEY) headers["Authorization"] = "ApiKey " + ELASTIC_API_KEY;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);

    const req = driver.request({
      hostname : url.hostname,
      port     : url.port || (useHttps ? 443 : 80),
      path     : pathStr,
      method,
      headers,
    }, res => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Ensure index exists with keyword mapping ───────────────────────
async function ensureIndex() {
  const check = await esRequest("HEAD", "/" + INDEX, null);
  if (check.status === 200) {
    console.log("Index already exists: " + INDEX);
    return;
  }

  console.log("Creating index with keyword mapping: " + INDEX);
  const mapping = {
    mappings: {
      properties: {
        "@timestamp" : { type: "date" },
        run_id       : { type: "keyword" },
        branch       : { type: "keyword" },
        commit       : { type: "keyword" },
        suite        : { type: "keyword" },
        test         : { type: "keyword" },
        status       : { type: "keyword" },   // keyword = exact match in KQL
        duration_ms  : { type: "integer" },
        retries      : { type: "integer" },
        worker_index : { type: "integer" },
        file         : { type: "keyword" },
        error        : { type: "text" },
      },
    },
  };

  const res = await esRequest("PUT", "/" + INDEX, mapping);
  if (res.status >= 200 && res.status < 300) {
    console.log("Index created successfully.");
  } else {
    console.error("Failed to create index: HTTP " + res.status + " " + res.body);
    process.exit(1);
  }
}

// ── Index each test result ─────────────────────────────────────────
async function indexDocs() {
  console.log("Indexing " + docs.length + " test result(s) into " + ELASTIC_URL + "/" + INDEX);

  let passed = 0;
  let failed  = 0;

  for (const doc of docs) {
    try {
      const res = await esRequest("POST", "/" + INDEX + "/_doc", doc);
      if (res.status >= 200 && res.status < 300) {
        const statusPad = (doc.status || "").padEnd(7);
        console.log("  [" + statusPad + "] " + doc.suite + " > " + doc.test);
        passed++;
      } else {
        console.error("  Failed HTTP " + res.status + ": " + res.body.substring(0, 200));
        failed++;
      }
    } catch (e) {
      console.error("  Network error: " + e.message);
      failed++;
    }
  }

  console.log("\nDone: " + passed + " indexed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
}

async function main() {
  await ensureIndex();
  await indexDocs();
}

main().catch(e => { console.error(e); process.exit(1); });
