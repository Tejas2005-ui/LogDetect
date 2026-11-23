const { WINDOW_MS, accountKey, isHttpFailure, loginOutcome, scoreEvent } = require("./loginRules.mjs");

async function analyzeLog(Log, log) {
  const at = log.timestamp == null ? new Date() : new Date(log.timestamp);
  if (!Number.isFinite(at.getTime())) throw new Error("Timestamp must be a valid date.");
  const account = accountKey(log);
  const source = String(log.source || "").trim();
  const event = { ...log, account, source };
  const outcome = loginOutcome(event);
  const counts = { account: 0, source: 0, http: 0 };
  const subjects = [];
  if (account) subjects.push({ account });
  if (source) subjects.push({ source });

  if (subjects.length && (outcome !== "other" || isHttpFailure(event))) {
    const history = Log.find({
      timestamp: { $gte: new Date(at.getTime() - WINDOW_MS), $lte: at },
      $or: subjects,
    }).select("account source eventType statusCode outcome").lean().cursor();

    for await (const previous of history) {
      if (loginOutcome(previous) === "failure") {
        if (account && accountKey(previous) === account) counts.account += 1;
        if (source && previous.source === source) counts.source += 1;
      }
      if (source && previous.source === source && isHttpFailure(previous)) counts.http += 1;
    }
  }
  if (outcome === "failure") {
    if (account) counts.account += 1;
    if (source) counts.source += 1;
  }
  if (source && isHttpFailure(event)) counts.http += 1;
  const { anomalyScore, anomalyReason, isAnomaly } = scoreEvent(event, counts);
  return { anomalyScore, anomalyReason, isAnomaly };
}

module.exports = analyzeLog;
