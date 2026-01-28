/**
 * Logger Utility
 * Lightweight logging with timestamps and log level filtering
 * No spam: only essential information is logged
 */

import { config } from "../config.js";

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LogLevelNames = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
};

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

class Logger {
  constructor() {
    this.level = LogLevel[config.logging.level] || LogLevel.INFO;
  }

  /**
   * Format timestamp for logging
   */
  getTimestamp() {
    if (!config.logging.timestamps) return "";
    const now = new Date();
    return `[${now.toISOString()}] `;
  }

  /**
   * Format log message with level and optional stack trace
   */
  formatMessage(level, message, error = null) {
    const timestamp = this.getTimestamp();
    const levelName = LogLevelNames[level];
    let output = `${timestamp}${levelName}: ${message}`;

    if (error && config.logging.includeStackTrace) {
      output += `\n${error.stack}`;
    }

    return output;
  }

  /**
   * Get color for log level
   */
  getColor(level) {
    switch (level) {
      case LogLevel.ERROR:
        return colors.red;
      case LogLevel.WARN:
        return colors.yellow;
      case LogLevel.INFO:
        return colors.cyan;
      case LogLevel.DEBUG:
        return colors.gray;
      default:
        return colors.reset;
    }
  }

  /**
   * Log message if level is sufficient
   */
  log(level, message, error = null) {
    if (!config.logging.enabled || level < this.level) {
      return;
    }

    const formatted = this.formatMessage(level, message, error);
    const color = this.getColor(level);

    console.log(`${color}${formatted}${colors.reset}`);
  }

  debug(message, error = null) {
    this.log(LogLevel.DEBUG, message, error);
  }

  info(message, error = null) {
    this.log(LogLevel.INFO, message, error);
  }

  warn(message, error = null) {
    this.log(LogLevel.WARN, message, error);
  }

  error(message, error = null) {
    this.log(LogLevel.ERROR, message, error);
  }
}

export const logger = new Logger();
export default logger;
