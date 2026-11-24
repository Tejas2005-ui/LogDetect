# LogDetect · Login anomaly detector

LogDetect analyzes a CSV of login events in the browser. Upload a file to preview valid records and row errors, then analyze it to see a timeline, filterable event records and grouped findings. Open a finding to inspect its reason, score and original CSV records. The separate **Saved log dashboard** uses the existing Express and MongoDB API.

## Run the CSV workspace

Use Node.js 22.12+ or Node.js 24 LTS. From the repository root run:

```sh
cd client
npm ci
npm run dev
```

Open the local address printed by Vite. The workspace starts with the downloadable [synthetic sample](client/src/data/sample-logins.csv). It contains **142 events, 21 failed logins and 6 flagged events in 4 findings**. After you select **Analyze CSV**, the tab keeps a local copy of the file and restores the analysis when you refresh. Choose **Load sample** to clear that copy, or analyze another CSV to replace it. Use **Event log → Export CSV** to keep a filtered report.

### CSV format

The importer accepts comma-separated UTF-8 CSV files up to 5 MB and 10,000 records. It supports quoted text, commas in quoted values, embedded newlines and a UTF-8 BOM. Record numbers count the header as record 1. Invalid records have a reason in the preview. Only valid records enter the scan.

```csv
timestamp,username,ip_address,outcome
2026-11-20T09:00:00Z,demo.user,192.0.2.10,failure
2026-11-20T09:01:00Z,demo.user,192.0.2.10,success
```

| Field | Accepted examples |
|---|---|
| Event time (required) | `timestamp`, `event_time`, `datetime`; use an ISO date and time or Unix seconds/milliseconds. Times without an offset use UTC. |
| Account or source (one required) | `username`, `user`, `account`, `email`, `ip_address`, `source_ip`, `source` |
| Outcome or HTTP status (one required) | `outcome`, `result`, `login_status`, `status`, `statusCode`. For example, `success`, `failure`, `200` or `401`. |
| Optional application fields | `eventType`, `severity`, `message` |

Files are sorted by event time before analysis. The current CSV supplies its own history. Five failures in five minutes for one account or source can flag the fifth attempt. A success after five recent failures for that account is also flagged. If the successful event has no account, the source IP supplies the context. The original attempts remain available in the finding's evidence table.

## Project Overview

Modern applications generate large volumes of logs. Manually identifying unusual events is slow and error-prone.

**Smart Log Analyzer** addresses this by:

- Persisting application logs in MongoDB.
- Analyzing each incoming log on the backend.
- Assigning an anomaly score from 0–100.
- Flagging suspicious events.
- Explaining why an event was flagged.
- Providing search, filtering, analytics, alerts and detailed log inspection.
- Exporting filtered data as CSV or JSON.

The assessment requirement is to ingest and persist logs, flag unusual entries with a chosen algorithm, persist the score/reason, provide a detail view, and support AI-oriented explanation/root-cause fields. The current implementation covers the ingestion, persistence, anomaly scoring, reason, management and detail-view portions; the AI fields are prepared in the schema/UI for integration.

## Key Features

### Monitoring Dashboard
- Total logs
- Anomaly count
- Error count
- System health indicator
- Recent log table

### Log Management
- Add new logs from the UI
- Persist logs through the backend API
- Search by event, source or message
- Filter by severity
- Filter by anomaly status
- Filter by HTTP status code
- Filter by date range
- Open a detailed log drawer

### Anomaly Detection
The backend uses a weighted rule-based scoring model.

Base points and historical patterns are scored by the same rules in the CSV workspace and saved-log API:

| Rule | Score |
|---|---:|
| HTTP status >= 500 | +45 |
| Failed login or HTTP 401 / 403 | +30 |
| Critical severity | +40 |
| Error severity | +20 |
| Five login failures by account or source, or five HTTP failures from one source, in five minutes | +35 |
| Successful login after at least five recent failures | +70 |

The score is capped at **100**.

An entry is considered an anomaly when:

```text
anomalyScore >= 60
```

The backend also stores a human-readable anomaly reason.

### Analytics
- Anomaly rate
- Error rate
- Average anomaly score
- Severity distribution
- Status-code distribution
- Top sources
- Highest-risk events

### Alerts
High-risk events are surfaced separately for quick investigation.

### Reports
- Export filtered logs as CSV
- Export filtered logs as JSON
- Report preview

### Settings
- Automatic refresh
- Browser notification preference
- Theme preference
- Backend connection status

## Technology Stack

### Frontend
- React
- Axios
- CSS
- Vite development workflow

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose

### Architecture

```text
React Frontend
      │
      │ HTTP / JSON
      ▼
Express REST API
      │
      ▼
Log Controller
      │
      ▼
Anomaly Service
      │
      ▼
MongoDB / Mongoose
```

## API

### Get Logs

```http
GET /api/logs
```

Returns the stored logs sorted by timestamp.

### Create Log

```http
POST /api/logs
Content-Type: application/json
```

Example:

```json
{
  "timestamp": "2026-08-24T14:00:00.000Z",
  "eventType": "POST /api/login",
  "severity": "error",
  "source": "192.168.1.10",
  "statusCode": 500,
  "message": "Internal server error"
}
```

The backend analyzes the request before saving it.

## Data Model

A log contains fields such as:

```text
timestamp
eventType
severity
source
statusCode
message
isAnomaly
anomalyScore
anomalyReason
aiExplanation
aiRootCause
aiNextStep
createdAt
updatedAt
```

## Run the saved-log API

From the repository root, open a second terminal:

```sh
cd server
npm ci
```

Create `server/.env` with your MongoDB connection string in `MONGO_URI` and `PORT=5000`. Run `npm start`, then open **Saved log dashboard** in the workspace. Vite proxies `/api` to port 5000 during development. Production builds use the repository’s existing Render endpoint by default. Set `VITE_LOG_API_URL` to the full logs endpoint at build time for another deployment.

In `client`, use `npm run build` to produce `dist/`. Build from the full checkout so the client can bundle the scoring rules from `server/services/loginRules.mjs`. Setting `VITE_CSV_ONLY=true` at build time creates a standalone CSV-only dashboard. The CSV workflow runs without MongoDB in both configurations.

## Testing

Run `npm test` in `client` and in `server`. The tests cover file parsing, row validation, historical timestamps, the five-minute boundary, ordering, grouped evidence and compatibility with older log records.

The application was tested end-to-end for:

- Loading existing logs
- Creating a log
- Persisting the log in MongoDB
- Calculating anomaly scores
- Displaying anomaly reasons
- Searching logs
- Applying filters
- Opening log details
- Viewing analytics
- Viewing alerts
- Exporting reports

### Example anomaly

A request with:

```text
severity = error
statusCode = 500
```

triggers the server-error and application-error rules.

Repeated failures from the same source can increase the score further.

## Production Checklist

Before publishing:

- [ ] Confirm the saved-log API URL for this deployment.
- [ ] Set production MongoDB connection string.
- [ ] Keep secrets in environment variables.
- [ ] Confirm `.env` is ignored by Git.
- [ ] Run a production frontend build.
- [ ] Verify backend API from the deployed frontend.
- [ ] Test the deployed Add Log flow.
- [ ] Test anomaly detection after deployment.
- [ ] Check browser console for errors.
- [ ] Remove unnecessary debug logging.
- [ ] Add repository screenshots.

## Important Note About AI

The data model already includes:

```text
aiExplanation
aiRootCause
aiNextStep
```

These fields are displayed by the frontend when populated.

The current anomaly detector itself is rule-based. An AI provider can be connected later to turn flagged events into plain-English explanations, likely root causes and recommended next steps.

## Future Enhancements

- OpenAI/LLM-powered explanations
- Authentication and role-based access
- Real-time WebSocket log streaming
- Configurable anomaly thresholds
- ML-based anomaly detection
- Log ingestion from external services
- Persistent alert history
- Email/Slack alerts
- Advanced time-series charts
- Docker deployment
- CI/CD

## Submission Summary

**Smart Log Analyzer** demonstrates a complete MERN workflow:

```text
Ingest
  ↓
Validate
  ↓
Analyze
  ↓
Score
  ↓
Persist
  ↓
Visualize
  ↓
Filter
  ↓
Investigate
  ↓
Report
```

---

Built as a technical assessment project.
