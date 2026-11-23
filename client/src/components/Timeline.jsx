import { useMemo, useState } from "react";
import { ChartNoAxesCombined, ChevronDown } from "lucide-react";
import { dateLabel, timeLabel } from "../analysis/format.js";

function binsFor(events, range) {
  const first = events[0].time, last = events.at(-1).time;
  const start = range === "recent" ? Math.max(first, last - 4 * 3600000) : first;
  const span = last - start;
  const minute = 60000;
  const steps = [1, 5, 10, 15, 30, 60, 120, 240, 720, 1440, 10080, 43200, 525600];
  const step = (steps.find((value) => span / (value * minute) <= 22) || Math.ceil(span / (20 * minute))) * minute;
  const from = Math.floor(start / step) * step;
  const buckets = Array.from({ length: Math.floor((last - from) / step) + 1 }, (_, i) => ({ time: from + i * step, total: 0, failures: 0 }));
  for (const event of events) {
    if (event.time < start) continue;
    const point = buckets[Math.floor((event.time - from) / step)];
    point.total++;
    if (event.outcome === "failure") point.failures++;
  }
  return { buckets, step };
}

export default function Timeline({ events }) {
  const [range, setRange] = useState("all");
  const [active, setActive] = useState(null);
  const { buckets, step } = useMemo(() => binsFor(events, range), [events, range]);
  const width = 660, left = 27, right = 12, top = 12, base = 124;
  const max = Math.max(4, Math.ceil(Math.max(...buckets.map((b) => b.total)) / 4) * 4);
  const x = (i) => left + (width - left - right) * (buckets.length === 1 ? 0.5 : i / (buckets.length - 1));
  const y = (n) => base - n / max * (base - top);
  const points = (key) => buckets.map((bucket, i) => x(i) + "," + y(bucket[key])).join(" ");
  const label = step >= 86400000 ? (t) => dateLabel(t).replace(/ \d{4}$/, "") : timeLabel;
  const ticks = [...new Set(Array.from({ length: Math.min(6, buckets.length) }, (_, i) => Math.round(i * (buckets.length - 1) / Math.max(1, Math.min(6, buckets.length) - 1))))];
  const selected = active != null && buckets[active];
  return <section className="card timeline">
    <header className="card-head"><div><div className="panel-title"><ChartNoAxesCombined size={18} /><h2>Activity timeline</h2></div>
      <p>Event volume over the selected period</p></div>
      <label className="select-wrap"><select aria-label="Timeline period" value={range} onChange={(e) => { setRange(e.target.value); setActive(null); }}><option value="all">Full file</option><option value="recent">Last 4 hours</option></select><ChevronDown size={13} /></label>
    </header>
    <div className="timeline-key"><span><i className="line-key total" />All events</span><span><i className="line-key failed" />Failed logins</span></div>
    <div className="plot" tabIndex="0" role="group" aria-label="Event counts by time. Use the left and right arrow keys to explore."
      onBlur={() => setActive(null)} onMouseLeave={() => setActive(null)} onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault(); setActive((i) => Math.max(0, Math.min(buckets.length - 1, (i ?? -1) + (e.key === "ArrowRight" ? 1 : -1))));
        }
      }} onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = ((e.clientX - rect.left) / rect.width * width - left) / (width - left - right);
        setActive(Math.max(0, Math.min(buckets.length - 1, Math.round(pos * (buckets.length - 1)))));
      }}>
      <svg viewBox={"0 0 " + width + " 150"} preserveAspectRatio="none" role="img" aria-label="All events and failed logins over time, in UTC">
        <defs><linearGradient id="area-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a77f0" stopOpacity=".34" /><stop offset="100%" stopColor="#c0b5fb" stopOpacity=".08" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={left} x2={width-right} y1={y(max*i/4)} y2={y(max*i/4)} stroke="#e4e5ee" strokeDasharray="3 4" /><text x={left - 8} y={y(max*i/4)+3} textAnchor="end">{max*i/4}</text></g>)}
        <polygon points={x(0) + "," + base + " " + points("total") + " " + x(buckets.length-1) + "," + base} fill="url(#area-violet)" />
        <polyline points={points("total")} fill="none" stroke="#7760dc" strokeWidth="2.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={points("failures")} fill="none" stroke="#cf674c" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {buckets.length === 1 && <><circle cx={x(0)} cy={y(buckets[0].total)} r="4" fill="#7760dc" /><circle cx={x(0)} cy={y(buckets[0].failures)} r="3" fill="#cf674c" /></>}
        {ticks.map((i) => <text key={i} x={x(i)} y="145" textAnchor={buckets.length === 1 ? "middle" : i === 0 ? "start" : i === buckets.length - 1 ? "end" : "middle"}>{label(buckets[i].time)}</text>)}
        {selected && <g><line x1={x(active)} x2={x(active)} y1={top} y2={base} stroke="#a49edf" strokeDasharray="3 4" /><circle cx={x(active)} cy={y(selected.total)} r="4" fill="#7061d9" stroke="white" strokeWidth="2" /></g>}
      </svg>
    </div>
    <div className="timeline-foot" aria-live="polite">{selected ? dateLabel(selected.time) + " " + timeLabel(selected.time) + " UTC · " + selected.total + " events · " + selected.failures + " failed" : (step < 3600000 ? step/60000 + "-minute" : step < 86400000 ? step/3600000 + "-hour" : Math.round(step/86400000) + "-day") + " intervals · UTC"}</div>
  </section>;
}
