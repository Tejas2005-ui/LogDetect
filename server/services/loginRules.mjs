export const WINDOW_MS = 5 * 60 * 1000;
export const MIN_FAILURES = 5;
export const SCORE_THRESHOLD = 60;

export const ruleNames = {
  burst: "Repeated login failures",
  recovery: "Success after failures",
  httpBurst: "Repeated HTTP failures",
  weighted: "High-risk application event",
};

export function accountKey(log) {
  // Login identifiers can be case-sensitive in the originating application.
  return String(log.account || "").trim();
}

export function isHttpFailure(log) {
  const code = Number(log.statusCode);
  return code === 401 || code === 403 || (code >= 500 && code <= 599);
}

export function loginOutcome(log) {
  if (log.outcome === "success" || log.outcome === "failure") return log.outcome;
  if (!/(?:log[\s_/-]*(?:in|on)|sign[\s_/-]*in|authenticat(?:e|ion)|\/auth(?:\/|$))/i.test(log.eventType || "")) {
    return "other";
  }
  const code = Number(log.statusCode);
  if (code === 401 || code === 403) return "failure";
  if (code >= 200 && code < 300) return "success";
  return "other";
}

// Counts include this event only when it is itself a failure.
export function scoreEvent(log, counts = {}) {
  const code = Number(log.statusCode);
  const severity = String(log.severity || "").toLowerCase();
  const outcome = loginOutcome(log);
  const reasons = [];
  let score = 0;
  let rule = "weighted";
  let field = null;
  let failures = 0;

  if (code >= 500 && code <= 599) {
    score += 45;
    reasons.push("HTTP " + code + " server error");
  }
  if (outcome === "failure" || code === 401 || code === 403) {
    score += 30;
    reasons.push(outcome === "failure" ? "Login failed" : "Access denied");
  }
  if (severity === "critical" || severity === "error") {
    score += severity === "critical" ? 40 : 20;
    reasons.push(severity === "critical" ? "Critical severity" : "Error severity");
  }

  if (outcome === "failure" || outcome === "success") {
    if (log.account && counts.account >= MIN_FAILURES) {
      field = "account";
    } else if ((outcome === "failure" || !log.account) && log.source && counts.source >= MIN_FAILURES) {
      field = "source";
    }
  }
  if (field) {
    failures = counts[field];
    rule = outcome === "success" ? "recovery" : "burst";
    score += outcome === "success" ? 70 : 35;
    const target = field === "account" ? "account " + log.account : "source " + log.source;
    const countText = failures + " failed logins for " + target + " within 5 minutes";
    reasons.push(outcome === "success" ? "Successful login after " + countText : countText);
  } else if (isHttpFailure(log) && counts.http >= MIN_FAILURES) {
    field = "source";
    failures = counts.http;
    rule = "httpBurst";
    score += 35;
    reasons.push(failures + " HTTP failures from " + log.source + " within 5 minutes");
  }

  return {
    outcome, anomalyScore: Math.min(score, 100), isAnomaly: score >= SCORE_THRESHOLD,
    anomalyReason: reasons.length ? reasons.join(". ") + "." : "No detection rule matched.",
    rule: score >= SCORE_THRESHOLD ? rule : null, field, failures,
  };
}
