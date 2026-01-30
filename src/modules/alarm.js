/**
 * Alarm System Module
 * Plays audio alarm and controls system volume on Windows
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  executePowerShellScript,
  escapePowerShellPath,
} from "../utils/powershellHelper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

// Constants
const POWERSHELL_SLEEP_DURATION_SEC = 19;
const LOOP_INTERVAL_MS = POWERSHELL_SLEEP_DURATION_SEC * 1000 + 500; // Add 500ms buffer
const POWERSHELL_ASSEMBLY = "presentationCore";

class AlarmSystem {
  constructor() {
    this.isPlaying = false;
    this.isCurrentlyPlaying = false; // Track if audio is actively playing
    this.audioProcess = null;
    this.loopInterval = null;
    this.soundFilePath = path.join(projectRoot, config.alarm.soundFile);
  }

  /**
   * Initialize alarm system
   */
  async initialize() {
    try {
      if (!this._validateSoundFileExists()) {
        logger.warn(
          `Alarm audio file not found: ${this.soundFilePath}\n` +
            `Please add an audio file (MP3/WAV) to assets/alarm.mp3`,
        );
        return false;
      }

      logger.info("Alarm system initialized");
      return true;
    } catch (error) {
      logger.error(`Alarm initialization error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate sound file exists
   */
  _validateSoundFileExists() {
    return fs.existsSync(this.soundFilePath);
  }

  /**
   * Start playing alarm
   */
  async start() {
    if (this.isPlaying) {
      logger.warn("Alarm already playing");
      return;
    }

    try {
      this.isPlaying = true;
      logger.info("🔔 ALARM TRIGGERED - Playing audio loop");

      this._setupLoopIfEnabled();
      this._setupAutoStopIfConfigured();
    } catch (error) {
      logger.error(`Alarm start error: ${error.message}`);
      this.isPlaying = false;
    }
  }

  /**
   * Play initial sound
   */
  async _playInitialSound() {
    await this._playOnce();
  }

  /**
   * Setup loop if enabled in config
   */
  _setupLoopIfEnabled() {
    if (config.alarm.loop) {
      this._setupLoop();
    }
  }

  /**
   * Setup auto-stop if configured
   */
  _setupAutoStopIfConfigured() {
    if (config.alarm.autoStopMs > 0) {
      setTimeout(() => this.stop(), config.alarm.autoStopMs);
    }
  }

  /**
   * Play audio file once
   */
  _playOnce() {
    return new Promise((resolve) => {
      try {
        // Prevent overlapping playback
        if (this.isCurrentlyPlaying) {
          logger.debug("Audio already playing, skipping...");
          resolve();
          return;
        }

        if (!fs.existsSync(this.soundFilePath)) {
          logger.error(`Audio file not found: ${this.soundFilePath}`);
          resolve();
          return;
        }

        this.isCurrentlyPlaying = true;

        // Use PowerShell to play audio
        const audioProcess = this._playWithPowerShell();

        audioProcess.on("exit", () => {
          this.isCurrentlyPlaying = false;
          resolve();
        });

        audioProcess.on("error", (error) => {
          logger.warn(`Audio playback error: ${error.message}`);
          this.isCurrentlyPlaying = false;
          resolve();
        });

        this.audioProcess = audioProcess;
      } catch (error) {
        logger.error(`Play once error: ${error.message}`);
        this.isCurrentlyPlaying = false;
        resolve();
      }
    });
  }

  /**
   * Play audio using PowerShell (built-in on Windows)
   */
  _playWithPowerShell() {
    const script = this._buildPowerShellScript();
    return executePowerShellScript(script, {
      stdio: "ignore",
      windowsHide: true,
      detached: false,
    });
  }

  /**
   * Build PowerShell script for audio playback
   */
  _buildPowerShellScript() {
    const escapedPath = escapePowerShellPath(this.soundFilePath);
    return `Add-Type -AssemblyName ${POWERSHELL_ASSEMBLY}; $mediaPlayer = New-Object system.windows.media.mediaplayer; $mediaPlayer.open('${escapedPath}'); $mediaPlayer.Play(); Start-Sleep -Seconds ${POWERSHELL_SLEEP_DURATION_SEC}`;
  }

  /**
   * Setup loop interval for continuous playback
   */
  _setupLoop() {
    // Play immediately first
    this._playOnce();

    // Then setup interval for subsequent plays
    this.loopInterval = setInterval(async () => {
      if (this.isPlaying) {
        await this._playOnce();
      }
    }, LOOP_INTERVAL_MS);

    logger.debug(`Alarm loop started (interval: ${LOOP_INTERVAL_MS}ms)`);
  }

  /**
   * Stop alarm playback
   */
  async stop() {
    try {
      if (!this.isPlaying) {
        logger.debug("Alarm not playing");
        return;
      }

      this.isPlaying = false;
      this.isCurrentlyPlaying = false; // Reset playback state

      // Clear loop interval first
      if (this.loopInterval) {
        clearInterval(this.loopInterval);
        this.loopInterval = null;
      }

      // Aggressively kill all PowerShell processes (force immediate stop)
      spawn("taskkill", ["/F", "/IM", "powershell.exe"], {
        stdio: "ignore",
        windowsHide: true,
      });

      // Kill audio process
      if (this.audioProcess) {
        try {
          process.kill(-this.audioProcess.pid); // Kill process group
        } catch (error) {
          // Process may already be dead
        }
        this.audioProcess = null;
      }

      // Kill all wmplayer instances (PowerShell audio fallback)
      spawn("taskkill", ["/F", "/IM", "wmplayer.exe"], {
        stdio: "ignore",
        windowsHide: true,
      });

      logger.info("🛑 Alarm stopped");
    } catch (error) {
      logger.error(`Alarm stop error: ${error.message}`);
    }
  }

  /**
   * Check if alarm is currently playing
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      soundFile: this.soundFilePath,
      loopEnabled: config.alarm.loop,
    };
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    await this.stop();
  }
}

export const alarm = new AlarmSystem();
export default alarm;
