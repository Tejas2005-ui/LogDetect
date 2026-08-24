import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "https://logdetect.onrender.com/api/logs";

const emptyForm = {
  timestamp: new Date().toISOString().slice(0, 16),
  eventType: "POST /api/login",
  severity: "error",
  source: "192.168.1.10",
  statusCode: 500,
  message: "Internal server error",
};

function App() {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [toast, setToast] = useState("");
  const [dateRange, setDateRange] = useState("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(API);
      setLogs(response.data?.data || []);
    } catch (err) {
      console.error(err);
      setError("Backend connection failed. Make sure server is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 10000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".global-search input")?.focus();
      }
      if (e.key === "Escape") {
        setSelectedLog(null);
        setShowAdd(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const anomalyCount = logs.filter((l) => l.isAnomaly === true).length;
  const errorCount = logs.filter((l) =>
    ["error", "critical"].includes(String(l.severity || "").toLowerCase())
  ).length;
  const warningCount = logs.filter(
    (l) => String(l.severity || "").toLowerCase() === "warning"
  ).length;
  const infoCount = logs.filter(
    (l) => String(l.severity || "").toLowerCase() === "info"
  ).length;
  const criticalCount = logs.filter(
    (l) => String(l.severity || "").toLowerCase() === "critical"
  ).length;

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const rangeMs =
      dateRange === "24h" ? 24 * 60 * 60 * 1000 :
      dateRange === "7d" ? 7 * 24 * 60 * 60 * 1000 :
      dateRange === "30d" ? 30 * 24 * 60 * 60 * 1000 : null;

    return logs.filter((log) => {
      const text = search.trim().toLowerCase();
      const haystack = [
        log.eventType,
        log.source,
        log.message,
        log.severity,
        log.statusCode,
        log.anomalyReason,
      ].join(" ").toLowerCase();

      const matchesSearch = !text || haystack.includes(text);
      const matchesSeverity =
        severityFilter === "all" ||
        String(log.severity || "").toLowerCase() === severityFilter;
      const matchesAnomaly =
        anomalyFilter === "all" ||
        (anomalyFilter === "yes" && log.isAnomaly === true) ||
        (anomalyFilter === "no" && log.isAnomaly !== true);
      const matchesStatus =
        statusFilter === "all" ||
        String(log.statusCode ?? "") === statusFilter;

      const timestamp = new Date(log.timestamp || log.createdAt || 0).getTime();
      const matchesDate = !rangeMs || (timestamp && now - timestamp <= rangeMs);

      return matchesSearch && matchesSeverity && matchesAnomaly && matchesStatus && matchesDate;
    });
  }, [logs, search, severityFilter, anomalyFilter, statusFilter, dateRange]);

  const statusCodes = [...new Set(
    logs.map((l) => l.statusCode).filter((x) => x !== undefined && x !== null).map(String)
  )].sort();

  const sourceStats = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      const source = l.source || "Unknown";
      map[source] = (map[source] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [logs]);

  const statusStats = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      const status = l.statusCode ?? "N/A";
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [logs]);

  const severityStats = useMemo(() => {
    return [
      ["info", infoCount],
      ["warning", warningCount],
      ["error", errorCount],
      ["critical", criticalCount],
    ];
  }, [infoCount, warningCount, errorCount, criticalCount]);

  const anomalyRate = logs.length ? Math.round((anomalyCount / logs.length) * 100) : 0;
  const errorRate = logs.length ? Math.round((errorCount / logs.length) * 100) : 0;
  const avgScore = logs.length
    ? Math.round(logs.reduce((sum, l) => sum + Number(l.anomalyScore || 0), 0) / logs.length)
    : 0;

  const clearFilters = () => {
    setSearch("");
    setSeverityFilter("all");
    setAnomalyFilter("all");
    setStatusFilter("all");
    setDateRange("all");
  };

  const navigate = (section) => {
    setActiveSection(section);
    if (section === "anomalies") {
      setAnomalyFilter("yes");
      setSeverityFilter("all");
    } else if (section === "logs" || section === "dashboard") {
      setAnomalyFilter("all");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createLog = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        timestamp: new Date(form.timestamp).toISOString(),
        statusCode: Number(form.statusCode),
      };
      const response = await axios.post(API, payload);
      const created = response.data?.data;
      if (created) {
        setLogs((prev) => [created, ...prev]);
        setSelectedLog(created);
      } else {
        await fetchLogs();
      }
      setShowAdd(false);
      setForm(emptyForm);
      setToast(created?.isAnomaly ? "Anomaly detected and log saved." : "Log saved successfully.");
      if (notifications && created?.isAnomaly) {
        // Browser notification is optional and only used when permission already exists.
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Smart Log Analyzer", {
            body: `Anomaly detected. Score: ${created.anomalyScore}/100`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      setToast(err.response?.data?.message || "Could not create log.");
    } finally {
      setSubmitting(false);
    }
  };

  const exportLogs = (format, data = filteredLogs) => {
    if (!data.length) {
      setToast("Nothing to export.");
      return;
    }

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `smart-log-report-${Date.now()}.json`);
      setToast("JSON report exported.");
      return;
    }

    const headers = [
      "timestamp", "eventType", "severity", "source", "statusCode",
      "message", "isAnomaly", "anomalyScore", "anomalyReason"
    ];
    const rows = data.map((l) =>
      headers.map((h) => csvEscape(l[h] ?? "")).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `smart-log-report-${Date.now()}.csv`);
    setToast("CSV report exported.");
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (value) => {
    const text = String(value).replaceAll('"', '""');
    return `"${text}"`;
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setToast("Browser notifications are not supported.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotifications(true);
      setToast("Notifications enabled.");
    } else {
      setNotifications(false);
      setToast("Notification permission was not granted.");
    }
  };

  const resetDemoFilters = () => {
    clearFilters();
    setToast("Filters cleared.");
  };

  const pageTitle = {
    dashboard: "Dashboard",
    logs: "Logs",
    anomalies: "Anomalies",
    analytics: "Analytics",
    reports: "Reports",
    alerts: "Alerts",
    settings: "Settings",
  }[activeSection];

  const renderPage = () => {
    if (activeSection === "analytics") {
      return (
        <section className="feature-page">
          <PageHeader title="Analytics" subtitle="Understand log volume, errors and anomaly behavior." />
          <div className="analytics-grid">
            <Metric title="Anomaly Rate" value={`${anomalyRate}%`} note={`${anomalyCount} detected`} />
            <Metric title="Error Rate" value={`${errorRate}%`} note={`${errorCount} error/critical logs`} />
            <Metric title="Average Score" value={`${avgScore}/100`} note="Across all logs" />
            <Metric title="Total Sources" value={sourceStats.length} note="Unique sources shown" />
          </div>

          <div className="analysis-columns">
            <Panel title="Severity Distribution">
              {severityStats.map(([name, count]) => (
                <BarRow key={name} label={name} value={count} max={Math.max(logs.length, 1)} />
              ))}
            </Panel>

            <Panel title="Status Code Distribution">
              {statusStats.length ? statusStats.map(([name, count]) => (
                <BarRow key={name} label={name} value={count} max={Math.max(logs.length, 1)} />
              )) : <EmptyMini text="No status codes available." />}
            </Panel>

            <Panel title="Top Sources">
              {sourceStats.length ? sourceStats.map(([name, count]) => (
                <BarRow key={name} label={name} value={count} max={Math.max(sourceStats[0]?.[1] || 1, 1)} />
              )) : <EmptyMini text="No source data available." />}
            </Panel>
          </div>

          <Panel title="Risk Overview">
            <div className="risk-list">
              {logs.slice().sort((a, b) => Number(b.anomalyScore || 0) - Number(a.anomalyScore || 0)).slice(0, 5).map((l) => (
                <button className="risk-row" key={l._id} onClick={() => setSelectedLog(l)}>
                  <span>{l.eventType || "Event"}</span>
                  <span>{l.source || "-"}</span>
                  <strong>{Number(l.anomalyScore || 0)}/100</strong>
                </button>
              ))}
              {!logs.length && <EmptyMini text="Add logs to generate analytics." />}
            </div>
          </Panel>
        </section>
      );
    }

    if (activeSection === "reports") {
      return (
        <section className="feature-page">
          <PageHeader title="Reports" subtitle="Export the current analyzer data for submission or review." />
          <div className="report-hero">
            <div>
              <span className="eyebrow">READY TO EXPORT</span>
              <h2>{filteredLogs.length} logs selected</h2>
              <p>Exports respect your current search, severity, anomaly, status and date filters.</p>
            </div>
            <div className="report-actions">
              <button className="primary-action" onClick={() => exportLogs("csv")}>↓ Export CSV</button>
              <button className="secondary-action" onClick={() => exportLogs("json")}>↓ Export JSON</button>
            </div>
          </div>

          <div className="analytics-grid">
            <Metric title="Total Logs" value={logs.length} note="MongoDB records" />
            <Metric title="Anomalies" value={anomalyCount} note="Detected by backend rules" />
            <Metric title="Errors" value={errorCount} note="Error + critical" />
            <Metric title="Filtered" value={filteredLogs.length} note="Current report selection" />
          </div>

          <Panel title="Report Preview">
            <div className="report-preview">
              {filteredLogs.slice(0, 10).map((l) => (
                <div className="preview-row" key={l._id}>
                  <span>{l.eventType}</span>
                  <span>{l.severity}</span>
                  <span>{l.statusCode ?? "-"}</span>
                  <span>{l.isAnomaly ? "Detected" : "Normal"}</span>
                  <strong>{l.anomalyScore || 0}</strong>
                </div>
              ))}
              {!filteredLogs.length && <EmptyMini text="No records match the current filters." />}
            </div>
          </Panel>
        </section>
      );
    }

    if (activeSection === "alerts") {
      const alerts = logs
        .filter((l) => l.isAnomaly || Number(l.statusCode) >= 500 || l.severity === "critical")
        .sort((a, b) => Number(b.anomalyScore || 0) - Number(a.anomalyScore || 0));

      return (
        <section className="feature-page">
          <PageHeader title="Alerts" subtitle="Highest-risk events requiring attention." />
          <div className="alert-summary">
            <strong>{alerts.length}</strong>
            <span>active risk events</span>
          </div>
          <Panel title="Risk Alerts">
            <div className="alert-list">
              {alerts.map((l) => (
                <button className="alert-item" key={l._id} onClick={() => setSelectedLog(l)}>
                  <div className="alert-icon">!</div>
                  <div className="alert-main">
                    <strong>{l.eventType || "Application event"}</strong>
                    <span>{l.anomalyReason || l.message || "Risk event detected"}</span>
                  </div>
                  <div className="alert-score">{l.anomalyScore || 0}</div>
                </button>
              ))}
              {!alerts.length && <EmptyMini text="No active alerts. Your logs look normal." />}
            </div>
          </Panel>
        </section>
      );
    }

    if (activeSection === "settings") {
      return (
        <section className="feature-page">
          <PageHeader title="Settings" subtitle="Control how Smart Log Analyzer behaves in this browser." />
          <Panel title="Application Settings">
            <SettingRow
              title="Automatic Refresh"
              description="Refresh logs from the backend every 10 seconds."
              checked={autoRefresh}
              onChange={() => setAutoRefresh((v) => !v)}
            />
            <SettingRow
              title="Anomaly Notifications"
              description="Show browser alerts when a newly created anomaly is detected."
              checked={notifications}
              onChange={requestNotifications}
            />
            <SettingRow
              title="Dark Interface"
              description="Keep the dashboard in the presentation-friendly dark theme."
              checked={darkMode}
              onChange={() => {
                setDarkMode((v) => !v);
                document.documentElement.classList.toggle("light-mode");
              }}
            />
          </Panel>

          <Panel title="Quick Actions">
            <div className="quick-actions">
              <button className="secondary-action" onClick={fetchLogs}>↻ Refresh Backend Data</button>
              <button className="secondary-action" onClick={resetDemoFilters}>⌕ Clear Filters</button>
              <button className="secondary-action" onClick={() => setShowAdd(true)}>＋ Add Test Log</button>
            </div>
          </Panel>

          <Panel title="Backend Connection">
            <div className={`connection ${error ? "offline" : "online"}`}>
              <span></span>
              <strong>{error ? "Backend unavailable" : "Backend connected"}</strong>
              <small>{API}</small>
            </div>
          </Panel>
        </section>
      );
    }

    return (
      <>
        <section className="stats-grid">
          <div className="stat-card blue"><div className="stat-icon">▤</div><div className="stat-content"><span>Total Logs</span><strong>{logs.length}</strong><small>All time logs</small></div><div className="mini-chart">╱╲╱╲╱</div></div>
          <div className="stat-card red"><div className="stat-icon">◇</div><div className="stat-content"><span>Anomalies</span><strong>{anomalyCount}</strong><small>Potential issues</small></div><div className="mini-chart">╱╲╱╲╱</div></div>
          <div className="stat-card orange"><div className="stat-icon">!</div><div className="stat-content"><span>Errors</span><strong>{errorCount}</strong><small>Error logs</small></div><div className="mini-chart">╱╲╱╲╱</div></div>
          <div className="stat-card green"><div className="stat-icon">⌁</div><div className="stat-content"><span>System Status</span><strong>Active</strong><small>All systems operational</small></div><div className="mini-chart">╱╲╱╲╱</div></div>
        </section>

        <div className="filter-toolbar">
          <div className="category-tabs">
            <button className={`category-tab ${anomalyFilter === "all" && severityFilter === "all" ? "active" : ""}`} onClick={clearFilters}>▤ All Logs <span>{logs.length}</span></button>
            <button className={`category-tab ${anomalyFilter === "yes" ? "active" : ""}`} onClick={() => setAnomalyFilter(anomalyFilter === "yes" ? "all" : "yes")}>◇ Anomalies <span>{anomalyCount}</span></button>
            <button className={`category-tab ${severityFilter === "error" ? "active" : ""}`} onClick={() => setSeverityFilter(severityFilter === "error" ? "all" : "error")}>⊗ Errors <span>{errorCount}</span></button>
            <button className={`category-tab ${severityFilter === "warning" ? "active" : ""}`} onClick={() => setSeverityFilter(severityFilter === "warning" ? "all" : "warning")}>⚠ Warnings <span>{warningCount}</span></button>
            <button className={`category-tab ${severityFilter === "info" ? "active" : ""}`} onClick={() => setSeverityFilter(severityFilter === "info" ? "all" : "info")}>ⓘ Info <span>{infoCount}</span></button>
          </div>
          <div className="filter-actions">
            <select className="date-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">All Time</option><option value="24h">Last 24 Hours</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option>
            </select>
            <button className="filter-btn" onClick={clearFilters}>♢ Clear Filters</button>
          </div>
        </div>

        <section className="logs-card">
          <div className="logs-header">
            <div><h2>{activeSection === "anomalies" ? "Detected Anomalies" : "Recent Logs"}</h2><p>Click a log entry to view detailed information and analysis</p></div>
            <span className="result-count">Showing {filteredLogs.length} of {logs.length}</span>
          </div>

          <div className="table-filters">
            <div className="table-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event, source or message..." />{search && <button onClick={() => setSearch("")}>×</button>}</div>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="all">All Severities</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option><option value="critical">Critical</option>
            </select>
            <select value={anomalyFilter} onChange={(e) => setAnomalyFilter(e.target.value)}>
              <option value="all">All Anomalies</option><option value="yes">Detected</option><option value="no">Normal</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status Codes</option>
              {statusCodes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {error && <div className="connection-error">⚠ {error} <button onClick={fetchLogs}>Retry</button></div>}
          {loading ? <div className="empty-state">Loading logs...</div> : !filteredLogs.length ? (
            <div className="empty-state"><div className="empty-icon">⌕</div><h3>No logs found</h3><p>Try changing your search or filters.</p><button className="clear-btn" onClick={clearFilters}>Clear Filters</button></div>
          ) : (
            <div className="table-container">
              <table><thead><tr><th>Event</th><th>Severity</th><th>Source</th><th>Status</th><th>Anomaly</th><th>Score</th><th>Time</th><th></th></tr></thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="log-row" onClick={() => setSelectedLog(log)}>
                    <td><div className="event-cell"><strong>{log.eventType}</strong><small>{log.message || "Application event"}</small></div></td>
                    <td><span className={`severity ${String(log.severity || "").toLowerCase()}`}>{log.severity}</span></td>
                    <td><span className="source-text">{log.source}</span></td>
                    <td><strong className={Number(log.statusCode) >= 400 ? "status-error" : "status-normal"}>{log.statusCode ?? "-"}</strong></td>
                    <td>{log.isAnomaly ? <span className="anomaly yes">● Detected</span> : <span className="anomaly no">● Normal</span>}</td>
                    <td>{log.anomalyScore || 0}</td>
                    <td>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : "-"}</td>
                    <td><span className="row-arrow">→</span></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <div className={`app-shell ${darkMode ? "" : "light-mode"}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-logo"><span>⌁</span></div><div className="brand-name"><strong>Smart Log</strong><span>Analyzer</span></div></div>

        <nav className="sidebar-nav">
          {[
            ["dashboard", "⌂", "Dashboard"],
            ["logs", "☷", "Logs"],
            ["anomalies", "◇", "Anomalies"],
            ["analytics", "▥", "Analytics"],
            ["reports", "▤", "Reports"],
            ["alerts", "♧", "Alerts"],
            ["settings", "⚙", "Settings"],
          ].map(([id, icon, label]) => (
            <button key={id} className={`nav-item ${activeSection === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
              {id === "anomalies" && anomalyCount > 0 && <b className="nav-badge">{anomalyCount}</b>}
            </button>
          ))}
        </nav>

        <div className="health-card">
          <div className="health-title"><span>SYSTEM HEALTH</span><span className="health-dot"></span></div>
          <div className="health-status"><span></span>{error ? "Backend Needs Attention" : "All Systems Operational"}</div>
          <div className="health-wave">︿﹀︿﹀︿﹀︿﹀︿</div>
          <div className="health-row"><span>Uptime</span><strong>99.98%</strong></div>
          <div className="progress"><span style={{ width: "99.98%" }}></span></div>
          <div className="health-row"><span>Logs Processed</span><strong>{logs.length}</strong></div>
          <div className="progress purple"><span style={{ width: `${Math.min(logs.length * 6, 100)}%` }}></span></div>
          <div className="health-row last"><span>Last Updated</span><strong>{new Date().toLocaleTimeString()}</strong></div>
        </div>

        <div className="pro-card">
          <div className="pro-header"><strong>Unlock Advanced Insights</strong><span>Pro</span></div>
          <p>AI-powered analysis, smart alerts and advanced reports.</p>
          <button onClick={() => navigate("reports")}>✦ View Reports</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="welcome">
            <h1>{activeSection === "dashboard" ? <>Welcome back, Tejas! <span>👋</span></> : pageTitle}</h1>
            <p>{activeSection === "dashboard" ? "Monitor, analyze and understand your application logs in real-time." : "Smart Log Analyzer — operational monitoring and analysis."}</p>
          </div>
          <div className="header-actions">
            <div className="global-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs, events, sources..." /><kbd>Ctrl K</kbd></div>
            <button className="icon-button" onClick={() => setDarkMode((v) => !v)} title="Toggle theme">☼</button>
            <button className="icon-button notification" onClick={() => navigate("alerts")}>♧{anomalyCount > 0 && <span>{Math.min(anomalyCount, 9)}</span>}</button>
            <div className="avatar">T</div>
          </div>
        </header>

        <div className="refresh-wrapper">
          <button className="refresh-btn" onClick={fetchLogs} disabled={loading}>↻ {loading ? "Refreshing..." : "Refresh Logs"}</button>
          <button className="add-log-btn" onClick={() => setShowAdd(true)}>＋ Add Log</button>
          {autoRefresh && <span className="live-indicator">● Auto refresh ON</span>}
        </div>

        {renderPage()}

        <footer className="footer">© 2026 Smart Log Analyzer. All rights reserved. <span>♡</span></footer>
      </main>

      {selectedLog && (
        <>
          <div className="details-overlay" onClick={() => setSelectedLog(null)} />
          <aside className="details-panel">
            <div className="details-panel-header"><div><h2>Log Details</h2><p>Event information and analysis</p></div><button className="details-close" onClick={() => setSelectedLog(null)}>×</button></div>
            <div className="details-status"><div className={`details-status-icon ${selectedLog.severity}`}>!</div><div><span className={`severity ${String(selectedLog.severity || "").toLowerCase()}`}>{selectedLog.severity}</span><small>{selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : "Time unavailable"}</small></div></div>
            <div className="details-info">
              <InfoRow label="Event Type" value={selectedLog.eventType} />
              <InfoRow label="Severity" value={selectedLog.severity} />
              <InfoRow label="Source" value={selectedLog.source} />
              <InfoRow label="Status Code" value={selectedLog.statusCode ?? "-"} danger={Number(selectedLog.statusCode) >= 400} />
              <div className="info-row"><span>Anomaly Status</span>{selectedLog.isAnomaly ? <span className="anomaly yes">● Detected</span> : <span className="anomaly no">● Normal</span>}</div>
              <InfoRow label="Anomaly Score" value={`${selectedLog.anomalyScore || 0} / 100`} />
            </div>
            <div className="details-box message-box"><div className="box-title"><span>💬</span><strong>Message</strong></div><p>{selectedLog.message || "No message available."}</p></div>
            <div className={`details-box ${selectedLog.isAnomaly ? "reason-warning" : "reason-normal"}`}><div className="box-title"><span>{selectedLog.isAnomaly ? "⚠" : "✓"}</span><strong>Anomaly Reason</strong></div><p>{selectedLog.anomalyReason || "No anomaly detected for this log."}</p></div>
            <div className="ai-box">
              <div className="box-title"><span>✦</span><strong>AI Insight</strong></div>
              {selectedLog.aiExplanation || selectedLog.aiRootCause || selectedLog.aiNextStep ? (
                <>
                  {selectedLog.aiExplanation && <p><strong>Explanation:</strong> {selectedLog.aiExplanation}</p>}
                  {selectedLog.aiRootCause && <p><strong>Root Cause:</strong> {selectedLog.aiRootCause}</p>}
                  {selectedLog.aiNextStep && <p><strong>Next Step:</strong> {selectedLog.aiNextStep}</p>}
                </>
              ) : <p>AI fields are ready for future integration. Current anomaly analysis is rule-based and comes from the backend.</p>}
            </div>
          </aside>
        </>
      )}

      {showAdd && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowAdd(false)}>
          <form className="add-modal" onSubmit={createLog} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><h2>Add & Analyze Log</h2><p>The backend will calculate the anomaly score automatically.</p></div><button type="button" onClick={() => setShowAdd(false)}>×</button></div>
            <label>Timestamp<input type="datetime-local" value={form.timestamp} onChange={(e) => setForm({ ...form, timestamp: e.target.value })} required /></label>
            <label>Event Type<input value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} required /></label>
            <div className="form-two"><label>Severity<select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}><option>info</option><option>warning</option><option>error</option><option>critical</option></select></label><label>Status Code<input type="number" value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: e.target.value })} /></label></div>
            <label>Source<input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} required /></label>
            <label>Message<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows="3" /></label>
            <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-action" disabled={submitting}>{submitting ? "Analyzing..." : "Create & Analyze"}</button></div>
          </form>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <style>{`
        .feature-page{padding-bottom:30px}
        .feature-page h2{margin:0}
        .page-header{display:flex;justify-content:space-between;align-items:end;margin:8px 0 22px}
        .page-header p{margin:7px 0 0;opacity:.65}
        .analytics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
        .metric-card,.panel,.report-hero,.alert-summary{background:rgba(8,17,39,.72);border:1px solid rgba(100,130,190,.22);border-radius:12px;padding:18px}
        .metric-card span,.eyebrow{font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.08em}
        .metric-card strong{display:block;font-size:28px;margin:7px 0}.metric-card small{opacity:.55}
        .analysis-columns{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
        .panel{margin-bottom:18px}.panel-title{font-weight:700;margin-bottom:16px}
        .bar-row{display:grid;grid-template-columns:100px 1fr 35px;gap:9px;align-items:center;margin:12px 0;font-size:12px}
        .bar-track{height:7px;background:rgba(255,255,255,.07);border-radius:20px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,#5b21ff,#9d65ff);border-radius:20px}
        .risk-row,.alert-item,.preview-row{width:100%;border:0;background:transparent;color:inherit;text-align:left;display:grid;grid-template-columns:2fr 1fr 70px;gap:12px;padding:13px 5px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer}
        .risk-row strong,.alert-score{color:#ff5577}.preview-row{grid-template-columns:2fr 1fr 70px 100px 50px;cursor:default}
        .report-hero{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.report-hero h2{font-size:25px;margin:6px 0}.report-hero p{opacity:.6}
        .report-actions,.quick-actions,.modal-actions{display:flex;gap:10px}.primary-action,.secondary-action,.add-log-btn{border:0;border-radius:8px;padding:11px 16px;cursor:pointer;font-weight:700}.primary-action,.add-log-btn{background:#6331ff;color:white}.secondary-action{background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12)}
        .alert-summary{display:flex;align-items:center;gap:12px;margin-bottom:18px}.alert-summary strong{font-size:30px;color:#ff5577}.alert-summary span{opacity:.6}.alert-item{grid-template-columns:42px 1fr 60px;align-items:center}.alert-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,60,100,.12);color:#ff5577}.alert-main{display:flex;flex-direction:column;gap:4px}.alert-main span{font-size:12px;opacity:.6}
        .setting-row{display:flex;justify-content:space-between;align-items:center;padding:17px 0;border-bottom:1px solid rgba(255,255,255,.06)}.setting-row:last-child{border-bottom:0}.setting-copy strong{display:block}.setting-copy p{margin:5px 0 0;opacity:.55;font-size:12px}.toggle{width:48px;height:26px;border:0;border-radius:20px;background:#333;cursor:pointer;padding:3px}.toggle span{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}.toggle.on{background:#6434ff}.toggle.on span{transform:translateX(22px)}
        .connection{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.connection span{width:9px;height:9px;border-radius:50%;background:#19df9b}.connection.offline span{background:#ff496d}.connection small{width:100%;opacity:.45}
        .nav-badge{margin-left:auto;min-width:20px;padding:2px 6px;border-radius:10px;background:#ff3868;color:white;font-size:10px;text-align:center}
        .refresh-wrapper{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.live-indicator{font-size:11px;color:#1fe3a3}.connection-error{padding:12px;margin:10px;border:1px solid rgba(255,60,90,.3);border-radius:8px;color:#ff7188}.connection-error button{float:right;background:none;border:0;color:inherit;cursor:pointer}
        .date-select{background:#07142d;color:inherit;border:1px solid rgba(100,130,190,.3);border-radius:7px;padding:9px}
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);display:grid;place-items:center;z-index:1000;padding:20px}.add-modal{width:min(560px,100%);background:#07122b;border:1px solid rgba(120,140,210,.3);border-radius:15px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.55)}.modal-head{display:flex;justify-content:space-between;margin-bottom:18px}.modal-head h2{margin:0}.modal-head p{margin:6px 0 0;opacity:.55;font-size:12px}.modal-head button{background:none;border:0;color:inherit;font-size:24px;cursor:pointer}.add-modal label{display:block;font-size:12px;opacity:.8;margin:11px 0}.add-modal input,.add-modal select,.add-modal textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;background:#050e22;color:#fff;border:1px solid rgba(100,130,190,.3);border-radius:7px;padding:10px}.form-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.modal-actions{justify-content:flex-end;margin-top:18px}
        .toast{position:fixed;right:24px;bottom:24px;z-index:1200;background:#121d3d;border:1px solid rgba(130,150,220,.3);color:white;padding:13px 17px;border-radius:9px;box-shadow:0 15px 45px rgba(0,0,0,.4);font-size:13px}
        .light-mode .metric-card,.light-mode .panel,.light-mode .report-hero,.light-mode .alert-summary{background:#fff;color:#16203a}.light-mode .add-modal{background:#fff;color:#16203a}.light-mode .add-modal input,.light-mode .add-modal select,.light-mode .add-modal textarea{background:#f4f6fb;color:#16203a}
        @media(max-width:1000px){.analytics-grid{grid-template-columns:repeat(2,1fr)}.analysis-columns{grid-template-columns:1fr}.report-hero{flex-direction:column;align-items:flex-start;gap:15px}}
        @media(max-width:650px){.analytics-grid{grid-template-columns:1fr}.form-two{grid-template-columns:1fr}.report-actions{width:100%;flex-direction:column}.risk-row,.preview-row{grid-template-columns:1fr}.top-header{flex-direction:column;align-items:flex-start}}
      `}</style>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return <div className="page-header"><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function Metric({ title, value, note }) {
  return <div className="metric-card"><span>{title}</span><strong>{value}</strong><small>{note}</small></div>;
}

function Panel({ title, children }) {
  return <div className="panel"><div className="panel-title">{title}</div>{children}</div>;
}

function BarRow({ label, value, max }) {
  const width = Math.max(3, Math.round((value / max) * 100));
  return <div className="bar-row"><span>{label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }} /></div><strong>{value}</strong></div>;
}

function EmptyMini({ text }) {
  return <div style={{ opacity: .55, padding: "15px 0", fontSize: 13 }}>{text}</div>;
}

function SettingRow({ title, description, checked, onChange }) {
  return <div className="setting-row"><div className="setting-copy"><strong>{title}</strong><p>{description}</p></div><button className={`toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button></div>;
}

function InfoRow({ label, value, danger }) {
  return <div className="info-row"><span>{label}</span><strong className={danger ? "status-error" : ""}>{value || "-"}</strong></div>;
}

export default App;
