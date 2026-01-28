/**
 * Volume Control Utility (Windows)
 * Force system volume to 100% using nircmd or PowerShell
 * Gracefully continues if volume control fails (fallback behavior)
 */

import { spawn } from "child_process";
import { logger } from "./logger.js";

/**
 * Set Windows system volume to a specific level
 * Uses nircmd (external tool) if available, falls back to PowerShell
 */
export async function setWindowsVolume(volumeLevel = 100) {
  try {
    volumeLevel = Math.max(0, Math.min(100, volumeLevel)); // Clamp to 0-100

    // Try nircmd first (faster, but requires external tool)
    const nircmdResult = await tryNircmdVolume(volumeLevel);
    if (nircmdResult) {
      logger.debug(`Volume set to ${volumeLevel}% using nircmd`);
      return true;
    }

    // Fallback to PowerShell (built-in, but slower)
    const psResult = await tryPowerShellVolume(volumeLevel);
    if (psResult) {
      logger.debug(`Volume set to ${volumeLevel}% using PowerShell`);
      return true;
    }

    logger.warn("Could not set volume: nircmd and PowerShell methods failed");
    return false;
  } catch (error) {
    logger.error(`Volume control error: ${error.message}`);
    return false;
  }
}

/**
 * Try setting volume using nircmd
 * nircmd is a command-line utility for Windows
 * Download from: https://www.nirsoft.net/utils/nircmd.html
 */
function tryNircmdVolume(volumeLevel) {
  return new Promise((resolve) => {
    try {
      // nircmd setsysvolume <level> (0-65535, where 65535 = 100%)
      const volumeValue = Math.round((volumeLevel / 100) * 65535);

      const process = spawn(
        "nircmd",
        ["setsysvolume", volumeValue.toString()],
        {
          stdio: "pipe",
          windowsHide: true,
        },
      );

      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          process.kill();
          resolve(false);
        }
      }, 3000);

      process.on("exit", (code) => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          resolve(code === 0 || code === null); // Success if exit code is 0 or null
        }
      });

      process.on("error", () => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          resolve(false);
        }
      });
    } catch (error) {
      logger.debug(`nircmd error: ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Try setting volume using PowerShell (Windows built-in)
 * Uses WinRT Audio API via PowerShell
 */
function tryPowerShellVolume(volumeLevel) {
  return new Promise((resolve) => {
    try {
      // PowerShell script to set volume (0-100)
      const psScript = `
        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]::RequestAsync([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]) | Out-Null
        $volumeFraction = ${volumeLevel / 100};
        (Get-AudioDevice -playback).volume = $volumeFraction;
      `;

      const process = spawn(
        "powershell.exe",
        ["-NoProfile", "-Command", psScript],
        {
          stdio: "pipe",
          windowsHide: true,
        },
      );

      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          process.kill();
          resolve(false);
        }
      }, 5000);

      process.on("exit", (code) => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          // PowerShell may exit with code 0 even on partial success
          resolve(true);
        }
      });

      process.on("error", () => {
        clearTimeout(timeout);
        if (!completed) {
          completed = true;
          resolve(false);
        }
      });
    } catch (error) {
      logger.debug(`PowerShell volume error: ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Mute/unmute system audio
 */
export async function muteSystem(mute = true) {
  try {
    const muteCommand = mute ? "1" : "0";

    // Using nircmd: setsysvolume mute
    const process = spawn("nircmd", ["mutesysvolume", muteCommand], {
      stdio: "pipe",
      windowsHide: true,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        process.kill();
        resolve(false);
      }, 2000);

      process.on("exit", () => {
        clearTimeout(timeout);
        resolve(true);
      });

      process.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch (error) {
    logger.debug(`Mute error: ${error.message}`);
    return false;
  }
}

/**
 * Get current system volume
 */
export async function getSystemVolume() {
  try {
    // This is harder to implement cross-platform
    // Return null if unavailable
    return null;
  } catch (error) {
    logger.debug(`Get volume error: ${error.message}`);
    return null;
  }
}

export default {
  setWindowsVolume,
  muteSystem,
  getSystemVolume,
};
