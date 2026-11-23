import { useMemo, useState } from "react";
import {
  Activity, BookOpen, CalendarDays, ChevronRight, CircleX,
  Database, Download, FileClock, FileSpreadsheet, FileText, Flag, KeyRound,
  LayoutDashboard, Menu, PanelLeft, ShieldAlert, ShieldCheck, Upload, X,
} from "lucide-react";
import sampleText from "./data/sample-logins.csv?raw";
import { parseCsv } from "./analysis/csv.js";
import { scanRows } from "./analysis/scan.js";
import { dateLabel, num, sampleUrl } from "./analysis/format.js";
import { EventDialog, FindingDialog, ImportDialog, InvalidRows } from "./components/Dialogs.jsx";
import EventsTable from "./components/EventsTable.jsx";
import { FindingsList, RecentFindings, Rules } from "./components/Findings.jsx";
import Timeline from "./components/Timeline.jsx";
import "./Workspace.css";

const example = { name: "sample-logins.csv", sample: true, ...parseCsv(sampleText) };
const views = {
  overview: ["Overview", "Login overview", "Monitor login activity and investigate anomalies in your log file."],
  events: ["Event log", "Event log", "Search the original records and inspect individual detection scores."],
  findings: ["Findings", "Anomaly findings", "Review related alerts together and trace each one to its source records."],
  rules: ["Detection rules", "Detection rules", "See which login patterns trigger a finding and how each event is scored."],
};

function Sidebar({ view, navigate, dataset, findings, mobile, close }) {
  const items = [["overview", LayoutDashboard], ["events", FileClock], ["findings", ShieldAlert]];
  const nav = (id, Icon) => <button className={"nav-button" + (view === id ? " selected" : "")} key={id}
    aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{views[id][0]}</span>
    {id === "findings" && <small>{num(findings)}</small>}</button>;
  return <><aside id="site-nav" className={"ld-sidebar" + (mobile ? " expanded" : "")}>
    <div className="ld-brand"><img src={import.meta.env.BASE_URL + "favicon.svg"} alt="" /><span>Log<strong>Detect</strong></span>
      <button className="nav-close" onClick={close} aria-label="Close navigation"><X size={20} /></button></div>
    <nav aria-label="Main navigation">
      <h2>Workspace</h2>{items.map(([id, Icon]) => nav(id, Icon))}
      <h2>Resources</h2>{nav("rules", BookOpen)}
      <a className="nav-button" href={sampleUrl} download="sample-logins.csv"><Download size={18} /><span>Sample CSV</span></a>
      {import.meta.env.VITE_CSV_ONLY !== "true" && <a className="nav-button" href="?view=saved"><Database size={18} /><span>Saved log dashboard</span></a>}
    </nav>
    <div className="side-source"><div className="source-caption"><span className="tiny-dot" /> Current dataset</div>
      <div className="side-file"><FileSpreadsheet size={18} /><strong title={dataset.name}>{dataset.name}</strong></div>
      <small>{dataset.sample ? "Sample data" : "Uploaded CSV"} · {num(dataset.rows.length)} events</small></div>
  </aside>{mobile && <button className="nav-backdrop" aria-label="Dismiss navigation" onClick={close} />}</>;
}

function Stat({ icon: Icon, label, value, note, color }) {
  return <div className={"stat " + color}><div className="stat-label"><span>{label}</span><i><Icon size={19} strokeWidth={1.8} /></i></div>
    <strong className="stat-number">{num(value)}</strong><small>{note}</small></div>;
}

function Workspace() {
  const [dataset, setDataset] = useState(example);
  const [view, setView] = useState("overview");
  const [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [version, setVersion] = useState(0);
  const { events, findings } = useMemo(() => scanRows(dataset.rows), [dataset]);
  const [first, last] = [events[0].time, events.at(-1).time];
  const failed = events.filter((event) => event.outcome === "failure").length;
  const accounts = new Set(events.map((event) => event.account).filter(Boolean)).size;
  const sources = new Set(events.map((event) => event.source).filter(Boolean)).size;
  const flagged = events.filter((event) => event.isAnomaly).length;
  const coverage = dateLabel(first) + (dateLabel(first) !== dateLabel(last) ? " – " + dateLabel(last) : "");
  const navigate = (next) => { setView(next); setMobile(false); window.scrollTo(0, 0); };
  const onEvent = (data) => setDialog({ type: "event", data });
  const onFinding = (data) => setDialog({ type: "finding", data });
  const load = (data) => { setDataset(data); setVersion((v) => v + 1); setDialog(null); navigate("overview"); };

  return <div className="ld-app"><a className="skip-link" href="#workspace-main">Skip to content</a>
    <Sidebar view={view} navigate={navigate} dataset={dataset} findings={findings.length} mobile={mobile} close={() => setMobile(false)} />
    <div className="ld-main">
      <header className="ld-topbar"><div className="breadcrumbs"><button className="menu-toggle icon-btn" aria-label="Open navigation" aria-controls="site-nav" aria-expanded={mobile} onClick={() => setMobile(true)}><Menu size={19} /></button>
        <PanelLeft className="desktop-symbol" size={18} /><span className="crumb-rule" /><span>Workspace</span><ChevronRight size={13} /><strong>{views[view][0]}</strong></div>
        <span className="local-indicator"><ShieldCheck size={15} /> On-device analysis</span></header>
      <main id="workspace-main" className="ld-content">
        <div className="page-heading"><div><h1>{views[view][1]}</h1><p>{views[view][2]}</p></div>
          <button className="btn primary upload-button" onClick={() => setDialog({ type: "import" })}><Upload size={17} /> Upload CSV</button></div>
        <div className="dataset-line">
          <div className="file-context"><span className={"dataset-tag" + (dataset.sample ? "" : " uploaded")}><span />{dataset.sample ? "Sample dataset" : "Uploaded file"}</span>
            <span className="file-name"><FileText size={15} /><span title={dataset.name}>{dataset.name}</span></span>
            <span className="dataset-date"><CalendarDays size={15} />{coverage}</span></div>
          {!dataset.sample && <button className="text-button" onClick={() => load(example)}>Load sample</button>}
        </div>
        {!!dataset.errors.length && <InvalidRows errors={dataset.errors} />}
        <div key={version} className="view-content">
          {view === "overview" && <>
            <section className="stats-row" aria-label="Dataset summary">
              <Stat icon={Activity} label="Events analyzed" value={events.length} note="Valid records in this file" color="purple" />
              <Stat icon={CircleX} label="Failed logins" value={failed} note={(100 * failed / events.length).toFixed(1) + "% of all events"} color="orange" />
              <Stat icon={Flag} label="Flagged events" value={flagged} note={num(findings.length) + (findings.length === 1 ? " grouped finding" : " grouped findings")} color="rose" />
              <Stat icon={KeyRound} label="Unique accounts" value={accounts} note={num(sources) + (sources === 1 ? " distinct source" : " distinct sources")} color="teal" />
            </section>
            <div className="overview-grid"><Timeline events={events} /><RecentFindings findings={findings} onFinding={onFinding} onAll={() => navigate("findings")} /></div>
            <EventsTable compact events={events} onEvent={onEvent} onAll={() => navigate("events")} />
          </>}
          {view === "events" && <EventsTable events={events} onEvent={onEvent} />}
          {view === "findings" && <FindingsList findings={findings} onFinding={onFinding} />}
          {view === "rules" && <Rules />}
        </div>
      </main>
    </div>
    {dialog?.type === "import" && <ImportDialog onClose={() => setDialog(null)} onImport={load} />}
    {dialog?.type === "event" && <EventDialog event={dialog.data} onClose={() => setDialog(null)} onFinding={(id) => onFinding(findings.find((item) => item.id === id))} />}
    {dialog?.type === "finding" && <FindingDialog key={dialog.data.id} finding={dialog.data} events={events} onClose={() => setDialog(null)} onEvent={onEvent} />}
  </div>;
}

export default Workspace;
