import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_ROWS, parseCsv } from "../src/analysis/csv.js";
import { evidenceFor, scanRows } from "../src/analysis/scan.js";

const header = "timestamp,username,ip_address,outcome\n";
const epoch = Date.parse("2020-01-01T12:00:00Z");
const row = (second, account = "sam", ip = "192.0.2.1", outcome = "failure") =>
  [new Date(epoch + second * 1000).toISOString(), account, ip, outcome].join(",");
function scan(lines) {
  const parsed = parseCsv(header + lines.join("\n"));
  assert.deepEqual(parsed.errors, []);
  return scanRows(parsed.rows);
}

test("the downloadable sample produces four evidence groups", () => {
  const { rows, errors } = parseCsv(readFileSync(new URL("../src/data/sample-logins.csv", import.meta.url), "utf8"));
  const { events, findings } = scanRows(rows);
  assert.deepEqual([rows.length, errors.length, events.filter((e) => e.outcome === "failure").length,
    events.filter((e) => e.isAnomaly).length, findings.length], [142, 0, 21, 6, 4]);
  assert.equal(evidenceFor(findings[0], events).length, 6);
});

test("historical unsorted input retains CSV record numbers and uses event time", () => {
  const { events, findings } = scan([row(301, "sam", "192.0.2.1", "success"), ...[1, 50, 100, 150, 200].map((t) => row(t))]);
  assert.deepEqual(events.filter((e) => e.isAnomaly).map((e) => [e.row, e.rule, e.anomalyScore]), [[7, "burst", 65], [2, "recovery", 70]]);
  assert.deepEqual(evidenceFor(findings[0], events).map((r) => r.row), [3, 4, 5, 6, 7, 2]);
});
test("window includes the exact boundary and expires older failures", () => {
  assert.equal(scan([0, 1, 2, 3, 300].map((t) => row(t))).findings.length, 1);
  assert.equal(scan([0, 1, 2, 3, 301].map((t) => row(t))).findings.length, 0);
});
test("a successful login does not count as the fifth failure", () => {
  const result = scan([...Array.from({length:4}, (_, i) => row(i)), row(5, "sam", "192.0.2.1", "success")]);
  assert.equal(result.findings.length, 0);
});
test("a shared IP can trigger a failure burst but does not implicate a different successful account", () => {
  const lines = Array.from({ length: 5 }, (_, i) => row(i, "user-" + i));
  const { events, findings } = scan([...lines, row(7, "innocent", "192.0.2.1", "success")]);
  assert.equal(findings[0].field, "source");
  assert.equal(events.at(-1).isAnomaly, false);
});
test("account failures can span IPs and a burst is grouped", () => {
  const { events, findings } = scan(Array.from({ length: 8 }, (_, i) => row(i, "sam", "192.0.2." + (i + 1))));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rows.size, 4);
  assert.equal(evidenceFor(findings[0], events).length, 8);
});
test("same-timestamp evidence respects original file order", () => {
  const { findings, events } = scan([...Array.from({ length: 5 }, (_, i) => row(i)), row(4, "sam", "192.0.2.1", "success"), row(4)]);
  assert.equal(evidenceFor(findings.find((f) => f.rule === "recovery"), events).length, 6);
});
test("legacy exports, BOM, quoted commas, newlines and offsets are supported", () => {
  const csv = '\uFEFFtimestamp,eventType,source,severity,statusCode,message\r\n2020-01-01T17:30:00+05:30,POST /api/login,192.0.2.1,error,500,"error,\r\nretry"\r\n';
  const { rows, errors } = parseCsv(csv);
  assert.deepEqual(errors, []);
  const [event] = scanRows(rows).events;
  assert.equal(event.time, epoch); assert.equal(event.anomalyScore, 65); assert.equal(event.outcome, "other");
  assert.equal(event.message, "error,\r\nretry");
});
test("general HTTP failures retain weighted scoring without treating an unrelated successful API call as a login", () => {
  const csv = "timestamp,eventType,source,statusCode\n" + [500, 501, 403, 401, 502, 200].map((code, i) => [new Date(epoch + i * 1000).toISOString(), "GET /api/orders", "192.0.2.2", code].join(",")).join("\n");
  const { events, findings } = scanRows(parseCsv(csv).rows);
  assert.equal(findings[0].rule, "httpBurst"); assert.equal(events.at(-1).anomalyScore, 0);
});
test("bad records are reported by number, blank records are skipped, invalid dates are rejected", () => {
  const { rows, errors } = parseCsv(header + [row(1), "", "2026-02-30T10:00:00Z,alice,,success", "2020-01-01T00:00Z,,,success", "x,too,few"].join("\n"));
  assert.equal(rows.length, 1); assert.deepEqual(errors.map((e) => e.row), [4,5,6]);
});
test("rejects invalid file structure and accepts exactly the advertised limit", () => {
  for (const input of ["", "time,user,result\n", "time,foo\na,b", header + '"unterminated', "time,user,username,status\nx,a,b,200"]) {
    assert.throws(() => parseCsv(input));
  }
  const full = (row(1) + "\n").repeat(MAX_ROWS);
  assert.equal(parseCsv(header + full).rows.length, MAX_ROWS);
  assert.throws(() => parseCsv(header + full + row(2)), /10,000/);
});
