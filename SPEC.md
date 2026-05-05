# NoBadCookies - Technical Specification

## Overview

NoBadCookies is a browser extension that combines two core functionalities:
1. **Automatic cookie banner removal** - Hides GDPR/cookie consent banners and auto-accepts necessary cookies
2. **Cookie management** - View, edit, create, and delete cookies via popup/side panel/devtools

## Architecture

### Manifest V3 Structure

```
NoBadCookies/
├── manifest.json                    # Extension manifest (MV3)
├── src/
│   └── data/
│       ├── background.js            # Service worker - main controller
│       ├── css/
│       │   └── common.css          # CSS rules to hide cookie banners
│       ├── js/
│       │   ├── 0_defaultClickHandler.js  # Auto-click "Accept" buttons
│       │   ├── 5_clickHandler.js         # Site-specific click logic
│       │   ├── 8_googleHandler.js       # Google-specific handling
│       │   └── embedsHandler.js         # Handle embedded content
│       ├── rules.js                # Domain-to-handler mapping
│       └── rules.json              # Declarative net request rules
├── interface/
│   ├── popup/
│   │   ├── cookie-list.html       # Popup UI
│   │   ├── cookie-list.js         # Popup logic
│   │   ├── cookieHandlerPopup.js  # Popup cookie handler
│   │   ├── approved-suppliers.html # Approved suppliers management
│   │   ├── approved-suppliers.js  # Approved suppliers logic
│   │   └── favicon.png            # Popup favicon asset
│   ├── lib/
│   │   ├── browserDetector.js     # Cross-browser API detection
│   │   ├── genericCookieHandler.js # Base cookie operations
│   │   └── style.css              # Shared styles
│   └── sidepanel/                 # Chrome side panel (future)
│   └── devtools/                  # DevTools panel (future)
└── icons/                          # Extension icons
```

## Core Components

### 1. Background Service Worker (`src/data/background.js`)

The central controller that manages both cookie banner removal and cookie operations.

#### State Management

```javascript
let tabList = {};  // Tracks open tabs: { tabId: { hostname, whitelisted } }
```

#### Initialization

1. **`onStartup`**: Recreates tab list from currently open tabs, checks whitelist
2. **`onInstalled`**: Sets default values in `chrome.storage.local`:
   - `whitelist`: Array of whitelisted domains (no auto-removal)
   - `showBadge`: Boolean to show/hide badge indicators
   - `approved_cookie_supplier`: Array of domain patterns where cookies persist

#### Tab Event Handlers

**`tabs.onUpdated`**:
- Triggered when tab completes loading
- Extracts hostname from URL
- Checks if domain is whitelisted
- Calls `doTheMagic()` if not whitelisted

**`tabs.onRemoved`**:
- Triggered when tab closes
- Calls `autoRemoveCookies(hostname)` to clean up cookies
- Removes tab from `tabList`

**`tabs.onActivated`**:
- Updates badge indicator for newly activated tab

#### Cookie Banner Removal Flow

```
Tab loads → onUpdated fires
    ↓
Extract hostname from URL
    ↓
Check whitelist (skip if whitelisted)
    ↓
doTheMagic(tabId)
    ├── Inject common.css (hide known banners)
    ├── Inject embedsHandler.js
    └── Check rules.js for domain
        ├── If rule exists → inject specific CSS/JS handler
        └── If no rule → inject 0_defaultClickHandler.js
```

#### Auto-Remove Cookies Flow

```
Tab closes → onRemoved fires
    ↓
Get hostname from tabList[tabId]
    ↓
autoRemoveCookies(hostname)
    ↓
isApprovedSupplier(hostname)
    ├── Check against approved_cookie_supplier patterns
    ├── Supports wildcards: *.domain.com matches subdomains
    └── If approved → return (keep cookies)
    ↓
If NOT approved:
    ├── chrome.cookies.getAll({ domain: hostname })
    ├── chrome.cookies.getAll({ domain: '.' + hostname })
    └── Delete each cookie found
```

#### Pattern Matching

```javascript
function matchesPattern(hostname, pattern):
    - '*' → matches everything
    - '*.domain.com' → matches domain.com and *.domain.com
    - 'domain.com' → exact match only
```

#### Message Handlers

| Message Type | Description | Response |
|-------------|-------------|----------|
| `getAllCookies` | Get cookies for URL | Array of cookies |
| `saveCookie` | Create/update cookie | Cookie object |
| `removeCookie` | Delete a cookie | Removal details |
| `toggleWhitelist` | Add/remove from whitelist | Success status |
| `getWhitelist` | Get whitelisted domains | Array of domains |
| `getApprovedSuppliers` | Get approved suppliers list | Array of patterns |
| `saveApprovedSuppliers` | Update suppliers list | Success status |
| `isApprovedSupplier` | Check if domain is approved | Boolean |

---

### 2. Cookie Banner Removal System

#### CSS Injection (`common.css`)

Massive CSS file with 14,000+ selectors targeting common cookie banner IDs and classes:

```css
#cookieBanner, #cookieConsent, .cookie-banner, .gdpr-modal {
  display: none !important;
  height: 0 !important;
  visibility: hidden !important;
}
```

Selectors target patterns like:
- `[id*="cookie"]`, `[class*="cookie"]`
- `[id*="gdpr"]`, `[class*="consent"]`
- Known frameworks: OneTrust, Cookiebot, Quantcast, etc.

#### JavaScript Click Handlers

**`0_defaultClickHandler.js`** - Default behavior:
- Searches for "Accept", "Decline", "Necessary only" buttons
- Supports hundreds of consent management platforms
- Clicks "Necessary cookies only" when available (privacy-friendly)
- Runs in loop (up to 100 iterations) for dynamic content

**`5_clickHandler.js`** - Site-specific:
- Custom logic for Facebook, YouTube, Instagram, Twitter, etc.
- Uses helper functions: `_id()`, `_sl()`, `_chain()`, `_if()`, `_if_else()`

**`8_googleHandler.js`** - Google-specific:
- Handles Google services' unique consent flows

**`embedsHandler.js`** - Embedded content:
- Handles iframes from AudioBoom, Dailymotion, DailyBuzz
- Auto-accepts in embedded players

#### Rules System (`rules.js`)

Maps domains to specific handlers:

```javascript
const rules = {
  "google.com": { j: "8" },              // Use handler #8
  "facebook.com": { j: "5", s: "..." },  // Custom CSS + handler #5
  "youtube.com": { j: "5" },             // Handler #5
  // 1000+ domains supported
}
```

Properties:
- `j`: JavaScript handler file (without `_clickHandler.js` suffix)
- `s`: Custom CSS string to inject
- `c`: Reference to common CSS rule

---

### 3. Cookie Management System

#### Popup Interface (`interface/popup/`)

**`cookie-list.html`**:
- Main popup UI with cookie list, search, and action buttons
- Includes popup favicon metadata via `<link rel="icon">`
- Uses `<template>` element for cookie item rendering

**`cookie-list.js`**:
- Initializes `CookieHandlerPopup`
- Loads and displays cookies for current tab
- Handles user actions:
  - **Search**: Filters cookies by name/value (300ms debounce)
  - **Add**: Opens form to create new cookie (TODO)
  - **Export**: Downloads cookies as JSON file
  - **Import**: Reads JSON file and imports cookies
  - **Refresh**: Reloads cookie list
  - **Toggle Whitelist**: Enables/disables auto-removal for current domain

**`cookieHandlerPopup.js`**:
```javascript
class CookieHandlerPopup extends GenericCookieHandler {
  getCurrentUrl()       // Gets active tab URL via chrome.tabs.query()
  getAllCookies(url)     // Calls chrome.cookies.getAll()
  saveCookie(cookie)     // Calls chrome.cookies.set()
  removeCookie(name, url) // Calls chrome.cookies.remove()
  checkWhitelist(hostname) // Checks if domain is whitelisted
  toggleWhitelist(hostname) // Toggles whitelist status
}
```

#### Approved Suppliers Management

**`approved-suppliers.html`**:
- Standalone page for managing approved_cookie_supplier list
- Includes popup favicon metadata via `<link rel="icon">`
- Displays current suppliers with remove buttons
- Input field to add new supplier patterns
- Reset to default button

**`approved-suppliers.js`**:
- Loads suppliers from `chrome.storage.local`
- Renders supplier list with remove buttons
- Validates and adds new suppliers
- Resets to default list when requested

Default approved suppliers:
```
*.github.com
*.gmail.com
*.x.com
*.chatgpt.com
*.mksmad.org
```

#### Generic Cookie Handler (`interface/lib/genericCookieHandler.js`)

Base class with shared functionality:

```javascript
class GenericCookieHandler {
  constructor() {
    this.cookies = [];
    this.currentUrl = '';
  }
  async showCookiesForTab()  // Load and display cookies
  renderCookies(cookies)     // Render cookie list to DOM
  searchCookies(query)       // Filter cookies by search term
}
```

#### Browser Detection (`interface/lib/browserDetector.js`)

Handles cross-browser compatibility:

```javascript
const browserDetector = {
  name: 'chrome',  // or 'firefox', 'edge', 'safari'
  getApi()         // Returns chrome or browser object
  supportsPromises() // true for Firefox (browser.* API)
}
```

Detects browser via user agent:
- Firefox: `typeof browser !== 'undefined'`
- Edge: `navigator.userAgent.includes('Edg/')`
- Safari: `navigator.userAgent.includes('Safari') && !Chrome`

---

## Data Flow Diagrams

### Cookie Banner Removal

```
┌─────────────┐     onUpdated     ┌──────────────────┐
│   Web Page  │ ────────────────> │ Background Script │
└─────────────┘                   └──────────────────┘
                                           │
                                           │ doTheMagic(tabId)
                                           ↓
                              ┌────────────────────────┐
                              │ Check Whitelist        │
                              │ If whitelisted → skip  │
                              └────────────────────────┘
                                           │
                                           ↓
                        ┌──────────────────────────────┐
                        │ Inject common.css            │
                        │ Hides known banner selectors│
                        └──────────────────────────────┘
                                           │
                                           ↓
                        ┌──────────────────────────────┐
                        │ Check rules.js for domain    │
                        │ - Custom CSS? → inject       │
                        │ - Custom JS? → inject handler│
                        │ - No rule? → use default     │
                        └──────────────────────────────┘
                                           │
                                           ↓
                              ┌────────────────────┐
                              │ Content Script     │
                              │ Search & click     │
                              │ "Accept" buttons   │
                              └────────────────────┘
```

### Auto-Remove Cookies

```
┌─────────────┐     onRemoved     ┌──────────────────┐
│ Tab Closed  │ ────────────────> │ Background Script │
└─────────────┘                   └──────────────────┘
                                           │
                                           │ autoRemoveCookies(hostname)
                                           ↓
                              ┌────────────────────────┐
                              │ isApprovedSupplier()   │
                              │ Check patterns:        │
                              │ *.github.com           │
                              │ *.gmail.com            │
                              │ etc.                   │
                              └────────────────────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                    Approved           Not Approved        Error
                          │                │
                          ↓                ↓
              ┌──────────────┐    ┌──────────────────┐
              │ Keep cookies │    │ chrome.cookies.   │
              │ (do nothing) │    │ getAll()          │
              └──────────────┘    │ For each cookie:   │
                                  │ chrome.cookies.   │
                                  │ remove()          │
                                  └──────────────────┘
```

---

## Storage Schema

### `chrome.storage.local`

```javascript
{
  // Whitelisted domains (no auto-removal of banners)
  "whitelist": [
    "example.com",
    "test.org"
  ],

  // Show badge indicators on icon
  "showBadge": true,

  // Domains where cookies persist after tab close
  // Supports wildcards: *.domain.com
  "approved_cookie_supplier": [
    "*.github.com",
    "*.gmail.com",
    "*.chatgpt.com",
    "*.mksmad.org"
  ]
}
```

---

## Permissions

| Permission | Purpose |
|-----------|---------|
| `cookies` | Read/write/delete cookies via `chrome.cookies` API |
| `tabs` | Get current tab info, detect tab events |
| `storage` | Store whitelist, settings, approved suppliers |
| `scripting` | Inject CSS and JS into web pages |
| `declarativeNetRequest` | Block cookie-related network requests (MV3) |
| `webNavigation` | Detect page navigation for injecting scripts |
| `host_permissions: <all_urls>` | Access cookies for all domains |

---

## Badge Indicators

| Badge | Meaning | Color |
|-------|---------|-------|
| ✅ | Auto-removal active for this site | Green (#00AA00) |
| ⛔ | Site is whitelisted (no auto-removal) | Red (#FF0000) |
| (empty) | Badge disabled in settings | N/A |

---

## Build & Installation

### Loading in Chrome/Edge

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `/home/coder/Projects/NoBadCookies/`

### Loading in Firefox

1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

---

## Future Enhancements

- [ ] Side panel support (Chrome 114+)
- [ ] DevTools panel integration
- [ ] Export formats: Header String, Netscape
- [ ] Import format auto-detection
- [ ] Animation system for cookie changes
- [ ] Full add/edit cookie form
- [ ] Dark mode support
- [ ] i18n support (30+ languages)
- [ ] Statistics dashboard (cookies removed, banners hidden)
