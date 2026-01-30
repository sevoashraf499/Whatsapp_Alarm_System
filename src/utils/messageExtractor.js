/**
 * Message Extractor Utility
 * Browser-side functions for extracting message data from WhatsApp DOM
 * These functions serve as reference implementations and can be used in Node.js context
 * The same logic is replicated inline in watcher.js for browser context execution
 */

/**
 * Get message container selectors
 */
export const MESSAGE_SELECTORS = {
  container: '[data-testid*="msg-container"]',
  containerFallback: ".message-in",
  meta: '[data-testid="msg-meta"]',
  time: 'span[data-testid="msg-time"]',
  timeClass: 'span[class*="time"]',
};

/**
 * Check if a message is outgoing (sent by user)
 * @param {HTMLElement} node - DOM node to check
 * @returns {boolean} True if message is outgoing
 */
export function isOutgoingMessage(node) {
  return (
    node
      .closest('[data-testid*="msg-container"]')
      ?.classList.contains("message-out") ||
    node.closest(".message-out") !== null
  );
}

/**
 * Extract message timestamp from WhatsApp DOM
 * @param {HTMLElement} node - Message node
 * @returns {number} Timestamp in milliseconds
 */
export function extractMessageTimestamp(node) {
  const messageContainer =
    node.closest('[data-testid*="msg-container"]') ||
    node.closest(".message-in");
  let messageTimestamp = Date.now();

  if (messageContainer) {
    const timeElement =
      messageContainer.querySelector('[data-testid="msg-meta"]') ||
      messageContainer.querySelector('span[data-testid="msg-time"]') ||
      messageContainer.querySelector('span[class*="time"]');

    if (timeElement) {
      const timeText =
        timeElement.getAttribute("data-pre-plain-text") ||
        timeElement.textContent;
      const parsedTime = new Date(timeText).getTime();
      if (!isNaN(parsedTime)) {
        messageTimestamp = parsedTime;
      }
    }
  }

  return messageTimestamp;
}

/**
 * Extract text content from message node
 * @param {HTMLElement} node - Message node
 * @returns {string} Trimmed text content
 */
export function extractMessageText(node) {
  return node.textContent?.trim() || "";
}

/**
 * Validate if message text meets minimum requirements
 * @param {string} text - Message text
 * @param {number} minLength - Minimum length required
 * @returns {boolean} True if text is valid
 */
export function isValidMessageText(text, minLength = 2) {
  return text && text.length > minLength;
}

/**
 * Create message data object
 * @param {HTMLElement} node - Message node
 * @param {number} minLength - Minimum text length
 * @returns {Object|null} Message data or null if invalid
 */
export function createMessageData(node, minLength = 2) {
  const text = extractMessageText(node);

  if (!isValidMessageText(text, minLength)) {
    return null;
  }

  if (isOutgoingMessage(node)) {
    return null; // Skip outgoing messages
  }

  return {
    text: text,
    timestamp: extractMessageTimestamp(node),
    detectedAt: Date.now(),
  };
}

export default {
  MESSAGE_SELECTORS,
  isOutgoingMessage,
  extractMessageTimestamp,
  extractMessageText,
  isValidMessageText,
  createMessageData,
};
