/**
 * push-to-elastic.js
 * Reads frontend/test-results/results.json and indexes each test
 * result as a document into Elasticsearch.
 *
 * Required env vars:
 *   ELASTIC_URL      e.g. http://localhost:9200  (or Elastic Cloud endpoint)
 *   ELASTIC_API_KEY  API key (leave empty for local no-auth cluster)
 */

const fs   = require('fs');
const http  = require('http');
const https = require('https');
const path  = require('path');

const ELASTIC_URL     = process.env.ELASTIC_URL     || 'http://localhost:9200';
const ELASTIC_API_KEY = process.env.ELASTIC_API_KEY || '';
const INDEX           = 'playwright-results';

const resultsFile = path.join(__dirname, '..', 'test-results', 'results.json');

if (!fs.existsSync(resultsFile)) {
  console.error('? test-results/results.json not found. Did the tests run?');
  process.exit(1);
}

const raw     = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const runId   = process.env.GITHUB_RUN_ID    || `local-${Date.now()}`;
const branch  = process.env.GITHUB_REF_NAME  || 'local';
const commit  = process.env.GITHUB_SHA       || 'unknown';
const ts      = new Date().toISOString();

// Flatten suites ? specs ? results into one doc per test
const docs = [];
function walk(suites, parentTitle = '') {
  for (const suite of suites || []) {
    const suiteTitle = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[0] || {};
        docs.push({
          '@timestamp' : ts,
          run_id       : runId,
          branch       : branch,
          commit       : commit,
          suite        : suiteTitle,
          test         : spec.title,
          status       : result.status || 'unknown',
          duration_ms  : result.duration || 0,
          retries      : result.retry || 0,
          worker_index : result.workerIndex ?? 0,
          file         : spec.file || '',
          error        : result.error?.message?.substring(0, 500) || null,
        });
      }
    }
    walk(suite.suites, suiteTitle);
  }
}
walk(raw.suites);

if (docs.length === 0) {
  console.warn('??  No test documents found in results.json');
  process.exit(0);
}

console.log(`?? Indexing ${docs.length} test result(s) into ${ELASTIC_URL}/${INDEX}`);

const url      = new URL(ELASTIC_URL);
const useHttps = url.protocol === 'https:';
const driver   = useHttps ? https : http;

let done = 0;
let failed = 0;

docs.forEach(doc => {
  const data = JSON.stringify(doc);
  const headers = {
    'Content-Type'   : 'application/json',
    'Content-Length' : Buffer.byteLength(data),
  };
  if (ELASTIC_API_KEY) headers['Authorization'] = `ApiKey ${ELASTIC_API_KEY}`;

  const req = driver.request(
    {
      hostname : url.hostname,
      port     : url.port || (useHttps ? 443 : 80),
      path     : `/${INDEX}/_doc`,
      method   : 'POST',
      headers,
    },
    res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        done++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ? [${doc.status.padEnd(7)}] ${doc.suite} › ${doc.test}`);
        } else {
          failed++;
          console.error(`  ? HTTP ${res.statusCode}: ${body.substring(0, 200)}`);
        }
        if (done === docs.length) {
          console.log(`\n?? Done: ${done - failed} indexed, ${failed} failed.`);
          if (failed > 0) process.exit(1);
        }
      });
    }
  );

  req.on('error', e => {
    failed++;
    done++;
    console.error(`  ? Network error: ${e.message}`);
    if (done === docs.length) {
      console.log(`\n?? Done: ${done - failed} indexed, ${failed} failed.`);
      process.exit(1);
    }
  });

  req.write(data);
  req.end();
});
