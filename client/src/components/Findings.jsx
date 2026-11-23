import { useState } from "react";
import { BadgeCheck, ChevronRight, Fingerprint, Layers3, ListChecks, ShieldAlert, ShieldCheck } from "lucide-react";
import { dateLabel, num, timeLabel } from "../analysis/format.js";
import { MIN_FAILURES, SCORE_THRESHOLD, WINDOW_MS } from "../../../server/services/loginRules.mjs";

function FindingIcon({ rule, size = 18 }) {
  const Icon = rule === "recovery" ? Fingerprint : rule === "burst" ? Layers3 : ShieldAlert;
  return <Icon size={size} />;
}

export function RecentFindings({ findings, onFinding, onAll }) {
  return <section className="findings-panel">
    <div className="rings" aria-hidden="true" />
    <header><div className="panel-title"><ShieldAlert size={18} /><h2>Latest findings</h2></div><span className="dark-count">{num(findings.length)}</span></header>
    <div className="latest-list">
      {findings.slice(0, 2).map((item) => <button key={item.id} className="latest-item" onClick={() => onFinding(item)}>
        <span className={"finding-glyph " + item.rule}><FindingIcon rule={item.rule} /></span>
        <span className="latest-copy"><strong>{item.title}</strong><small>{item.subject} <b>·</b> {timeLabel(item.end)} UTC</small></span>
        <ChevronRight size={15} /></button>)}
      {!findings.length && <div className="no-findings"><ShieldCheck size={22} /><strong>No findings</strong><span>No event reached the alert threshold.</span></div>}
    </div>
    <button className="dark-link" onClick={onAll}>Review findings <ChevronRight size={15} /></button>
  </section>;
}

export function FindingsList({ findings, onFinding }) {
  const [limit, setLimit] = useState(20);
  return <section className="card"><header className="card-head"><div className="panel-title"><ListChecks size={18} /><h2>Grouped findings</h2></div><span className="chip">{num(findings.length)} total</span></header>
    {findings.length ? <div className="all-findings">{findings.slice(0, limit).map((item) => <button key={item.id} className="full-finding" onClick={() => onFinding(item)}>
      <span className={"finding-glyph " + item.rule}><FindingIcon rule={item.rule} size={20} /></span>
      <span className="finding-description"><strong>{item.title}</strong><span>{item.reason}</span><small>{dateLabel(item.end)} · {timeLabel(item.end)} UTC · {item.rows.size} flagged {item.rows.size === 1 ? "event" : "events"}</small></span>
      <span className="score-chip">{item.score}/100</span><ChevronRight size={17} />
    </button>)}{findings.length > limit && <button className="btn secondary" onClick={() => setLimit(limit + 20)}>Show more findings</button>}</div> :
    <div className="empty-panel"><BadgeCheck /><strong>No findings in this file</strong><p>No event reached the alert threshold of {SCORE_THRESHOLD}.</p></div>}
  </section>;
}

export function Rules() {
  const mins = WINDOW_MS / 60000;
  const rules = [
    ["Repeated login failures", MIN_FAILURES + " failed logins for one account or source IP in a rolling " + mins + "-minute window.", "Adds 35 points to the triggering failure. Account takes priority when both match."],
    ["Success after failures", "A successful login follows at least " + MIN_FAILURES + " failures for that account within " + mins + " minutes.", "Adds 70 points. With no account in the record, the detector matches the source IP."],
    ["Repeated HTTP failures", MIN_FAILURES + " HTTP 401, 403 or 5xx responses from the same source in " + mins + " minutes.", "Adds 35 points to the current HTTP failure when a login pattern has not already matched."],
    ["Application event score", "An HTTP 5xx adds 45 points. A failed login or HTTP 401/403 adds 30. Critical severity adds 40 and error severity adds 20.", "A total score of " + SCORE_THRESHOLD + " or more flags the event. Scores are capped at 100."],
  ];
  return <section className="card"><header className="card-head"><div className="panel-title"><ListChecks size={18} /><h2>Active detection rules</h2></div><span className="chip">Threshold {SCORE_THRESHOLD}/100</span></header>
    <div className="rules-list">{rules.map(([title, when, effect]) => <article key={title}><h3>{title}</h3><p>{when}</p><small>{effect}</small></article>)}</div>
    <div className="rules-note">Events are checked in timestamp order. Earlier attempts stay available as evidence inside the finding. A flag calls for review and does not establish that an account was compromised.</div>
  </section>;
}
