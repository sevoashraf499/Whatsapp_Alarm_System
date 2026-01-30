/**
 * PowerShell Helper Utility
 * Shared utilities for executing PowerShell commands on Windows
 */

import { spawn } from "child_process";
import { logger } from "./logger.js";

// Constants
export const POWERSHELL_FLAGS = ["-NoProfile", "-Command"];
export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Execute PowerShell script
 * @param {string} script - PowerShell script to execute
 * @param {Object} options - Execution options
 * @returns {ChildProcess} Spawned process
 */
export function executePowerShellScript(script, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    windowsHide = true,
    stdio = "ignore",
    detached = false,
  } = options;

  return spawn("powershell.exe", [...POWERSHELL_FLAGS, script], {
    stdio,
    windowsHide,
    detached,
  });
}

/**
 * Execute PowerShell script with promise wrapper
 * @param {string} script - PowerShell script to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} True if successful
 */
export function executePowerShellWithTimeout(
  script,
  timeout = DEFAULT_TIMEOUT_MS,
) {
  return new Promise((resolve) => {
    try {
      const process = executePowerShellScript(script, { timeout });

      let completed = false;
      const timeoutHandle = setTimeout(() => {
        if (!completed) {
          completed = true;
          process.kill();
          resolve(false);
        }
      }, timeout);

      process.on("exit", (code) => {
        clearTimeout(timeoutHandle);
        if (!completed) {
          completed = true;
          resolve(code === 0 || code === null);
        }
      });

      process.on("error", (error) => {
        clearTimeout(timeoutHandle);
        if (!completed) {
          completed = true;
          logger.debug(`PowerShell execution error: ${error.message}`);
          resolve(false);
        }
      });
    } catch (error) {
      logger.debug(`PowerShell spawn error: ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Escape path for PowerShell
 * @param {string} path - File path to escape
 * @returns {string} Escaped path
 */
export function escapePowerShellPath(path) {
  return path.replace(/\\/g, "\\\\");
}

export default {
  POWERSHELL_FLAGS,
  DEFAULT_TIMEOUT_MS,
  executePowerShellScript,
  executePowerShellWithTimeout,
  escapePowerShellPath,
};
