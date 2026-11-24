import assert from "node:assert/strict";
import test from "node:test";
import { scanRows } from "../src/analysis/scan.js";
import { forgetUpload, rememberUpload, restoreUpload } from "../src/analysis/tabUpload.js";

function tabStorage(limit = Infinity) {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (value.length > limit) throw new DOMException("Storage full", "QuotaExceededError");
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
  };
}

const header = "timestamp,username,ip_address,outcome,message";
const fiveLogins = [header, ...Array.from({ length: 5 }, (_, i) =>
  ["2026-11-23T10:0" + i + ":00Z", "demo.user", "192.0.2.10", "failure", ""].join(","))].join("\n");

test("refresh restores the five uploaded events, the filename and the original record numbers", () => {
  const storage = tabStorage();
  assert.equal(restoreUpload(storage), null);
  rememberUpload("five.csv", fiveLogins + "\ninvalid,user,,failure,", storage);
  const restored = restoreUpload(storage);
  assert.equal(restored.name, "five.csv");
  assert.equal(restored.rows.length, 5);
  assert.deepEqual(restored.errors.map((error) => error.row), [7]);
  assert.deepEqual(scanRows(restored.rows).events.filter((event) => event.isAnomaly).map((event) => event.row), [6]);
});

test("the latest analysis replaces the previous upload, even for the same filename", () => {
  const storage = tabStorage();
  rememberUpload("data.csv", fiveLogins, storage);
  rememberUpload("data.csv", header + "\n2026-11-23T11:00:00Z,another.user,,success,", storage);
  assert.deepEqual(restoreUpload(storage).rows.map((event) => event.account), ["another.user"]);
  assert.equal(restoreUpload(tabStorage()), null);
});

test("loading the sample clears the upload for subsequent refreshes", () => {
  const storage = tabStorage();
  rememberUpload("five.csv", fiveLogins, storage);
  forgetUpload(storage);
  assert.equal(restoreUpload(storage), null);
});

test("a file that exceeds the plain-text quota can be restored from its compressed copy", () => {
  const storage = tabStorage(500);
  const message = "évidence, ".repeat(700);
  rememberUpload("logins.csv", header + '\n2026-11-23T11:00:00Z,demo.user,,failure,"' + message + '"', storage);
  assert.equal(restoreUpload(storage).rows[0].message, message.trim());
});

test("a failed replacement cannot restore an older upload", () => {
  const storage = tabStorage(100);
  rememberUpload("a.csv", "time,user,result\n2020-01-01T00:00Z,a,success", storage);
  const varied = Array.from({ length: 300 }, (_, i) => "field-" + i).join(" ");
  assert.throws(() => rememberUpload("larger.csv", fiveLogins + varied, storage), { name: "QuotaExceededError" });
  assert.equal(restoreUpload(storage), null);
});

test("damaged or unreadable saved files do not reach the detector", () => {
  for (const value of ["{", "{}", "~broken", JSON.stringify({ name: "bad.csv", csv: header })]) {
    assert.throws(() => restoreUpload({ getItem: () => value }));
  }
});
