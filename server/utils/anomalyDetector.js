const analyzeAnomaly = async (Log, logData) => {
  let score = 0;
  let reasons = [];

  const statusCode = Number(logData.statusCode);

  // Rule 1: Server errors
  if (statusCode >= 500) {
    score += 45;
    reasons.push("Server error detected");
  }

  // Rule 2: Authentication failures
  if (statusCode === 401 || statusCode === 403) {
    score += 30;
    reasons.push("Authentication or authorization failure");
  }

  // Rule 3: Critical severity
  if (String(logData.severity).toLowerCase() === "critical") {
    score += 40;
    reasons.push("Critical severity event");
  }

  // Rule 4: Error severity
  if (String(logData.severity).toLowerCase() === "error") {
    score += 20;
    reasons.push("Application error detected");
  }

  // Rule 5: Repeated failures from same source
  if (logData.source) {
    const recentFailures = await Log.countDocuments({
      source: logData.source,
      statusCode: { $in: [401, 403, 500] },
      createdAt: {
        $gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    if (recentFailures >= 5) {
      score += 35;
      reasons.push(
        "Repeated failures from the same source"
      );
    }
  }

  // Maximum score = 100
  score = Math.min(score, 100);

  // Anomaly threshold
  const isAnomaly = score >= 60;

  return {
    isAnomaly,
    anomalyScore: score,
    anomalyReason: isAnomaly
      ? reasons.join(". ")
      : "No unusual behavior detected",
  };
};

module.exports = analyzeAnomaly;