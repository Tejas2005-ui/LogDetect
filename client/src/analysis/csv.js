import Papa from "papaparse";
import { loginOutcome } from "../../../server/services/loginRules.mjs";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10000;
const aliases = {
  timestamp: ["timestamp", "time", "datetime", "eventtime", "logintime", "utctime"],
  account: ["account", "user", "username", "userid", "email", "accountid"],
  source: ["source", "ip", "ipaddress", "sourceip", "sourceipaddress", "clientip", "remoteaddr"],
  outcome: ["outcome", "result", "loginresult", "loginstatus", "authresult", "success"],
  status: ["status"], statusCode: ["statuscode", "httpstatus", "httpstatuscode", "httpcode"],
  eventType: ["eventtype", "event", "action", "methodpath"], severity: ["severity", "level", "loglevel"],
  message: ["message", "description", "detail"],
};
const fieldByHeader = new Map(Object.entries(aliases).flatMap(([field, names]) => names.map((name) => [name, field])));
const successValues = new Set(["success", "successful", "succeeded", "ok", "allowed", "passed", "true", "1"]);
const failureValues = new Set(["fail", "failed", "failure", "denied", "blocked", "rejected", "false", "0", "invalidcredentials", "invalidpassword"]);
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseTimestamp(value) {
  if (/^\d{10}$|^\d{13}$/.test(value)) return Number(value) * (value.length === 10 ? 1000 : 1);
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
  if (!parts) return NaN;
  const [, y, m, d, h, min, sec = "00", fraction = "", zone = "Z"] = parts;
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  if (+m < 1 || +m > 12 || +d < 1 || +d > lastDay || +h > 23 || +min > 59 || +sec > 59) return NaN;
  return Date.parse(y + "-" + m + "-" + d + "T" + h + ":" + min + ":" + sec + fraction.slice(0, 4) + zone);
}

function readRecord(values, row) {
  const time = parseTimestamp(values.timestamp || "");
  if (!Number.isFinite(time)) throw new Error("Use a valid ISO date and time or Unix timestamp.");
  if (!values.account && !values.source) throw new Error("Account or source IP is empty.");
  const generic = values.status || "";
  let codeText = values.statusCode || "";
  let outcomeText = values.outcome || "";
  if (/^\d{3}$/.test(generic)) {
    if (codeText && generic !== codeText) throw new Error("Conflicting HTTP status values.");
    codeText = generic;
  } else if (generic) {
    if (outcomeText && normalize(generic) !== normalize(outcomeText)) throw new Error("Conflicting login outcomes.");
    outcomeText = generic;
  }
  const statusCode = codeText ? Number(codeText) : null;
  if (codeText && (!/^\d{3}$/.test(codeText) || statusCode < 100 || statusCode > 599)) {
    throw new Error("HTTP status must be a number from 100 to 599.");
  }
  if (!outcomeText && !codeText) throw new Error("Login outcome or HTTP status is empty.");
  let outcome;
  if (outcomeText) {
    const text = normalize(outcomeText);
    if (successValues.has(text)) outcome = "success";
    else if (failureValues.has(text)) outcome = "failure";
    else if (text !== "other") throw new Error("Unknown login outcome “" + outcomeText.slice(0, 35) + "”.");
  }
  const severity = (values.severity || "info").toLowerCase().replace(/^warn$/, "warning");
  if (!["info", "warning", "error", "critical"].includes(severity)) throw new Error("Unknown severity “" + severity.slice(0, 35) + "”.");
  const event = {
    row, time, timestamp: new Date(time).toISOString(),
    account: values.account || "", source: values.source || "",
    eventType: values.eventType || "Login", statusCode, outcome,
    message: values.message || "", severity,
  };
  event.outcome = loginOutcome(event);
  return event;
}

export function parseCsv(text) {
  if (!text.trim()) throw new Error("This file is empty.");
  const parsed = Papa.parse(text.replace(/^\uFEFF/, ""), {
    delimiter: ",", skipEmptyLines: false, preview: MAX_ROWS + 3,
  });
  if (parsed.errors.length) {
    const error = parsed.errors[0];
    throw new Error("CSV record " + ((error.row ?? 0) + 1) + " has invalid quoting. Check quotes and commas.");
  }
  const [headers, ...records] = parsed.data;
  while (records.length && records.at(-1).every((cell) => !cell.trim())) records.pop();
  if (parsed.meta.truncated || records.length > MAX_ROWS) throw new Error("Choose a CSV with at most 10,000 records.");
  const columns = headers.map((header) => fieldByHeader.get(normalize(header)));
  const recognized = columns.filter(Boolean);
  if (new Set(recognized).size !== recognized.length) throw new Error("Two columns map to the same field. Keep one column per field.");
  if (!columns.includes("timestamp") || !["account", "source"].some((field) => columns.includes(field))
      || !["outcome", "status", "statusCode"].some((field) => columns.includes(field))) {
    throw new Error("Include a timestamp, an account or source IP, and an outcome or HTTP status. Download the sample to see the format.");
  }
  const rows = [], errors = [];
  for (const [index, cells] of records.entries()) {
    if (cells.every((cell) => !cell.trim())) continue;
    const row = index + 2;
    try {
      if (cells.length !== headers.length) throw new Error("Expected " + headers.length + " columns, found " + cells.length + ".");
      const values = Object.fromEntries(columns.flatMap((field, i) => field ? [[field, cells[i].trim()]] : []));
      rows.push(readRecord(values, row));
    } catch (error) {
      errors.push({ row, message: error.message });
    }
  }
  if (!rows.length && !errors.length) throw new Error("The file has a header but no login records.");
  return { rows, errors };
}

export function exportEvents(events) {
  const records = events.map(({ row, timestamp, account, source, eventType, statusCode, outcome, severity, message, isAnomaly, anomalyScore, anomalyReason }) => ({
    row, timestamp, account, source, eventType, statusCode, outcome, severity, message, isAnomaly, anomalyScore, anomalyReason,
  }));
  const csv = Papa.unparse(records, { escapeFormulae: /^[\t\r\n]|^\s*[=+\-@]/ });
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "logdetect-events.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
