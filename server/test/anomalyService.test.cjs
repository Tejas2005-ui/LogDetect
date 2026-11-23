const { test } = require("node:test");
const assert = require("node:assert/strict");
const analyze = require("../services/anomalyService");
const event = { source: "192.0.2.8", eventType: "POST /api/login", statusCode: 401, timestamp: "2019-07-03T10:00:00Z" };
function model(history, inspect = () => {}) {
  return { find(query) {
    inspect(query);
    return { select() { return this; }, lean() { return this; }, cursor() { return history; } };
  } };
}
test("historical saved logs use the same event-time window and threshold as uploaded logs", async () => {
  const result = await analyze(model(Array(4).fill(event), (q) => {
    assert.equal(q.timestamp.$gte.toISOString(), "2019-07-03T09:55:00.000Z");
    assert.equal(q.timestamp.$lte.toISOString(), "2019-07-03T10:00:00.000Z");
    assert.deepEqual(q.$or, [{ source: event.source }]);
  }), event);
  assert.equal(result.anomalyScore, 65); assert.equal(result.isAnomaly, true);
});
test("a stored non-login success is not counted as a failure", async () => {
  const result = await analyze(model(Array(4).fill(event)), { ...event, eventType: "GET /reports", statusCode: 200 });
  assert.equal(result.anomalyScore, 0);
});
test("old documents without outcome or account can supply evidence for a later login", async () => {
  const result = await analyze(model(Array(5).fill(event)), { ...event, statusCode: 200 });
  assert.equal(result.isAnomaly, true); assert.match(result.anomalyReason, /Successful login after 5/);
});
