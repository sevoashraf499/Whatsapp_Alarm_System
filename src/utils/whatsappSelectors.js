/**
 * WhatsApp Selectors Utility
 * Centralized WhatsApp Web DOM selectors to avoid duplication
 */

/**
 * Selectors for detecting WhatsApp login state
 */
export const LOGIN_SELECTORS = [
  'div[role="application"]',
  '[data-testid="chat-list"]',
  'div[aria-label="Chat list"]',
];

/**
 * Selectors for chat header (to get chat name)
 */
export const CHAT_HEADER_SELECTORS = [
  '[data-testid="conversation-info-header-chat-title"]',
  'header [dir="auto"]',
  "header span[title]",
];

/**
 * Selectors for message metadata (timestamp)
 */
export const MESSAGE_META_SELECTORS = [
  "[data-pre-plain-text]",
  '[data-testid="msg-meta"]',
  'span[data-testid="msg-time"]',
  'span[class*="time"]',
];

/**
 * Selectors for message containers
 */
export const MESSAGE_CONTAINER_SELECTORS = [
  '[data-testid*="msg-container"]',
  ".message-in",
];

/**
 * Check if any selector matches in the document
 * @param {Array<string>} selectors - Array of CSS selectors
 * @returns {boolean} True if any selector matches
 */
export function checkAnySelector(selectors) {
  return selectors.some((selector) => !!document.querySelector(selector));
}

/**
 * Find first matching element from multiple selectors
 * @param {Array<string>} selectors - Array of CSS selectors
 * @returns {Element|null} First matching element or null
 */
export function findFirstMatch(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Extract text from element using multiple selectors
 * @param {Element} container - Container element
 * @param {Array<string>} selectors - Array of CSS selectors
 * @returns {string} Extracted text or empty string
 */
export function extractTextFromSelectors(container, selectors) {
  const element = findFirstMatchIn(container, selectors);
  if (!element) return "";

  return (
    element.textContent?.trim() || element.getAttribute("title")?.trim() || ""
  );
}

/**
 * Find first matching element within a container
 * @param {Element} container - Container element
 * @param {Array<string>} selectors - Array of CSS selectors
 * @returns {Element|null} First matching element or null
 */
function findFirstMatchIn(container, selectors) {
  for (const selector of selectors) {
    const element = container.querySelector(selector);
    if (element) return element;
  }
  return null;
}

export default {
  LOGIN_SELECTORS,
  CHAT_HEADER_SELECTORS,
  MESSAGE_META_SELECTORS,
  MESSAGE_CONTAINER_SELECTORS,
  checkAnySelector,
  findFirstMatch,
  extractTextFromSelectors,
};
