const analyzeLog = async (Log, logData) => {
  let score = 0;
  const reasons = [];

  const statusCode = Number(logData.statusCode);
  const severity = String(logData.severity || "").toLowerCase();

  // 1. Server errors
  if (statusCode >= 500) {
    score += 45;
    reasons.push("Server error detected");
  }

  // 2. Authentication / authorization failures
  if (statusCode === 401 || statusCode === 403) {
    score += 30;
    reasons.push("Authentication or authorization failure");
  }

  // 3. Critical severity
  if (severity === "critical") {
    score += 40;
    reasons.push("Critical severity event");
  }

  // 4. Error severity
  if (severity === "error") {
    score += 20;
    reasons.push("Application error detected");
  }

  // 5. Repeated failures
  if (logData.source) {
    const recentFailures = await Log.countDocuments({
      source: logData.source,
      statusCode: { $in: [401, 403, 500] },
      createdAt: {
        $gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    // Include the current request in the calculation
    const totalFailures = recentFailures + 1;

    if (totalFailures >= 5) {
      score += 35;
      reasons.push("Repeated failures from the same source");
    }
  }

  score = Math.min(score, 100);

  const isAnomaly = score >= 60;

  return {
    isAnomaly,
    anomalyScore: score,
    anomalyReason: isAnomaly
      ? reasons.join(". ")
      : "No unusual behavior detected",
  };
};

module.exports = analyzeLog;