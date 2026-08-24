const Log = require("../models/Log");
const analyzeLog = require("../services/anomalyService");

// Create a new log
const createLog = async (req, res) => {
  try {
    // Analyze the log
    const analysis = await analyzeLog(Log, req.body);

    // Add analysis results to the log
    const logData = {
      ...req.body,
      ...analysis,
    };

    // Save the analyzed log
    const log = await Log.create(logData);

    res.status(201).json({
      success: true,
      message: "Log created successfully",
      data: log,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all logs
const getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createLog,
  getLogs,
};