/**
 * Browser Module
 * Manages Puppeteer session, persistent login, and browser lifecycle
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userDataDir = path.join(projectRoot, config.browser.userDataDir);
  }

  /**
   * Launch browser with persistent session
   * Uses userDataDir to persist login state across sessions
   */
  async launch() {
    try {
      logger.info("Launching Puppeteer browser...");

      this.browser = await puppeteer.launch({
        headless: !config.browser.headful, // headful mode = false for headless
        args: [
          `--user-data-dir=${this.userDataDir}`,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      logger.info(`Browser launched (headful: ${config.browser.headful})`);
      return this.browser;
    } catch (error) {
      logger.error(`Browser launch error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create or get page
   */
  async getPage() {
    if (!this.page) {
      if (!this.browser) {
        throw new Error("Browser not launched");
      }
      this.page = await this.browser.newPage();

      // Set viewport for better UI rendering
      await this.page.setViewport({ width: 1280, height: 800 });

      logger.info("Page created");
    }
    return this.page;
  }

  /**
   * Navigate to WhatsApp Web
   */
  async navigateToWhatsApp() {
    try {
      const page = await this.getPage();
      logger.info(`Navigating to ${config.browser.whatsappUrl}...`);

      await page.goto(config.browser.whatsappUrl, {
        waitUntil: "networkidle2",
        timeout: config.browser.timeout,
      });

      logger.info("WhatsApp Web loaded");
      return page;
    } catch (error) {
      logger.error(`Navigation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for user to scan QR code and login
   * Listens for navigation to main chat list
   */
  async waitForLogin() {
    try {
      const page = await this.getPage();
      logger.info(
        "Waiting for WhatsApp login (scan QR code or use existing session)...",
      );

      // Wait for main chat list to appear (indicates successful login)
      await page.waitForSelector('[data-testid="chat-list-item-container"]', {
        timeout: config.browser.timeout,
      });

      logger.info("✅ WhatsApp login successful!");
      return true;
    } catch (error) {
      if (error.name === "TimeoutError") {
        logger.error(
          `Login timeout: QR code not scanned within ${config.browser.timeout}ms`,
        );
      } else {
        logger.error(`Login wait error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Wait for WhatsApp UI to be fully ready
   * Checks for key UI elements before starting message detection
   */
  async waitForUIReady() {
    try {
      const page = await this.getPage();
      logger.info("Waiting for WhatsApp UI to be fully ready...");

      // Wait for conversation panel
      await page.waitForSelector('[role="region"]', {
        timeout: 30000,
      });

      // Additional wait for UI stability
      await page.waitForTimeout(2000);

      logger.info("✅ WhatsApp UI is ready for monitoring");
      return true;
    } catch (error) {
      logger.error(`UI ready wait error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute script in page context
   */
  async evaluatePage(script, ...args) {
    if (!this.page) {
      throw new Error("Page not initialized");
    }
    return this.page.evaluate(script, ...args);
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename = "screenshot.png") {
    try {
      if (!this.page) {
        logger.warn("Page not initialized for screenshot");
        return null;
      }

      const filepath = path.join(projectRoot, filename);
      await this.page.screenshot({ path: filepath });
      logger.debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.warn(`Screenshot error: ${error.message}`);
      return null;
    }
  }

  /**
   * Gracefully close browser
   */
  async close() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info("Browser closed gracefully");
    } catch (error) {
      logger.error(`Browser close error: ${error.message}`);
    }
  }

  /**
   * Check if browser is running
   */
  isActive() {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get browser info
   */
  getInfo() {
    return {
      isActive: this.isActive(),
      userDataDir: this.userDataDir,
      whatsappUrl: config.browser.whatsappUrl,
    };
  }
}

export const browserManager = new BrowserManager();
export default browserManager;
