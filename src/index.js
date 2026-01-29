/**
 * Main Entry Point
 * Orchestrates browser launch, WhatsApp connection, and message monitoring
 * Handles graceful shutdown and error recovery
 */

import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { browserManager } from "./modules/browser.js";
import { MessageWatcher } from "./modules/watcher.js";
import { alarm } from "./modules/alarm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// Constants
const KEEPALIVE_INTERVAL_MS = 60000; // 1 minute
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

class WhatsAppAlarmSystem {
  constructor() {
    this.browser = null;
    this.page = null;
    this.watcher = null;
    this.pollInterval = null;
    this.isRunning = false;
  }

  /**
   * Initialize and start the system
   */
  async start() {
    try {
      this._printStartupBanner();

      await this._initializeAlarm();
      await this._initializeBrowser();
      await this._initializeWatcher();
      await this._startMonitoring();

      this._printReadyMessage();
      this._setupEventHandlers();
    } catch (error) {
      logger.error(`System start error: ${error.message}`);
      await this.shutdown();
      process.exit(EXIT_FAILURE);
    }
  }

  /**
   * Print startup banner
   */
  _printStartupBanner() {
    logger.info("========================");
    logger.info("Sa7eny🏃‍♂️‍➡️ Starting...");
    logger.info("========================");
  }

  /**
   * Initialize alarm system
   */
  async _initializeAlarm() {
    const alarmReady = await alarm.initialize();
    if (!alarmReady) {
      logger.warn("Alarm system initialization incomplete, but continuing...");
    }
  }

  /**
   * Initialize browser and navigate to WhatsApp
   */
  async _initializeBrowser() {
    logger.debug("Launching browser...");
    await browserManager.launch();
    this.browser = browserManager.browser;
    this.page = await browserManager.getPage();

    logger.debug("Navigating to WhatsApp...");
    await browserManager.navigateToWhatsApp();

    logger.debug("Waiting for UI ready...");
    await browserManager.waitForUIReady();
  }

  /**
   * Initialize message watcher
   */
  async _initializeWatcher() {
    logger.debug("Initializing message watcher...");
    this.watcher = new MessageWatcher(this.page, (messageData) =>
      this.onKeywordDetected(messageData),
    );

    const watcherReady = await this.watcher.initialize();
    if (!watcherReady) {
      throw new Error("Watcher initialization failed");
    }
  }

  /**
   * Start monitoring for messages
   */
  async _startMonitoring() {
    logger.debug("Starting message polling...");
    this.pollInterval = await this.watcher.startPolling();
    this.isRunning = true;

    // Add keepalive to prevent process from exiting
    setInterval(() => {
      logger.debug("System keepalive tick");
    }, KEEPALIVE_INTERVAL_MS);
  }

  /**
   * Print ready message with configuration
   */
  _printReadyMessage() {
    logger.info("========================================");
    logger.info("✅ System Ready - Monitoring Messages");
    logger.info("========================================");
    logger.info(`Keywords: ${config.detection.keywords.join(", ")}`);
    logger.info(`Alarm sound: ${config.alarm.soundFile}`);
    logger.info(`Stop alarm with: ${config.alarm.stopKeybind}`);
    logger.info("========================================");
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    this.setupKeyboardListener();
    this.setupShutdownHandlers();
  }

  /**
   * Handle keyword detection
   * Triggers alarm and logs the event
   */
  async onKeywordDetected(messageData) {
    try {
      logger.debug("onKeywordDetected callback triggered!");
      const { keyword, text, chatName, timestamp } = messageData;

      logger.info("");
      logger.info("╔════════════════════════════════════════╗");
      logger.info("║       🚨 ALARM TRIGGERED 🚨            ║");
      logger.info("╚════════════════════════════════════════╝");
      logger.info(`Keyword: ${keyword}`);
      logger.info(`Chat: ${chatName || "Unknown"}`);
      logger.info(`Message: ${text.substring(0, 80)}`);
      logger.info(`Time: ${timestamp}`);
      logger.info("");

      // Start alarm
      logger.debug("Calling alarm.start()...");
      await alarm.start();
      logger.debug("alarm.start() completed");
    } catch (error) {
      logger.error(`Keyword detection handler error: ${error.message}`);
      logger.error(error.stack);
    }
  }

  /**
   * Setup keyboard listener for stopping alarm
   */
  setupKeyboardListener() {
    // Listen for ESC key to stop alarm
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (key) => {
      const char = key.toString();
      if (char === "\u001b") {
        // ESC key pressed
        logger.info("Stop signal received (ESC)");
        alarm.stop();
        logger.info(
          "✅ Alarm stopped - System still monitoring, Go back to bed😁",
        );
      }
      if (char === "\u0003" || char === "q") {
        // CTRL+C or Q pressed
        this.shutdown();
      }
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    process.on("SIGINT", () => {
      logger.info("SIGINT signal received: shutting down gracefully...");
      this.shutdown();
    });

    process.on("SIGTERM", () => {
      logger.info("SIGTERM signal received: shutting down gracefully...");
      this.shutdown();
    });

    process.on("exit", () => {
      this.cleanup();
    });
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown() {
    try {
      if (!this.isRunning) return;

      logger.info("_________________________");
      logger.info("Shutting down Sa7eny🏃‍♂️‍➡️...");

      this.isRunning = false;

      // Stop alarm
      if (alarm) {
        await alarm.cleanup();
      }

      // Stop polling
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }

      // Cleanup watcher
      if (this.watcher) {
        await this.watcher.cleanup();
      }

      // Close browser
      if (browserManager) {
        await browserManager.close();
      }

      logger.info("✅ System shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error(`Shutdown error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Final cleanup
   */
  cleanup() {
    try {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
    } catch (error) {
      logger.debug(`Cleanup error: ${error.message}`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const system = new WhatsAppAlarmSystem();
  await system.start();
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Start the system
main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
