const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },

    account: { type: String, trim: true },
    outcome: { type: String, enum: ["success", "failure", "other"] },

    eventType: {
      type: String,
      required: true,
      trim: true,
    },

    severity: {
      type: String,
      required: true,
      enum: ["info", "warning", "error", "critical"],
    },

    source: {
      type: String,
      required: true,
      trim: true,
    },

    statusCode: {
      type: Number,
    },

    message: {
      type: String,
      trim: true,
    },

    isAnomaly: {
      type: Boolean,
      default: false,
    },

    anomalyScore: {
      type: Number,
      default: 0,
    },

    anomalyReason: {
      type: String,
      default: "",
    },

    aiExplanation: {
      type: String,
      default: "",
    },

    aiRootCause: {
      type: String,
      default: "",
    },

    aiNextStep: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

logSchema.index({ source: 1, timestamp: 1 });
logSchema.index({ account: 1, timestamp: 1 });

module.exports = mongoose.model("Log", logSchema);