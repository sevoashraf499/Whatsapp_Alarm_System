/**
 * Browser Module
 * Manages Puppeteer session, persistent login, and browser lifecycle
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { LOGIN_SELECTORS } from "../utils/whatsappSelectors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

// Constants
const UI_STABILIZATION_DELAY_MS = 3000;

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.userDataDir = path.join(projectRoot, config.browser.userDataDir);
  }

  /**
   * Launch browser with persistent session
   */
  async launch() {
    try {
      logger.info("Launching Puppeteer browser...");

      this.browser = await puppeteer.launch({
        headless: !config.browser.headful,
        args: this._getBrowserArgs(),
        defaultViewport: null, // Disable default viewport to allow full screen
      });

      logger.info(`Browser launched (headful: ${config.browser.headful})`);
      return this.browser;
    } catch (error) {
      logger.error(`Browser launch error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get browser launch arguments
   */
  _getBrowserArgs() {
    return [
      `--user-data-dir=${this.userDataDir}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--start-maximized", // Full screen window
    ];
  }

  /**
   * Create or get page instance
   */
  async getPage() {
    if (!this.page) {
      this._validateBrowserExists();
      this.page = await this.browser.newPage();
      await this._configurePage(this.page);
      logger.info("Page created");
    }
    return this.page;
  }

  /**
   * Validate browser exists
   */
  _validateBrowserExists() {
    if (!this.browser) {
      throw new Error("Browser not launched");
    }
  }

  /**
   * Configure page settings and event listeners
   */
  async _configurePage(page) {
    await page.setDefaultNavigationTimeout(0);
    await page.setDefaultTimeout(0);

    this._setupPageEventListeners(page);
  }

  /**
   * Setup page and browser event listeners
   */
  _setupPageEventListeners(page) {
    page.on("close", () => {
      logger.warn("Page closed unexpectedly");
    });

    page.on("error", (error) => {
      logger.error(`Page error: ${error.message}`);
    });

    this.browser.on("disconnected", () => {
      logger.error("Browser disconnected! Attempting reconnection...");
    });
  }

  /**
   * Navigate to WhatsApp Web
   */
  async navigateToWhatsApp() {
    try {
      const page = await this.getPage();
      logger.info(`Navigating to ${config.browser.whatsappUrl}...`);

      await page.goto(config.browser.whatsappUrl, {
        waitUntil: "domcontentloaded",
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

      // First check if already logged in
      const alreadyLoggedIn = await this._checkLoginState(page);

      if (alreadyLoggedIn) {
        logger.info("✅ Already logged in to WhatsApp!");
        return true;
      }

      logger.info("Waiting for WhatsApp login (scan QR code)...");

      // Wait for main chat list to appear (indicates successful login)
      await this._waitForLoginSelectors(page);

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
   * Wait for WhatsApp UI to be ready
   */
  async waitForUIReady() {
    try {
      const page = await this.getPage();
      logger.info("Waiting for WhatsApp UI to be fully ready...");

      await this._waitForStabilization();
      const hasUI = await this._checkUIExists(page);

      if (hasUI) {
        logger.info("✅ WhatsApp UI is ready for monitoring");
      } else {
        logger.warn("Could not verify WhatsApp UI, continuing anyway...");
      }

      return true;
    } catch (error) {
      logger.warn(`UI ready wait error: ${error.message}`);
      return true; // Don't fail - continue anyway
    }
  }

  /**
   * Wait for UI to stabilize
   */
  async _waitForStabilization() {
    return new Promise((resolve) =>
      setTimeout(resolve, UI_STABILIZATION_DELAY_MS),
    );
  }

  /**
   * Check if WhatsApp UI exists
   */
  async _checkUIExists(page) {
    return await page.evaluate(() => {
      return (
        document.body.innerText.includes("WhatsApp") ||
        document.querySelector("div") !== null
      );
    });
  }

  /**
   * Check if user is already logged in
   */
  async _checkLoginState(page) {
    return await page.evaluate((selectors) => {
      return selectors.some((selector) => !!document.querySelector(selector));
    }, LOGIN_SELECTORS);
  }

  /**
   * Wait for any login selector to appear
   */
  async _waitForLoginSelectors(page) {
    const promises = LOGIN_SELECTORS.map((selector) =>
      page.waitForSelector(selector, { timeout: config.browser.timeout }),
    );
    await Promise.race(promises);
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
