/**
 * DOM Watcher Module
 * Monitors WhatsApp for incoming messages using MutationObserver
 * Detects new text messages and triggers keyword matching
 */

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { matchKeywords, hashText } from "../utils/textMatcher.js";
import {
  CHAT_HEADER_SELECTORS,
  MESSAGE_META_SELECTORS,
  MESSAGE_CONTAINER_SELECTORS,
} from "../utils/whatsappSelectors.js";

// Constants
const MIN_MESSAGE_LENGTH = 2;
const MAX_HASH_CACHE_SIZE = 1000;

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
   * Prepare for monitoring
   */
  async _prepareForMonitoring() {
    logger.info("Monitoring for new messages");
  }

  /**
   * Start the MutationObserver
   */
  async _startObserver() {
    await this._injectObserver();
  }

  /**
   * Inject MutationObserver into browser context
   * Observer detects and queues new message nodes
   */
  async _injectObserver() {
    const minLength = MIN_MESSAGE_LENGTH;
    const messageMetaSelectors = MESSAGE_META_SELECTORS;
    const containerSelectors = MESSAGE_CONTAINER_SELECTORS;

    await this.page.evaluate(
      (minLength, metaSelectors, containerSels) => {
        window.__messageQueue = [];
        window.__seenMessageKeys = window.__seenMessageKeys || new Set();
        const timeOnlyPattern = /\d{1,2}:\d{2}\s*(?:AM|PM)?/i;
        const relativeTimePatterns =
          /yesterday|Y[eE][sS][tT][eE][rR][dD][aA][yY]|أمس/i;

        // Utility functions in browser context
        const isOutgoing = (element) => {
          return (
            element?.classList?.contains("message-out") ||
            element?.closest?.(".message-out") !== null
          );
        };

        const findMessageContainer = (node) => {
          if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;

          const directId = node.getAttribute?.("data-id");
          if (directId) return node;

          const closestId = node.closest?.("[data-id]");
          if (closestId) return closestId;

          for (const selector of containerSels) {
            const found = node.closest(selector);
            if (found) return found;
          }

          // Fallback: walk up a few levels and pick a parent that contains a known timestamp node
          let current = node;
          for (let depth = 0; current && depth < 12; depth++) {
            for (const selector of metaSelectors) {
              if (current.querySelector?.(selector)) {
                return current;
              }
            }
            current = current.parentElement;
          }

          return null;
        };

        const parseTimeOnly = (text) => {
          const match = text.match(timeOnlyPattern);
          if (!match) return null;

          const timeStr = match[0].trim();
          const now = new Date();
          const [time, period] = timeStr.split(/\s+/);
          const [hours, minutes] = time.split(":").map(Number);

          let hour24 = hours;
          if (period && period.toUpperCase() === "PM" && hours !== 12) {
            hour24 = hours + 12;
          } else if (period && period.toUpperCase() === "AM" && hours === 12) {
            hour24 = 0;
          }

          const todayWithTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hour24,
            minutes,
          );

          return todayWithTime.getTime();
        };

        const extractMessageKey = (node, container, timeText, text) => {
          if (container) {
            const dataId = container.getAttribute("data-id");
            if (dataId) return `id:${dataId}`;
          }

          const closestWithId = node.closest("[data-id]");
          const closestId = closestWithId?.getAttribute("data-id");
          if (closestId) return `id:${closestId}`;

          if (timeText) return `meta:${timeText}|text:${text}`;

          const timeFallback = parseTimeOnly(text);
          if (timeFallback) return `time:${timeFallback}|text:${text}`;

          return `text:${text.trim().slice(0, 100)}`;
        };

        const extractTimestamp = (nodeOrContainer) => {
          const messageContainer =
            findMessageContainer(nodeOrContainer) || nodeOrContainer;

          if (
            !messageContainer ||
            messageContainer.nodeType !== Node.ELEMENT_NODE
          ) {
            const text = nodeOrContainer?.textContent || "";
            const parsedTime = parseTimeOnly(text);
            if (parsedTime) return parsedTime;
            return null;
          }

          // Try to find timestamp element
          let timeElement = null;
          for (const selector of metaSelectors) {
            timeElement = messageContainer.querySelector(selector);
            if (timeElement) {
              break;
            }
          }

          if (!timeElement) {
            // Fallback: look for a time pattern in container text
            const parsedTime = parseTimeOnly(
              messageContainer.textContent || "",
            );
            if (parsedTime) return parsedTime;
            return null;
          }

          const timeText =
            timeElement.getAttribute("data-pre-plain-text") ||
            timeElement.textContent;

          // Parse WhatsApp format: [1:16 PM, 1/30/2026] +20 10 91920189:
          const whatsappFormatMatch = timeText.match(/\[([^\]]+)\]/);
          if (whatsappFormatMatch) {
            const bracketContent = whatsappFormatMatch[1]; // "1:16 PM, 1/30/2026"
            const parsedTime = new Date(bracketContent).getTime();
            if (!isNaN(parsedTime) && parsedTime > 0) {
              return parsedTime;
            }
          }

          // Check for relative time indicators (old messages)
          if (relativeTimePatterns.test(timeText)) {
            return 0; // Mark as very old
          }

          // Try to parse full date/time
          const parsedTime = new Date(timeText).getTime();
          if (!isNaN(parsedTime) && parsedTime > 0) {
            return parsedTime;
          }

          // If it's just a time like "1:16 PM", assume it's from today
          const parsedTimeOnly = parseTimeOnly(timeText.trim());
          if (parsedTimeOnly) return parsedTimeOnly;

          return null;
        };

        const processNode = (node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          const messageContainer = findMessageContainer(node);
          if (!messageContainer) {
            return;
          }

          const text = messageContainer.textContent?.trim() || "";
          if (text.length <= minLength) {
            return;
          }

          if (isOutgoing(messageContainer)) {
            return;
          }

          const timeElement = messageContainer
            ? metaSelectors
                .map((selector) => messageContainer.querySelector(selector))
                .find((el) => el)
            : null;
          const timeText = timeElement
            ? timeElement.getAttribute("data-pre-plain-text") ||
              timeElement.textContent
            : null;
          const timestamp = extractTimestamp(messageContainer);
          const messageKey = extractMessageKey(
            node,
            messageContainer,
            timeText,
            text,
          );

          const dedupeKey = messageKey
            ? `${messageKey}|${timestamp ?? ""}|${text}`
            : `${text}|${timestamp ?? ""}`;
          if (window.__seenMessageKeys.has(dedupeKey)) {
            return;
          }
          window.__seenMessageKeys.add(dedupeKey);
          window.__messageQueue.push({
            text: text,
            timestamp: timestamp,
            messageKey: messageKey,
          });
        };

        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (
              mutation.type === "childList" &&
              mutation.addedNodes.length > 0
            ) {
              mutation.addedNodes.forEach(processNode);
            }
          });
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      },
      minLength,
      messageMetaSelectors,
      containerSelectors,
    );

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
        return result;
      });

      if (messages.length > 0) {
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
      const { text, timestamp, messageKey } = message;
      if (!text) return;

      logger.debug(
        `Processing message: "${text.substring(0, 30)}..." (timestamp: ${timestamp ? new Date(timestamp).toISOString() : "null"})`,
      );

      // Check if message is old based on timestamp
      if (!this._isRecentMessage(timestamp)) {
        logger.debug("Skipped old message");
        return;
      }

      if (this._isDuplicate(text, timestamp, messageKey)) return;

      const matchedKeyword = this._findMatchedKeyword(text);
      if (!matchedKeyword) {
        logger.debug(`No keyword match in: "${text.substring(0, 30)}..."`);
        return;
      }

      logger.info(
        `✅ KEYWORD DETECTED: "${matchedKeyword}" in: "${text.substring(0, 50)}..."`,
      );

      if (await this._shouldFilterByChat()) return;

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
   * Check if message was sent after system startup
   */
  _isRecentMessage(timestamp) {
    const now = Date.now();
    const startupTimeISO = new Date(this.startupTime).toISOString();
    const timestampISO = timestamp ? new Date(timestamp).toISOString() : "null";
    const startupFloor = new Date(this.startupTime);
    startupFloor.setSeconds(0, 0);
    const startupFloorTime = startupFloor.getTime();

    logger.debug(
      `Timestamp check - message: ${timestampISO}, startup: ${startupTimeISO}`,
    );

    // If timestamp is 0, it's marked as old (e.g., "Yesterday")
    if (timestamp === 0) {
      logger.debug("Marked as old (timestamp=0)");
      return false;
    }

    // If no valid timestamp, reject the message (can't verify it's new)
    if (!timestamp || timestamp === null) {
      logger.debug("No valid timestamp - rejecting");
      return false;
    }

    // Reject messages from the future (clock skew or parse issues)
    if (timestamp > now) {
      const aheadSeconds = Math.floor((timestamp - now) / 1000);
      logger.debug(`Future timestamp (${aheadSeconds}s ahead) - rejecting`);
      return false;
    }

    // Accept messages sent AFTER system startup
    if (timestamp >= startupFloorTime) {
      const ageSeconds = Math.floor((now - timestamp) / 1000);
      logger.debug(`New message (${ageSeconds}s ago) - accepting`);
      return true;
    }

    const ageSeconds = Math.floor((now - timestamp) / 1000);
    logger.debug(`Old message (${ageSeconds}s ago) - rejecting`);
    return false;
  }

  /**
   * Check if message is a duplicate
   */
  _isDuplicate(text, timestamp, messageKey) {
    if (!config.detection.enableDuplicateProtection) return false;

    const now = Date.now();

    const fallbackFingerprint = `${text}|${timestamp ?? ""}`;
    const fallbackHash = hashText(fallbackFingerprint);
    if (this._isHashRecent(fallbackHash, now)) {
      logger.debug("Duplicate detected, skipping");
      return true;
    }

    if (messageKey) {
      const keyFingerprint = `${messageKey}|${timestamp ?? ""}|${text}`;
      const keyHash = hashText(keyFingerprint);
      if (this._isHashRecent(keyHash, now)) {
        logger.debug("Duplicate detected, skipping");
        return true;
      }
      this.detectedHashes.set(keyHash, now);
    }

    this.detectedHashes.set(fallbackHash, now);

    this._cleanupOldHashes();
    return false;
  }

  /**
   * Check if hash was recently detected
   */
  _isHashRecent(hash, currentTime) {
    if (!this.detectedHashes.has(hash)) return false;

    const lastDetected = this.detectedHashes.get(hash);
    return currentTime - lastDetected < config.detection.duplicateCacheTTL;
  }

  /**
   * Clean up old hash entries to prevent memory leak
   */
  _cleanupOldHashes() {
    if (this.detectedHashes.size <= MAX_HASH_CACHE_SIZE) return;

    const now = Date.now();
    const ttl = config.detection.duplicateCacheTTL;

    for (const [hash, timestamp] of this.detectedHashes) {
      if (now - timestamp > ttl) {
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
      this.startupTime = Date.now();
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
      return await this.page.evaluate((selectors) => {
        for (const selector of selectors) {
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
      }, CHAT_HEADER_SELECTORS);
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

  /**
   * Reset in-page dedupe state after alarm stop
   */
  async resetAfterAlarmStop() {
    if (!this.page) return;

    try {
      await this.page.evaluate(() => {
        window.__messageQueue = [];
      });
    } catch (error) {
      logger.debug(`Reset after alarm stop failed: ${error.message}`);
    }
  }
}

export { MessageWatcher };
export default MessageWatcher;
