# WhatsApp Alarm System - Setup & User Guide

A Windows 11 desktop automation system that monitors WhatsApp Web for specific Arabic keywords and triggers a loud alarm when detected.

## 📋 Project Structure

```
whatsapp-alarm-system/
├── src/
│   ├── index.js                 # Main entry point & orchestrator
│   ├── config.js                # Centralized configuration
│   ├── modules/
│   │   ├── browser.js           # Puppeteer session management
│   │   ├── watcher.js           # DOM observer for messages
│   │   └── alarm.js             # Audio alarm & volume control
│   └── utils/
│       ├── logger.js            # Lightweight logging system
│       ├── textMatcher.js       # Arabic text normalization & keyword matching
│       └── volumeControl.js     # Windows volume control
├── assets/
│   └── alarm.mp3                # Alarm audio file (you must add this)
├── user_data/                   # Browser session data (persistent login)
├── package.json                 # Node.js dependencies
└── README.md                    # This file

```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+**
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **Windows 11**
   - System must be Windows 11
   - Administrator access recommended

3. **Alarm Audio File**
   - Obtain a loud alarm sound (MP3 or WAV format)
   - Place it at: `assets/alarm.mp3`
   - Recommended: Find a loud alarm sound online (e.g., from Zedge or FreeSound)

### Installation Steps

```bash
# 1. Navigate to project directory
cd d:\Programming\Personal Projects\Whatsapp_Alarm_System

# 2. Install dependencies
npm install

# 3. Add alarm sound to assets/alarm.mp3
# (Copy your alarm file to the assets folder)

# 4. Start the system
npm start
```

## 📲 First Run

1. Run `npm start`
2. Browser window opens automatically
3. Scan QR code with your WhatsApp mobile app
4. Wait for "✅ System Ready" message
5. System is now monitoring messages

**Note:** QR code is only needed once. Login is saved in `user_data/` folder.

## ⚙️ Configuration

Edit `src/config.js` to customize:

### Keywords to Detect

```javascript
keywords: [
  'الغياب',    // Absence
  'تأخير',    // Delay
  'غياب',     // Absent
  'تأخر',     // Was late
],
```

### Chat Filtering

```javascript
chatFilter: {
  enabled: true,
  mode: 'whitelist',  // 'active' or 'whitelist'
  whitelistedChats: [
    'Mom',
    'Work Group',
    'Family',
  ],
},
```

### Alarm Settings

```javascript
alarm: {
  soundFile: './assets/alarm.mp3',
  forceVolume: true,       // Force system volume to 100%
  targetVolume: 100,       // Target volume percentage
  loop: true,              // Loop indefinitely
  autoStopMs: 0,          // 0 = manual stop only
  stopKeybind: 'Escape',  // Press ESC to stop
},
```

### Logging

```javascript
logging: {
  enabled: true,
  level: 'INFO',    // DEBUG, INFO, WARN, ERROR
  timestamps: true,
},
```

## 🎵 Setting Up Alarm Sound

### Option 1: Download Free Alarm Sound

1. Visit https://freesound.org/
2. Search for "loud alarm"
3. Download MP3 version
4. Place at `assets/alarm.mp3`

### Option 2: Create Your Own

1. Use Audacity (free audio editor)
2. Generate 5-10 second loud tone
3. Export as MP3 to `assets/alarm.mp3`

### Option 3: Use System Sounds

Windows includes alarm sounds:

```powershell
Copy-Item "C:\Windows\Media\alarm01.wav" -Destination "assets\alarm.mp3"
```

## 🔍 How It Works

### Message Detection

- **MutationObserver** monitors DOM for new messages in real-time
- **Detects only new incoming text messages** (ignores old messages and outgoing)
- **Duplicate protection** prevents accidental re-triggering

### Text Processing

- **Arabic normalization**:
  - Unicode NFC normalization
  - Removes tatweel (elongation marks)
  - Removes invisible characters
- **Keyword matching**: Configurable substring or whole-word matching
- **Chat filtering**: Limit to specific chats or current active chat

### Alarm System

- **Volume control**: Forces Windows system volume to 100%
- **Audio loop**: Plays alarm continuously until stopped
- **Keyboard shortcut**: Press `ESC` to stop alarm
- **Graceful fallback**: Continues if volume control fails

## 🛑 Stopping the Alarm

### Method 1: Keyboard Shortcut

Press **ESC** key to stop the alarm immediately

### Method 2: Process Termination

Press **CTRL+C** in terminal to stop both alarm and system

### Method 3: Task Manager

1. Press `CTRL+Shift+Esc`
2. Find "node.exe" or "WhatsApp"
3. Click "End Task"

## 🐛 Troubleshooting

### Alarm Not Playing

- Verify `assets/alarm.mp3` exists
- Try different audio format (WAV instead of MP3)
- Check Windows volume is not muted
- Verify Puppeteer can access audio player

### Messages Not Detected

- Ensure WhatsApp is fully loaded (check browser window)
- Verify keywords are spelled correctly
- Check chat is not muted in WhatsApp
- Disable chat filter to test all chats: `chatFilter.enabled: false`

### Login Issues

1. Delete `user_data/` folder
2. Run `npm start` again
3. Rescan QR code

### Volume Control Not Working

- System will continue with alarm anyway (fallback enabled)
- Manually set volume to 100% before running
- Ensure no other app is controlling volume

## 🔧 Advanced Configuration

### Debug Mode

```javascript
// In src/config.js
logging: {
  level: 'DEBUG',  // Show detailed logs
}
```

### Disable Chat Filtering

```javascript
chatFilter: {
  enabled: false,  // Monitor all chats
}
```

### Case-Sensitive Matching

```javascript
detection: {
  caseSensitive: true,  // Exact case matching
}
```

### Whole-Word Matching

```javascript
detection: {
  wholeWordMatch: true,  // Only match complete words
}
```

## 📊 Log Output Example

```
[2026-01-28T10:30:45.123Z] INFO: Launching Puppeteer browser...
[2026-01-28T10:30:48.456Z] INFO: Browser launched (headful: true)
[2026-01-28T10:30:49.789Z] INFO: Navigating to https://web.whatsapp.com...
[2026-01-28T10:30:52.012Z] INFO: Waiting for WhatsApp login...
[2026-01-28T10:31:05.345Z] INFO: ✅ WhatsApp login successful!
[2026-01-28T10:31:06.678Z] INFO: ✅ WhatsApp UI is ready for monitoring
[2026-01-28T10:31:07.901Z] INFO: ========================================
[2026-01-28T10:31:07.901Z] INFO: ✅ System Ready - Monitoring Messages
[2026-01-28T10:31:07.901Z] INFO: ========================================
[2026-01-28T10:31:15.234Z] INFO: ✅ KEYWORD DETECTED: "الغياب" in message...
[2026-01-28T10:31:15.567Z] INFO: 🔔 ALARM TRIGGERED - Playing audio loop
```

## 🔐 Security Notes

- WhatsApp session is stored locally in `user_data/` (not cloud synced)
- Only your own messages are monitored
- No screenshots or OCR used (pure DOM monitoring)
- No data sent to external servers

## 📝 Limitations & Known Issues

1. **Single Browser Window**: Only one instance can run at a time
2. **WhatsApp UI Changes**: Selectors may need updating if WhatsApp redesigns
3. **Arabic Normalization**: Not all Arabic text variations supported
4. **Volume Control**: Requires `nircmd` or PowerShell (builtin on Windows)
5. **Audio Format**: MP3 and WAV supported, OGG not recommended

## 🚀 Performance

- **Memory**: ~150-300 MB (Puppeteer + Node.js)
- **CPU**: Minimal when idle, spikes only on message detection
- **Network**: Uses WhatsApp Web protocol (standard)
- **Startup Time**: 10-30 seconds

## 🔄 Persistence & Auto-Recovery

- Browser session persists across restarts (no QR code needed)
- Duplicate message protection prevents accidental re-triggers
- Graceful shutdown on errors
- Automatic retry on transient failures

## 💡 Tips & Best Practices

1. **Test First**: Send test messages to yourself before relying on system
2. **Chat Whitelist**: Use whitelist to avoid false positives
3. **Loud Audio**: Use a loud alarm sound to ensure notification
4. **Monitor Logs**: Check console output for debugging
5. **Regular Updates**: Keep Node.js and Puppeteer updated

## 📞 Support & Customization

For custom requirements:

- Modify keywords in `config.js`
- Add more text processing in `textMatcher.js`
- Extend alarm behavior in `alarm.js`
- Add new chat filters in `watcher.js`

## 📜 License

MIT License - Feel free to use and modify

## ⚠️ Disclaimer

- This tool is for personal use and educational purposes
- Ensure you comply with WhatsApp Terms of Service
- Use responsibly and ethically
- Not endorsed by WhatsApp or Meta

---

**Version**: 1.0.0  
**Last Updated**: January 28, 2026  
**Platform**: Windows 11  
**Language**: Node.js (JavaScript)
