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
      logger.info("========================================");
      logger.info("WhatsApp Alarm System Starting...");
      logger.info("========================================");

      // Initialize alarm system
      const alarmReady = await alarm.initialize();
      if (!alarmReady) {
        logger.warn(
          "Alarm system initialization incomplete, but continuing...",
        );
      }

      // Launch browser
      await browserManager.launch();
      this.browser = browserManager.browser;
      this.page = await browserManager.getPage();

      // Navigate to WhatsApp
      await browserManager.navigateToWhatsApp();

      // Wait for login (QR code scan or existing session)
      await browserManager.waitForLogin();

      // Wait for UI to be ready
      await browserManager.waitForUIReady();

      // Initialize message watcher
      this.watcher = new MessageWatcher(this.page, (messageData) =>
        this.onKeywordDetected(messageData),
      );

      const watcherReady = await this.watcher.initialize();
      if (!watcherReady) {
        logger.error("Watcher initialization failed");
        await this.shutdown();
        return;
      }

      // Start polling for messages
      this.pollInterval = await this.watcher.startPolling();

      this.isRunning = true;

      logger.info("========================================");
      logger.info("✅ System Ready - Monitoring Messages");
      logger.info("========================================");
      logger.info(`Keywords: ${config.detection.keywords.join(", ")}`);
      logger.info(`Alarm sound: ${config.alarm.soundFile}`);
      logger.info(`Stop alarm with: ${config.alarm.stopKeybind}`);
      logger.info("========================================");

      // Setup keyboard listener for stopping alarm
      this.setupKeyboardListener();

      // Setup graceful shutdown
      this.setupShutdownHandlers();
    } catch (error) {
      logger.error(`System start error: ${error.message}`);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Handle keyword detection
   * Triggers alarm and logs the event
   */
  async onKeywordDetected(messageData) {
    try {
      const { keyword, text, chatName, timestamp } = messageData;

      logger.info("");
      logger.info("╔════════════════════════════════════════╗");
      logger.info("║       🚨 ALARM TRIGGERED 🚨            ║");
      logger.info("╚════════════════════════════════════════╝");
      logger.info(`Keyword: ${keyword}`);
      logger.info(`Chat: ${chatName}`);
      logger.info(`Message: ${text.substring(0, 80)}`);
      logger.info(`Time: ${timestamp}`);
      logger.info("");

      // Start alarm
      await alarm.start();
    } catch (error) {
      logger.error(`Keyword detection handler error: ${error.message}`);
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

      logger.info("");
      logger.info("Shutting down WhatsApp Alarm System...");

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
