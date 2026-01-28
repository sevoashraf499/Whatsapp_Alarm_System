/**
 * DOM Watcher Module
 * Monitors WhatsApp for incoming messages using MutationObserver
 * Detects new text messages and triggers keyword matching
 */

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { matchKeywords, hashText } from "../utils/textMatcher.js";

// Constants
const GRACE_PERIOD_MS = 2000;
const MIN_MESSAGE_LENGTH = 2;

class MessageWatcher {
  constructor(page, onMessageDetected) {
    this._validateConstructorParams(page, onMessageDetected);

    this.page = page;
    this.onMessageDetected = onMessageDetected;
    this.observerActive = false;
    this.detectedHashes = new Map();
    this.startupTime = Date.now();

    logger.info(
      `Watcher initialized at: ${new Date(this.startupTime).toISOString()}`,
    );
  }

  _validateConstructorParams(page, callback) {
    if (!page) throw new Error("Page is required");
    if (typeof callback !== "function")
      throw new Error("Callback must be a function");
  }

  /**
   * Initialize the watcher
   * Sets up the MutationObserver to monitor for new messages
   */
  async initialize() {
    try {
      logger.info("Initializing message watcher...");

      await this._prepareForMonitoring();
      await this._startObserver();

      this.observerActive = true;
      logger.info("Message watcher ready - monitoring for NEW messages only");

      return true;
    } catch (error) {
      logger.error(`Watcher initialization failed: ${error.message}`);
      logger.error(error.stack);
      return false;
    }
  }

  /**
   * Prepare for monitoring by marking existing messages
   */
  async _prepareForMonitoring() {
    await this._markExistingMessagesAsProcessed();
    await this._waitGracePeriod();
    logger.info("Grace period complete - starting to monitor for NEW messages");
  }

  /**
   * Wait for grace period to ensure all existing messages are marked
   */
  async _waitGracePeriod() {
    return new Promise((resolve) => setTimeout(resolve, GRACE_PERIOD_MS));
  }

  /**
   * Start the MutationObserver
   */
  async _startObserver() {
    await this._injectObserver();
  }

  /**
   * Mark all currently visible messages as processed
   * Prevents triggering on old messages when system starts
   */
  async _markExistingMessagesAsProcessed() {
    try {
      const count = await this.page.evaluate(() => {
        const selectors = [
          'div[class*="message-"]',
          'span[dir="ltr"]',
          'span[dir="rtl"]',
          'span[dir="auto"]',
        ];

        const allMessages = document.querySelectorAll(selectors.join(", "));
        allMessages.forEach((el) => {
          el.__processed = true;
        });

        return allMessages.length;
      });

      logger.info(`Marked ${count} existing messages as processed`);
    } catch (error) {
      logger.warn(`Error marking existing messages: ${error.message}`);
    }
  }

  /**
   * Inject MutationObserver into browser context
   * Observer detects and queues new message nodes
   */
  async _injectObserver() {
    await this.page.evaluate(() => {
      window.__messageQueue = [];
      console.log("[WATCHER] Initializing observer...");

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const text = node.textContent?.trim() || "";

                if (text.length > 2) {
                  const isOutgoing =
                    node
                      .closest('[data-testid*="msg-container"]')
                      ?.classList.contains("message-out") ||
                    node.closest(".message-out") !== null;

                  if (!isOutgoing) {
                    window.__messageQueue.push({
                      text: text,
                      timestamp: Date.now(),
                    });
                    console.log("[WATCHER] Queued:", text.substring(0, 30));
                  }
                }
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      console.log("[WATCHER] Observer active");
    });

    logger.info("Observer injected successfully");
  }

  /**
   * Poll for new messages detected by the injected observer
   */
  async startPolling() {
    const pollInterval = setInterval(async () => {
      try {
        // Check if there are messages in the queue
        const queueSize = await this.page.evaluate(() => {
          return (window.__messageQueue || []).length;
        });

        if (queueSize > 0) {
          logger.debug(`Queue has ${queueSize} messages, processing...`);
          await this.processNewMessages();
        }
      } catch (error) {
        logger.debug(`Polling error: ${error.message}`);
      }
    }, config.detection.observer.debounceMs);

    return pollInterval;
  }

  /**
   * Process newly detected messages from the MutationObserver queue
   * Only processes messages that were actually added to the DOM after monitoring started
   */
  async processNewMessages() {
    try {
      // Get messages from the queue (these are ONLY new messages)
      const messages = await this.page.evaluate(() => {
        const result = window.__messageQueue || [];
        window.__messageQueue = []; // Clear queue
        console.log("[WATCHER] Retrieved messages from queue:", result.length);
        return result;
      });

      if (messages.length > 0) {
        logger.info(`Processing ${messages.length} new messages from queue`);

        // Process each message from the queue
        for (const msg of messages) {
          logger.debug(`Message text: "${msg.text}"`);
          await this.handleMessage(msg);
        }
      }
    } catch (error) {
      logger.error(`Message processing error: ${error.message}`);
    }
  }

  /**
   * Handle individual message
   * Applies duplicate protection, keyword matching, and chat filtering
   */
  async handleMessage(message) {
    try {
      const { text } = message;
      if (!text) return;

      logger.debug(`Processing: "${text.substring(0, 30)}..."`);

      if (this._isDuplicate(text)) {
        logger.debug("Duplicate detected, skipping");
        return;
      }

      const matchedKeyword = this._findMatchedKeyword(text);
      if (!matchedKeyword) {
        logger.debug(`No keyword match in: "${text.substring(0, 30)}..."`);
        return;
      }

      logger.info(
        `✅ KEYWORD DETECTED: "${matchedKeyword}" in: "${text.substring(0, 50)}..."`,
      );

      if (await this._shouldFilterByChat()) {
        return;
      }

      this._triggerAlarm({
        keyword: matchedKeyword,
        text: text,
        chatName: await this._getCurrentChatName(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Message handling error: ${error.message}`);
    }
  }

  /**
   * Check if message is a duplicate
   */
  _isDuplicate(text) {
    if (!config.detection.enableDuplicateProtection) return false;

    const hash = hashText(text);
    const now = Date.now();

    if (this.detectedHashes.has(hash)) {
      const lastDetected = this.detectedHashes.get(hash);
      if (now - lastDetected < config.detection.duplicateCacheTTL) {
        return true;
      }
    }

    this.detectedHashes.set(hash, now);
    this._cleanupOldHashes();
    return false;
  }

  /**
   * Clean up old hash entries to prevent memory leak
   */
  _cleanupOldHashes() {
    if (this.detectedHashes.size <= 1000) return;

    const now = Date.now();
    for (const [hash, timestamp] of this.detectedHashes) {
      if (now - timestamp > config.detection.duplicateCacheTTL) {
        this.detectedHashes.delete(hash);
      }
    }
  }

  /**
   * Trigger alarm callback
   */
  _triggerAlarm(messageData) {
    logger.debug("Triggering alarm callback...");
    if (this.onMessageDetected) {
      this.onMessageDetected(messageData);
      logger.debug("Alarm triggered successfully");
    } else {
      logger.error("Alarm callback not defined!");
    }
  }

  /**
   * Check if message should be filtered by chat
   */
  async _shouldFilterByChat() {
    if (!config.detection.chatFilter.enabled) return false;

    logger.debug("Chat filtering enabled, checking...");
    const chatName = await this._getCurrentChatName();
    logger.debug(`Current chat: "${chatName}"`);

    if (!this._isChatAllowed(chatName)) {
      logger.warn(`Chat "${chatName}" not in whitelist, ignoring`);
      return true;
    }

    logger.debug(`Chat "${chatName}" is allowed`);
    return false;
  }

  /**
   * Find matched keyword in text
   * Returns the first keyword that matches, or null
   */
  _findMatchedKeyword(text) {
    try {
      const matchOptions = {
        caseSensitive: config.detection.caseSensitive,
        wholeWordMatch: config.detection.wholeWordMatch,
      };

      for (const keyword of config.detection.keywords) {
        if (matchKeywords(text, [keyword], matchOptions)) {
          return keyword;
        }
      }
      return null;
    } catch (error) {
      logger.debug(`Keyword matching error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current active chat name
   */
  async _getCurrentChatName() {
    try {
      return await this.page.evaluate(() => {
        const headerSelectors = [
          '[data-testid="conversation-info-header-chat-title"]',
          'header [dir="auto"]',
          "header span[title]",
        ];

        for (const selector of headerSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            return (
              element.textContent?.trim() ||
              element.getAttribute("title") ||
              "Unknown"
            );
          }
        }

        return "Unknown";
      });
    } catch (error) {
      logger.debug(`Get chat name error: ${error.message}`);
      return "Unknown";
    }
  }

  /**
   * Check if chat is allowed based on filter mode
   */
  _isChatAllowed(chatName) {
    if (!config.detection.chatFilter.enabled) return true;

    const mode = config.detection.chatFilter.mode;
    const whitelist = config.detection.chatFilter.whitelistedChats;

    if (mode === "whitelist") {
      return whitelist.includes(chatName);
    }

    // Default: allow all
    return true;
  }

  /**
   * Cleanup watcher
   */
  async cleanup() {
    this.observerActive = false;
    this.detectedHashes.clear();
  }
}

export { MessageWatcher };
export default MessageWatcher;
