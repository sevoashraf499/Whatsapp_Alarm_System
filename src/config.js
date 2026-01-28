/**
 * Configuration Module
 * Centralized settings for WhatsApp monitoring, keyword detection, and alarm behavior
 */

export const config = {
  // Browser & WhatsApp Settings
  browser: {
    headful: true, // Run in headful mode (with visible window)
    userDataDir: "./user_data", // Persist login state (QR scan only once)
    timeout: 120000, // 120 seconds for page load
    whatsappUrl: "https://web.whatsapp.com",
  },

  // Message Detection Settings
  detection: {
    // Keywords to detect (Arabic examples with transliterations)
    keywords: [
      "الغياب", // "Al-Ghiyab" - Absence
      "تأخير", // "Ta'khir" - Delay
      "غياب", // "Ghiyab" - Absent
      "تأخر", // "Ta'akhara" - Was late
      "غاب", // "Ghaba" - Absent (past tense)
    ],

    // Match entire words or substrings
    wholeWordMatch: false, // Set to true for exact word boundaries
    caseSensitive: false, // Arabic is case-sensitive by default

    // Duplicate protection: track message hashes to avoid re-triggering
    enableDuplicateProtection: true,
    duplicateCacheTTL: 3600000, // 1 hour in milliseconds

    // Chat filtering
    chatFilter: {
      enabled: false, // DISABLED - Monitor all chats
      // Mode: 'active' (only current chat) or 'whitelist' (specific chats)
      mode: "whitelist", // 'active' or 'whitelist'
      // Only used if mode is 'whitelist'
      whitelistedChats: [
        "Mom", // Example: Mom's chat
        "Work Group", // Example: Work group
        "Family", // Example: Family group
      ],
    },

    // DOM observer settings
    observer: {
      debounceMs: 500, // Debounce message processing (avoid duplicate detections)
      mutationOptions: {
        childList: true, // Watch for added/removed nodes
        subtree: true, // Watch entire subtree
        characterData: true, // Watch text content changes
      },
    },
  },

  // Alarm System Settings
  alarm: {
    // Audio file path (relative to project root)
    soundFile: "./assets/alarm.mp3",

    // Play indefinitely until manually stopped
    loop: true,

    // Windows volume control
    forceVolume: true, // Force system volume to 100%
    targetVolume: 100, // Volume percentage (0-100)

    // Fallback behavior if volume control fails
    fallbackOnVolumeFailure: true, // Continue alarm even if volume control fails

    // Duration before auto-stop (0 = infinite, requires manual stop)
    autoStopMs: 0,

    // Keyboard shortcut to stop alarm
    stopKeybind: "Escape", // Press ESC to stop
  },

  // Logging Settings
  logging: {
    enabled: true,
    level: "DEBUG", // 'DEBUG', 'INFO', 'WARN', 'ERROR'
    timestamps: true,
    includeStackTrace: false, // Show stack traces on errors
  },

  // Retry & Resilience Settings
  resilience: {
    maxRetries: 3, // Max retries on failure
    retryDelayMs: 2000, // Delay between retries
    gracefulShutdownTimeoutMs: 5000, // Graceful close timeout
  },
};

export default config;
