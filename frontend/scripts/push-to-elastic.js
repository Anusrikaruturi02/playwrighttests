/**
 * push-to-elastic.js
 *
 * Reads:
 *   test-results/results.json
 *
 * and indexes each Playwright test result into Elasticsearch.
 *
 * Required environment variables:
 *
 *   ELASTIC_URL
 *     Example:
 *       https://my-cluster.es.io:9243
 *
 *   ELASTIC_API_KEY
 *     Elasticsearch API key.
 *     Leave empty for a local Elasticsearch instance.
 *
 * Optional:
 *
 *   GITHUB_RUN_ID
 *   GITHUB_REF_NAME
 *   GITHUB_SHA
 *   NODE_ENV
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const ELASTIC_URL =
  process.env.ELASTIC_URL || "http://localhost:9200";

const ELASTIC_API_KEY =
  process.env.ELASTIC_API_KEY || "";

const INDEX = "playwright-results";

const resultsFile = path.join(
  __dirname,
  "..",
  "test-results",
  "results.json"
);

// ─────────────────────────────────────────────────────────────
// Check results file
// ─────────────────────────────────────────────────────────────

if (!fs.existsSync(resultsFile)) {
  console.error(
    "ERROR: test-results/results.json not found."
  );

  console.error(
    "Run the Playwright tests before running this script."
  );

  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Read Playwright results
// ─────────────────────────────────────────────────────────────

let raw;

try {
  raw = JSON.parse(
    fs.readFileSync(resultsFile, "utf8")
  );
} catch (error) {
  console.error(
    "ERROR: Unable to read results.json"
  );

  console.error(error.message);

  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Run information
// ─────────────────────────────────────────────────────────────

const runId =
  process.env.GITHUB_RUN_ID ||
  "local-" + Date.now();

const branch =
  process.env.GITHUB_REF_NAME ||
  "local";

const commit =
  process.env.GITHUB_SHA ||
  "unknown";

const environment =
  process.env.NODE_ENV ||
  "test";

const timestamp =
  new Date().toISOString();

// ─────────────────────────────────────────────────────────────
// Flatten Playwright suites
// ─────────────────────────────────────────────────────────────

const docs = [];

function walk(suites, parentTitle = "") {
  for (const suite of suites || []) {

    const suiteTitle =
      parentTitle
        ? `${parentTitle} > ${suite.title}`
        : suite.title;

    // ─────────────────────────────────────────────
    // Specs
    // ─────────────────────────────────────────────

    for (const spec of suite.specs || []) {

      for (const testItem of spec.tests || []) {

        // Playwright may contain multiple attempts/retries.
        // We use the last result because it represents
        // the final attempt.

        const results =
          testItem.results || [];

        const result =
          results.length > 0
            ? results[results.length - 1]
            : {};

        const status =
          result.status || "unknown";

        let errorMessage = null;

        if (result.error) {

          if (typeof result.error === "string") {

            errorMessage =
              result.error.substring(0, 1000);

          } else {

            errorMessage =
              String(
                result.error.message || ""
              ).substring(0, 1000);
          }
        }

        docs.push({

          "@timestamp": timestamp,

          run_id: String(runId),

          branch: String(branch),

          commit: String(commit),

          environment: String(environment),

          suite: String(suiteTitle || ""),

          test: String(spec.title || ""),

          status: String(status),

          duration_ms:
            Number(result.duration || 0),

          retries:
            Number(
              testItem.results
                ? Math.max(
                    0,
                    testItem.results.length - 1
                  )
                : 0
            ),

          worker_index:
            Number(
              result.workerIndex != null
                ? result.workerIndex
                : 0
            ),

          file:
            String(
              spec.file ||
              testItem.location?.file ||
              ""
            ),

          error:
            errorMessage
        });
      }
    }

    // ─────────────────────────────────────────────
    // Nested suites
    // ─────────────────────────────────────────────

    walk(
      suite.suites,
      suiteTitle
    );
  }
}

walk(raw.suites);

// ─────────────────────────────────────────────────────────────
// Check documents
// ─────────────────────────────────────────────────────────────

if (docs.length === 0) {

  console.warn(
    "WARNING: No test documents found in results.json"
  );

  process.exit(0);
}

// ─────────────────────────────────────────────────────────────
// Local statistics
// ─────────────────────────────────────────────────────────────

const passedTests =
  docs.filter(
    doc => doc.status === "passed"
  ).length;

const failedTests =
  docs.filter(
    doc => doc.status === "failed"
  ).length;

const skippedTests =
  docs.filter(
    doc =>
      doc.status === "skipped" ||
      doc.status === "disabled"
  ).length;

const totalTests =
  docs.length;

const passRate =
  totalTests > 0
    ? ((passedTests / totalTests) * 100).toFixed(1)
    : "0.0";

console.log("");
console.log("────────────────────────────────────");
console.log("Playwright Test Results");
console.log("────────────────────────────────────");

console.log(
  `Total   : ${totalTests}`
);

console.log(
  `Passed  : ${passedTests}`
);

console.log(
  `Failed  : ${failedTests}`
);

console.log(
  `Skipped : ${skippedTests}`
);

console.log(
  `Pass %  : ${passRate}%`
);

console.log("────────────────────────────────────");
console.log("");

// ─────────────────────────────────────────────────────────────
// Elasticsearch connection
// ─────────────────────────────────────────────────────────────

let elasticUrl;

try {

  elasticUrl =
    new URL(ELASTIC_URL);

} catch (error) {

  console.error(
    "ERROR: Invalid ELASTIC_URL:"
  );

  console.error(ELASTIC_URL);

  process.exit(1);
}

const useHttps =
  elasticUrl.protocol === "https:";

const driver =
  useHttps
    ? https
    : http;

// ─────────────────────────────────────────────────────────────
// Elasticsearch request helper
// ─────────────────────────────────────────────────────────────

/**
 * Sends a request to Elasticsearch.
 *
 * For normal JSON requests:
 *   body is converted using JSON.stringify()
 *
 * For NDJSON requests such as /_bulk:
 *   body is sent exactly as provided.
 */
function esRequest(
  method,
  pathStr,
  body = null,
  contentType = "application/json"
) {

  return new Promise(
    (resolve, reject) => {

      let data = null;

      if (body !== null) {

        if (
          contentType ===
          "application/x-ndjson"
        ) {

          // IMPORTANT:
          // Elasticsearch Bulk API requires
          // raw NDJSON, NOT JSON.stringify(body).

          data = body;

        } else {

          data =
            JSON.stringify(body);
        }
      }

      const headers = {
        "Content-Type":
          contentType
      };

      if (ELASTIC_API_KEY) {

        headers.Authorization =
          "ApiKey " +
          ELASTIC_API_KEY;
      }

      if (data) {

        headers["Content-Length"] =
          Buffer.byteLength(data);
      }

      const request =
        driver.request(
          {
            hostname:
              elasticUrl.hostname,

            port:
              elasticUrl.port ||
              (useHttps ? 443 : 80),

            path:
              pathStr,

            method:
              method,

            headers:
              headers
          },

          response => {

            let responseBody = "";

            response.on(
              "data",
              chunk => {
                responseBody += chunk;
              }
            );

            response.on(
              "end",
              () => {

                resolve({
                  status:
                    response.statusCode,

                  body:
                    responseBody
                });
              }
            );
          }
        );

      request.on(
        "error",
        reject
      );

      if (data) {
        request.write(data);
      }

      request.end();
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Create Elasticsearch index
// ─────────────────────────────────────────────────────────────

async function ensureIndex() {

  const check =
    await esRequest(
      "HEAD",
      "/" + INDEX
    );

  // Index already exists

  if (check.status === 200) {

    console.log(
      `Index already exists: ${INDEX}`
    );

    return;
  }

  // Unexpected error checking index

  if (
    check.status !== 404
  ) {

    console.error(
      `ERROR checking index: HTTP ${check.status}`
    );

    console.error(
      check.body
    );

    process.exit(1);
  }

  console.log(
    `Creating index: ${INDEX}`
  );

  // IMPORTANT:
  // status MUST be keyword for KQL / ESQL
  // exact matching.

  const mapping = {

    mappings: {

      properties: {

        "@timestamp": {
          type: "date"
        },

        run_id: {
          type: "keyword"
        },

        branch: {
          type: "keyword"
        },

        commit: {
          type: "keyword"
        },

        environment: {
          type: "keyword"
        },

        suite: {
          type: "keyword"
        },

        test: {
          type: "keyword"
        },

        status: {
          type: "keyword"
        },

        duration_ms: {
          type: "long"
        },

        retries: {
          type: "integer"
        },

        worker_index: {
          type: "integer"
        },

        file: {
          type: "keyword"
        },

        error: {
          type: "text"
        }
      }
    }
  };

  const response =
    await esRequest(
      "PUT",
      "/" + INDEX,
      mapping
    );

  if (
    response.status >= 200 &&
    response.status < 300
  ) {

    console.log(
      "Index created successfully."
    );

  } else {

    console.error(
      `ERROR creating index: HTTP ${response.status}`
    );

    console.error(
      response.body
    );

    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// Bulk index documents
// ─────────────────────────────────────────────────────────────

async function indexDocs() {

  console.log(
    `Indexing ${docs.length} test result(s)...`
  );

  const bulkBody = [];

  for (const doc of docs) {

    // Bulk API action line

    bulkBody.push(
      JSON.stringify({
        index: {
          _index: INDEX
        }
      })
    );

    // Document line

    bulkBody.push(
      JSON.stringify(doc)
    );
  }

  /**
   * Elasticsearch Bulk API expects NDJSON:
   *
   * action
   * document
   * action
   * document
   *
   * IMPORTANT:
   * The complete request MUST end with \n
   */

  const body =
    bulkBody.join("\n") +
    "\n";

  const response =
    await esRequest(
      "POST",
      "/_bulk",
      body,
      "application/x-ndjson"
    );

  if (
    response.status < 200 ||
    response.status >= 300
  ) {

    console.error(
      `ERROR: Elasticsearch bulk request failed: HTTP ${response.status}`
    );

    console.error(
      response.body
    );

    process.exit(1);
  }

  let parsed;

  try {

    parsed =
      JSON.parse(response.body);

  } catch (error) {

    console.error(
      "ERROR: Could not parse Elasticsearch response."
    );

    console.error(
      response.body
    );

    process.exit(1);
  }

  // Elasticsearch can return HTTP 200
  // while individual bulk operations fail.

  if (parsed.errors) {

    console.error(
      "WARNING: Some documents failed to index."
    );

    let failedCount = 0;

    for (
      const item of parsed.items || []
    ) {

      const operation =
        item.index;

      if (
        operation &&
        operation.error
      ) {

        failedCount++;

        console.error(
          JSON.stringify(
            operation.error,
            null,
            2
          )
        );
      }
    }

    console.error(
      `Failed documents: ${failedCount}`
    );

    process.exit(1);
  }

  console.log(
    `Successfully indexed ${docs.length} document(s).`
  );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {

  console.log(
    `Elasticsearch: ${ELASTIC_URL}`
  );

  console.log(
    `Index: ${INDEX}`
  );

  await ensureIndex();

  await indexDocs();

  console.log("");
  console.log(
    "Dashboard data is ready in Elasticsearch."
  );
  console.log("");
}

main().catch(
  error => {

    console.error(
      "Unexpected error:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);
