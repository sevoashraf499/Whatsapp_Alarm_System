/**
 * DOM Watcher Module
 * Monitors WhatsApp for incoming messages using MutationObserver
 * Detects new text messages and triggers keyword matching
 */

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  extractMessageText,
  isSystemMessage,
  matchKeywords,
  hashText,
  normalizeArabicText,
  getMessageTimestamp,
} from "../utils/textMatcher.js";

class MessageWatcher {
  constructor(page, onMessageDetected) {
    this.page = page;
    this.onMessageDetected = onMessageDetected;
    this.observerActive = false;
    this.detectedHashes = new Map(); // Track detected message hashes
    this.currentChatName = null;
  }

  /**
   * Initialize the watcher on the page
   * Injects MutationObserver to monitor for new messages
   */
  async initialize() {
    try {
      // Wait for WhatsApp UI to load
      await this.page.waitForSelector('[role="region"]', { timeout: 30000 });
      logger.info("WhatsApp UI loaded, starting message watcher...");

      // Inject observer into page context
      await this.injectObserver();
      this.observerActive = true;
      logger.info("Message watcher initialized");

      return true;
    } catch (error) {
      logger.error(`Watcher initialization error: ${error.message}`);
      return false;
    }
  }

  /**
   * Inject MutationObserver into page context
   * This runs inside the browser, not in Node.js
   */
  async injectObserver() {
    await this.page.evaluateOnNewDocument(() => {
      // Store processed message IDs to avoid duplicates
      window.__processedMessages = new Set();
      window.__messageQueue = [];

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            // Check for new message elements
            mutation.addedNodes.forEach((node) => {
              if (
                node.nodeType === 1 &&
                node.getAttribute &&
                (node.classList.contains("message") ||
                  node.classList.contains("msg") ||
                  node.getAttribute("data-type") === "message")
              ) {
                // Queue message for processing
                window.__messageQueue.push({
                  element: node,
                  timestamp: Date.now(),
                });
              }
            });
          }
        });
      });

      // Start observing the message container
      const messageContainer =
        document.querySelector('[role="region"]') ||
        document.querySelector('[data-testid="conversation-panel-messages"]') ||
        document.querySelector(".messages-container");

      if (messageContainer) {
        observer.observe(messageContainer, {
          childList: true,
          subtree: true,
          characterData: false,
        });
      }
    });
  }

  /**
   * Poll for new messages detected by the injected observer
   */
  async startPolling() {
    const pollInterval = setInterval(async () => {
      try {
        const messages = await this.page.evaluate(() => {
          const result = window.__messageQueue || [];
          window.__messageQueue = []; // Clear queue
          return result.length;
        });

        if (messages > 0) {
          await this.processNewMessages();
        }
      } catch (error) {
        logger.debug(`Polling error: ${error.message}`);
      }
    }, config.detection.observer.debounceMs);

    return pollInterval;
  }

  /**
   * Process newly detected messages
   * Extract text, check keywords, avoid duplicates
   */
  async processNewMessages() {
    try {
      const messages = await this.page.evaluate(() => {
        const messageElements = document.querySelectorAll(
          '[data-type="message"], .message, [class*="message"]',
        );

        const newMessages = [];

        messageElements.forEach((el) => {
          // Skip if already processed
          if (el.__processed) return;
          el.__processed = true;

          // Extract message data
          const textElement =
            el.querySelector('[dir="auto"]') || el.querySelector("span");

          const text = textElement?.textContent || "";
          const timestamp =
            el.getAttribute("data-time") ||
            el.querySelector('[class*="time"]')?.textContent ||
            new Date().toISOString();

          // Determine if outgoing (sent by user)
          const isOutgoing =
            el.classList.contains("message-out") ||
            el.getAttribute("data-is-sent") === "true" ||
            el.querySelector('[class*="out"]') !== null;

          if (text && !isOutgoing) {
            newMessages.push({
              text: text.trim(),
              timestamp,
              isOutgoing,
            });
          }
        });

        return newMessages;
      });

      // Filter and process messages
      for (const msg of messages) {
        await this.handleMessage(msg);
      }
    } catch (error) {
      logger.debug(`Message processing error: ${error.message}`);
    }
  }

  /**
   * Handle individual message
   * Check for keywords and duplicate protection
   */
  async handleMessage(message) {
    try {
      const { text } = message;

      if (!text) return;

      // Duplicate protection: check message hash
      if (config.detection.enableDuplicateProtection) {
        const hash = hashText(text);
        const now = Date.now();

        if (this.detectedHashes.has(hash)) {
          const lastDetected = this.detectedHashes.get(hash);
          if (now - lastDetected < config.detection.duplicateCacheTTL) {
            logger.debug("Duplicate message detected, skipping");
            return;
          }
        }

        // Update hash cache
        this.detectedHashes.set(hash, now);
      }

      // Clean old hashes from cache (prevent memory leak)
      if (this.detectedHashes.size > 1000) {
        const now = Date.now();
        for (const [hash, timestamp] of this.detectedHashes) {
          if (now - timestamp > config.detection.duplicateCacheTTL) {
            this.detectedHashes.delete(hash);
          }
        }
      }

      // Check for keywords
      const matchedKeyword = this.findMatchedKeyword(text);
      if (matchedKeyword) {
        logger.info(
          `✅ KEYWORD DETECTED: "${matchedKeyword}" in message: "${text.substring(0, 50)}..."`,
        );

        // Get current chat name if chat filtering is enabled
        let chatName = null;
        if (config.detection.chatFilter.enabled) {
          chatName = await this.getCurrentChatName();
          if (!this.isChatAllowed(chatName)) {
            logger.debug(
              `Chat "${chatName}" not in whitelist, ignoring message`,
            );
            return;
          }
        }

        // Trigger callback
        if (this.onMessageDetected) {
          this.onMessageDetected({
            keyword: matchedKeyword,
            text: text,
            chatName: chatName,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.debug(`Message handling error: ${error.message}`);
    }
  }

  /**
   * Find which keyword matched in text
   */
  findMatchedKeyword(text) {
    try {
      for (const keyword of config.detection.keywords) {
        if (
          matchKeywords(text, [keyword], {
            caseSensitive: config.detection.caseSensitive,
            wholeWordMatch: config.detection.wholeWordMatch,
          })
        ) {
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
   * Get currently active chat name
   */
  async getCurrentChatName() {
    try {
      const chatName = await this.page.evaluate(() => {
        // Try various selectors for chat header
        const header =
          document.querySelector('[data-testid="conversation-header-title"]') ||
          document.querySelector("header span") ||
          document.querySelector('[class*="header"] span');

        return header?.textContent?.trim() || "Unknown";
      });

      this.currentChatName = chatName;
      return chatName;
    } catch (error) {
      logger.debug(`Get chat name error: ${error.message}`);
      return "Unknown";
    }
  }

  /**
   * Check if chat is allowed by filter
   */
  isChatAllowed(chatName) {
    const { enabled, mode, whitelistedChats } = config.detection.chatFilter;

    if (!enabled) return true;

    if (mode === "whitelist") {
      return whitelistedChats.some((allowed) =>
        chatName.toLowerCase().includes(allowed.toLowerCase()),
      );
    }

    if (mode === "active") {
      return chatName !== "Unknown"; // Accept any active chat
    }

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
