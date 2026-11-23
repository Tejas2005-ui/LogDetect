import {
  WINDOW_MS, accountKey, isHttpFailure, loginOutcome, scoreEvent, ruleNames,
} from "../../../server/services/loginRules.mjs";

// Rows are in event-time order, so each timestamp enters and leaves a queue once.
function recentCount(map, key, now, add) {
  if (!key) return 0;
  let queue = map.get(key);
  if (!queue) {
    if (!add) return 0;
    queue = { times: [], start: 0 };
    map.set(key, queue);
  }
  while (queue.start < queue.times.length && queue.times[queue.start] < now - WINDOW_MS) queue.start++;
  if (queue.start > 128 && queue.start * 2 >= queue.times.length) {
    queue.times = queue.times.slice(queue.start);
    queue.start = 0;
  }
  if (add) queue.times.push(now);
  return queue.times.length - queue.start;
}

export function scanRows(rows) {
  const events = [...rows].sort((a, b) => a.time - b.time || a.row - b.row);
  const accounts = new Map(), sources = new Map(), httpSources = new Map();
  const openGroups = new Map(), findings = [];
  const analyzed = events.map((event) => {
    const failed = loginOutcome(event) === "failure";
    const analysis = scoreEvent(event, {
      account: recentCount(accounts, accountKey(event), event.time, failed),
      source: recentCount(sources, event.source, event.time, failed),
      http: recentCount(httpSources, event.source, event.time, isHttpFailure(event)),
    });
    const record = { ...event, ...analysis };
    if (!record.isAnomaly) return record;

    const { field, rule, time } = record;
    const subject = field ? record[field] : record.account || record.source;
    const key = JSON.stringify([rule, field, field ? subject : record.row]);
    let group = openGroups.get(key);
    if (!group || time - group.end > WINDOW_MS) {
      group = {
        id: findings.length + 1, rule, title: ruleNames[rule], field, subject,
        start: field ? time - WINDOW_MS : time, firstFlag: time, end: time,
        rows: new Set(), reason: "", score: 0,
      };
      findings.push(group);
      openGroups.set(key, group);
    }
    group.end = time;
    group.endRow = record.row;
    group.rows.add(record.row);
    group.reason = record.anomalyReason;
    group.score = Math.max(group.score, record.anomalyScore);
    record.findingId = group.id;
    return record;
  });
  return { events: analyzed, findings: findings.sort((a, b) => b.end - a.end || b.id - a.id) };
}

export function evidenceFor(finding, events) {
  return events.filter((row) => {
    if (finding.rows.has(row.row)) return true;
    if (!finding.field || row.time < finding.start || row.time > finding.end) return false;
    if (row.time === finding.end && row.row > finding.endRow) return false;
    if (row[finding.field] !== finding.subject) return false;
    return finding.rule === "httpBurst" ? isHttpFailure(row) : row.outcome === "failure";
  });
}
