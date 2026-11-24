import { useEffect, useRef, useState } from "react";
import { Check, CloudUpload, Download, FileSpreadsheet, FolderOpen, OctagonAlert, X } from "lucide-react";
import { MAX_BYTES, parseCsv } from "../analysis/csv.js";
import { dateLabel, num, outcomeNames, sampleUrl, timeLabel } from "../analysis/format.js";
import { evidenceFor } from "../analysis/scan.js";

export function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} className={"ld-dialog" + (wide ? " wide" : "")}
    aria-labelledby="dialog-heading" onCancel={(e) => { e.preventDefault(); onClose(); }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog-inner">
      <header className="dialog-head"><h2 id="dialog-heading">{title}</h2><button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header>
      {children}
    </section>
  </dialog>;
}

export function InvalidRows({ errors }) {
  if (!errors.length) return null;
  return <details className="invalid-rows">
    <summary>{num(errors.length)} invalid {errors.length === 1 ? "record" : "records"} · view reasons</summary>
    <ul>{errors.slice(0, 30).map((error) => <li key={error.row}><strong>Record {error.row}</strong> · {error.message}</li>)}</ul>
    {errors.length > 30 && <p>Showing the first 30 invalid records.</p>}
  </details>;
}

export function ImportDialog({ onClose, onImport }) {
  const input = useRef(null);
  const request = useRef(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  async function readFile(file) {
    if (!file) return;
    const id = ++request.current;
    setBusy(true); setError(""); setPreview(null);
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a file with the .csv extension.");
      if (file.size > MAX_BYTES) throw new Error("Choose a CSV smaller than or equal to 5 MB.");
      const csv = await file.text();
      const parsed = parseCsv(csv);
      if (id === request.current) setPreview({ name: file.name, csv, ...parsed });
    } catch (err) {
      if (id === request.current) setError(err.message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return <Dialog title="Upload login CSV" onClose={onClose} wide>
    <p className="dialog-intro">Preview your records, then analyze the file. This tab remembers your analyzed CSV when you refresh.</p>
    <input className="visually-hidden" tabIndex="-1" aria-label="Choose CSV file" ref={input} type="file" accept=".csv,text/csv" onChange={(e) => { readFile(e.target.files[0]); e.target.value = ""; }} />
    <button className={"drop-zone" + (drag ? " dragging" : "")} onClick={() => input.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}>
      <span className="drop-icon"><CloudUpload size={28} /></span>
      <strong>{preview ? preview.name : "Choose a CSV or drop it here"}</strong>
      <small>{preview ? "Click to choose a different file" : "Comma-separated CSV · Up to 5 MB and 10,000 records"}</small>
    </button>
    <div aria-live="polite">{busy && <p>Reading file…</p>}
      {error && <p className="form-error" role="alert"><OctagonAlert size={17} />{error}</p>}
    </div>
    {preview && <div className="import-preview">
      <h3><FileSpreadsheet size={17} /> CSV preview <span className="chip">{num(preview.rows.length)} valid</span></h3>
      {preview.rows.length > 0 && <div className="table-scroll"><table className="small-table"><thead><tr><th>Record</th><th>Time (UTC)</th><th>Account or IP</th><th>Outcome</th></tr></thead><tbody>
        {preview.rows.slice(0, 4).map((row) => <tr key={row.row}><td>{row.row}</td><td>{timeLabel(row.time)}</td><td>{row.account || row.source}</td><td>{outcomeNames[row.outcome]}</td></tr>)}
      </tbody></table></div>}
      <InvalidRows errors={preview.errors} />
      {!preview.rows.length && <p className="form-error">Fix the invalid records and choose the file again.</p>}
    </div>}
    <details className="format-guide"><summary>Supported CSV columns</summary>
      <p>Include a timestamp, an account or source IP, and an outcome or HTTP status. Use ISO date and time or Unix timestamps. Times without an offset are read as UTC.</p>
      <code>timestamp,username,ip_address,outcome</code>
      <p>The original eventType, severity, source, statusCode and message columns are also supported alongside timestamp.</p>
    </details>
    <footer className="dialog-foot"><a className="text-button" href={sampleUrl} download="sample-logins.csv"><Download size={16} /> Sample CSV</a>
      <button className="btn primary" disabled={!preview?.rows.length || busy} onClick={() => onImport(preview)}><Check size={17} /> Analyze CSV</button></footer>
  </Dialog>;
}

export function EventDialog({ event, onClose, onFinding }) {
  return <Dialog title={"Event · record " + event.row} onClose={onClose}>
    <p className="dialog-intro">{dateLabel(event.time)} · {event.timestamp.slice(11, 19)} UTC</p>
    <div className={"reason-box" + (event.isAnomaly ? " flagged" : "")}>
      <strong>{event.isAnomaly ? "Flagged event" : "Below the alert threshold"} · {event.anomalyScore}/100</strong>
      <p>{event.anomalyReason}</p>
    </div>
    <dl className="fields">{[
      ["Account", event.account], ["Source", event.source], ["Outcome", outcomeNames[event.outcome]],
      ["Event type", event.eventType], ["HTTP status", event.statusCode], ["Severity", event.severity], ["Message", event.message],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
    {event.findingId && <button className="btn secondary" onClick={() => onFinding(event.findingId)}><FolderOpen size={16} /> Open related finding</button>}
  </Dialog>;
}

export function FindingDialog({ finding, events, onClose, onEvent }) {
  const evidence = evidenceFor(finding, events);
  const [limit, setLimit] = useState(15);
  return <Dialog title={finding.title} onClose={onClose} wide>
    <p className="dialog-intro">{finding.subject} · {dateLabel(finding.end)} · {timeLabel(finding.end)} UTC</p>
    <div className="reason-box flagged"><strong>Highest score {finding.score}/100</strong><p>{finding.reason}</p></div>
    <h3 className="related-title">Related events <span className="chip">{num(evidence.length)}</span></h3>
    <p className="small-note">Includes the login attempts that led up to the alert.</p>
    <div className="table-scroll"><table className="small-table"><thead><tr><th>CSV record</th><th>Time (UTC)</th><th>Account or IP</th><th>Outcome</th></tr></thead>
      <tbody>{evidence.slice(0, limit).map((row) => <tr key={row.row}><td><button className="text-link" onClick={() => onEvent(row)}>Record {row.row}</button></td><td>{row.timestamp.slice(11, 19)}</td><td>{row.account || row.source}</td><td>{outcomeNames[row.outcome]}</td></tr>)}</tbody>
    </table></div>
    {evidence.length > limit && <button className="btn secondary" onClick={() => setLimit(limit + 30)}>Show more events</button>}
  </Dialog>;
}
