/**
 * Text Matcher Utility
 * Arabic text normalization and keyword matching
 * Handles Unicode normalization, tatweel removal, invisible character cleanup
 */

import { logger } from "./logger.js";

/**
 * Normalize Arabic text for comparison
 * - Unicode NFC normalization
 * - Remove tatweel (U+0640) - elongation mark
 * - Remove zero-width characters
 * - Remove diacritics (optional)
 */
export function normalizeArabicText(text) {
  if (!text) return "";

  try {
    // Unicode NFC normalization (canonical composition)
    let normalized = text.normalize("NFC");

    // Remove tatweel (ـ) - Arabic elongation mark (U+0640)
    normalized = normalized.replace(/\u0640/g, "");

    // Remove zero-width characters
    normalized = normalized.replace(/[\u200B\u200C\u200D\u200E\u200F]/g, "");

    // Remove soft hyphens
    normalized = normalized.replace(/\u00AD/g, "");

    // Remove right-to-left marks (optional, may affect meaning)
    // normalized = normalized.replace(/[\u202A-\u202E]/g, '');

    return normalized;
  } catch (error) {
    logger.warn(`Arabic normalization error: ${error.message}`);
    return text;
  }
}

/**
 * Create hash of text for duplicate detection
 * Uses simple hash to identify duplicate messages
 */
export function hashText(text) {
  try {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  } catch (error) {
    logger.warn(`Text hashing error: ${error.message}`);
    return null;
  }
}

/**
 * Safe string matching with multiple strategies
 * Returns true if text matches any keyword
 */
export function matchKeywords(text, keywords, options = {}) {
  if (!text || !keywords || keywords.length === 0) {
    return false;
  }

  const { caseSensitive = false, wholeWordMatch = false } = options;

  // Normalize both text and keywords
  const normalizedText = normalizeArabicText(text);
  const normalizedKeywords = keywords.map((kw) => normalizeArabicText(kw));

  // Convert to lowercase if not case-sensitive
  const searchText = caseSensitive
    ? normalizedText
    : normalizedText.toLowerCase();

  for (const keyword of normalizedKeywords) {
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();

    if (wholeWordMatch) {
      // Whole word match (word boundaries)
      // For Arabic, use simple space/punctuation boundaries
      const wordRegex = new RegExp(
        `(^|\\s|[\\p{P}])(${escapeRegex(searchKeyword)})($|\\s|[\\p{P}])`,
        "u",
      );
      if (wordRegex.test(searchText)) {
        return true;
      }
    } else {
      // Substring match (simpler, faster)
      if (searchText.includes(searchKeyword)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract text content from DOM element
 * Handles various message formats and filters bot messages
 */
export function extractMessageText(element) {
  if (!element) return "";

  try {
    // Primary selector for message content
    let textElement = element.querySelector('[dir="auto"]');

    if (!textElement) {
      // Fallback: check for common text containers
      textElement =
        element.querySelector('span[role="textbox"]') ||
        element.querySelector(".message-text") ||
        element.querySelector('[class*="message"]');
    }

    if (!textElement) {
      return "";
    }

    // Get text content
    const text = textElement.textContent || textElement.innerText || "";

    return text.trim();
  } catch (error) {
    logger.debug(`Text extraction error: ${error.message}`);
    return "";
  }
}

/**
 * Check if message is from bot (system message, notification, etc.)
 */
export function isSystemMessage(messageElement) {
  if (!messageElement) return false;

  try {
    // System messages have specific classes or attributes
    const classes = messageElement.className || "";
    const isSystem =
      classes.includes("system") ||
      classes.includes("notification") ||
      messageElement.getAttribute("data-type") === "system";

    return isSystem;
  } catch (error) {
    logger.debug(`System message check error: ${error.message}`);
    return false;
  }
}

/**
 * Get message timestamp (if available)
 */
export function getMessageTimestamp(messageElement) {
  if (!messageElement) return null;

  try {
    const timeElement =
      messageElement.querySelector('[class*="time"]') ||
      messageElement.querySelector("div[title]");

    if (timeElement) {
      return timeElement.getAttribute("title") || timeElement.textContent;
    }

    return null;
  } catch (error) {
    logger.debug(`Timestamp extraction error: ${error.message}`);
    return null;
  }
}

export default {
  normalizeArabicText,
  hashText,
  matchKeywords,
  extractMessageText,
  isSystemMessage,
  getMessageTimestamp,
};
