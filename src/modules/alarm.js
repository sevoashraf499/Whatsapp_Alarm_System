/**
 * Alarm System Module
 * Plays audio alarm and controls system volume on Windows
 * Handles looping, stopping, and volume forcing
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { setWindowsVolume } from "../utils/volumeControl.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

class AlarmSystem {
  constructor() {
    this.isPlaying = false;
    this.audioProcess = null;
    this.loopInterval = null;
    this.soundFilePath = path.join(projectRoot, config.alarm.soundFile);
  }

  /**
   * Initialize alarm system and validate audio file
   */
  async initialize() {
    try {
      if (!fs.existsSync(this.soundFilePath)) {
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
   * Start playing alarm
   * Handles volume control and looping
   */
  async start() {
    if (this.isPlaying) {
      logger.warn("Alarm already playing");
      return;
    }

    try {
      // Force system volume to 100%
      if (config.alarm.forceVolume) {
        const volumeSet = await setWindowsVolume(config.alarm.targetVolume);
        if (!volumeSet && !config.alarm.fallbackOnVolumeFailure) {
          logger.error("Failed to set volume and fallback disabled");
          return;
        }
        if (volumeSet) {
          logger.debug(`System volume forced to ${config.alarm.targetVolume}%`);
        }
      }

      this.isPlaying = true;
      logger.info("🔔 ALARM TRIGGERED - Playing audio loop");

      // Start initial playback
      await this.playOnce();

      // Setup looping if enabled
      if (config.alarm.loop) {
        this.setupLoop();
      }

      // Setup auto-stop if duration is set
      if (config.alarm.autoStopMs > 0) {
        setTimeout(() => this.stop(), config.alarm.autoStopMs);
      }
    } catch (error) {
      logger.error(`Alarm start error: ${error.message}`);
      this.isPlaying = false;
    }
  }

  /**
   * Play audio file once
   */
  playOnce() {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(this.soundFilePath)) {
          logger.error(`Audio file not found: ${this.soundFilePath}`);
          resolve();
          return;
        }

        // Use Windows built-in audio player (wmplayer, powershell media, or ffmpeg)
        const audioProcess = this.playWithPowerShell();

        audioProcess.on("exit", () => {
          resolve();
        });

        audioProcess.on("error", (error) => {
          logger.warn(`Audio playback error: ${error.message}`);
          resolve();
        });

        this.audioProcess = audioProcess;
      } catch (error) {
        logger.error(`Play once error: ${error.message}`);
        resolve();
      }
    });
  }

  /**
   * Play audio using PowerShell (built-in on Windows)
   * More reliable than external players
   */
  playWithPowerShell() {
    const script = `
      [Windows.Media.MediaManager, Windows.Media.MediaManager, ContentType=WindowsRuntime] > $null;
      [Windows.Foundation.Collections.PropertySet]::new().Add('System.Media.MediaProperties.MediaCategory', 'BackgroundCapableMedia') > $null;
      
      $player = [Windows.Media.Playback.MediaPlayer]::new();
      $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync('${this.soundFilePath}') | Wait-Process -PassThru;
      $player.Source = [Windows.Media.Core.MediaSource]::CreateFromStorageFile($file);
      $player.Play();
      
      Start-Sleep -Seconds 999;
    `;

    return spawn("powershell.exe", ["-NoProfile", "-Command", script], {
      stdio: "ignore",
      windowsHide: true,
      detached: false,
    });
  }

  /**
   * Play audio using Windows Media Player command line
   * Fallback method
   */
  playWithWMPlayer() {
    return spawn("wmplayer.exe", [this.soundFilePath], {
      stdio: "ignore",
      windowsHide: true,
      detached: false,
    });
  }

  /**
   * Setup loop interval for continuous playback
   */
  setupLoop() {
    // Estimate audio duration (fallback to 5 seconds)
    const estimatedDuration = 5000; // 5 seconds

    this.loopInterval = setInterval(async () => {
      if (this.isPlaying) {
        await this.playOnce();
      }
    }, estimatedDuration);

    logger.debug("Alarm loop started");
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

      // Kill audio process
      if (this.audioProcess) {
        try {
          process.kill(-this.audioProcess.pid); // Kill process group
        } catch (error) {
          // Process may already be dead
        }
        this.audioProcess = null;
      }

      // Clear loop interval
      if (this.loopInterval) {
        clearInterval(this.loopInterval);
        this.loopInterval = null;
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
