import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleX, Download, Flag, ListFilter, ListTree, Search } from "lucide-react";
import { exportEvents } from "../analysis/csv.js";
import { dateLabel, num, outcomeNames } from "../analysis/format.js";

const pageSize = 12;

export default function EventsTable({ events, compact = false, onEvent, onAll }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return events.filter((row) => {
      if (filter === "flagged" && !row.isAnomaly) return false;
      if (["success", "failure", "other"].includes(filter) && row.outcome !== filter) return false;
      return !text || [row.account, row.source, row.message, row.eventType, row.anomalyReason, row.statusCode, row.row, row.timestamp].join(" ").toLowerCase().includes(text);
    }).reverse();
  }, [events, search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const showing = compact ? filtered.slice(0, 5) : filtered.slice(current * pageSize, (current + 1) * pageSize);
  return <section className="card ledger">
    <header className="card-head">
      <div className="panel-title"><ListTree size={18} /><h2>{compact ? "Recent events" : "Event records"}</h2></div>
      {compact ? <button className="text-button" onClick={onAll}>View all events <ChevronRight size={15} /></button> :
        <button className="btn secondary small" onClick={() => exportEvents(filtered)} disabled={!filtered.length}><Download size={15} /> Export CSV</button>}
    </header>
    {!compact && <div className="table-tools"><label className="search-field"><Search size={16} /><input aria-label="Search events" type="search" placeholder="Search account, IP or record…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
      <label className="select-wrap filter-select"><ListFilter size={15} /><select aria-label="Filter events" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
        <option value="all">All events</option><option value="flagged">Flagged only</option><option value="failure">Failed logins</option><option value="success">Successful logins</option><option value="other">Other events</option>
      </select><ChevronDown size={13} /></label></div>}
    <div className="table-scroll"><table className="events-table">
      <thead><tr><th>Time <small>UTC</small></th><th>Account</th><th>Source IP</th><th>Outcome</th><th>Detection</th><th><span className="visually-hidden">Inspect event</span></th></tr></thead>
      <tbody>{showing.map((row) => <tr key={row.row} onClick={() => onEvent(row)}>
        <td><span className="td-time">{row.timestamp.slice(11, 19)}</span><small className="table-date">{dateLabel(row.time)}</small></td>
        <td className="account-cell">{row.account || "—"}</td><td className="mono source-cell">{row.source || "—"}</td>
        <td><span className={"outcome " + row.outcome}>{row.outcome === "success" ? <CircleCheck size={13} /> : row.outcome === "failure" ? <CircleX size={13} /> : null}{outcomeNames[row.outcome]}</span></td>
        <td>{row.isAnomaly ? <span className="flag-pill"><Flag size={12} /> Flagged</span> : <span className="no-flag">No flag</span>}</td>
        <td><button className="row-open" aria-label={"Inspect record " + row.row} onClick={(e) => { e.stopPropagation(); onEvent(row); }}><ChevronRight size={16} /></button></td>
      </tr>)}</tbody>
    </table></div>
    {!showing.length && <div className="empty-panel"><Search /><strong>No matching events</strong><p>Try another search or filter.</p><button className="text-button" onClick={() => { setSearch(""); setFilter("all"); setPage(0); }}>Clear filters</button></div>}
    {!compact && <footer className="pagination"><span>{filtered.length ? (current * pageSize + 1) + "–" + Math.min((current + 1) * pageSize, filtered.length) : "0"} of {num(filtered.length)} events</span>
      <div><button className="icon-btn" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><span>{current+1} / {pages}</span><button className="icon-btn" aria-label="Next page" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div></footer>}
  </section>;
}
