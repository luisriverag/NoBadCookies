# NoBadCookies

A browser extension that combines automatic cookie banner removal with powerful cookie management.
**Stop the pop-ups. Keep the logins. Clear the rest.**

## Features

- **Auto-remove cookie banners** - Automatically hides GDPR/cookie consent banners and clicks "Accept Necessary"
- **Cookie editor** - View, edit, create, and delete cookies from a popup interface
- **Auto-delete cookies on tab close** - Automatically removes cookies when you close a tab (configurable)
- **Approved cookie suppliers** - Whitelist domains that should keep cookies (supports wildcards like `*.github.com`)
- **Prefix wildcard support** - Pattern matching supports `192.168.1.*` for local ranges and similar host prefixes
- **Whitelist support** - Disable auto-removal for specific domains
- **Export/Import** - Export cookies as JSON, import cookie data
- **Manifest V3** - Modern extension architecture
- **Popup favicon** - Custom favicon shown on popup and approved suppliers pages

## Installation

### Chrome / Edge / Opera

1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `NoBadCookies` folder (the repository root containing `manifest.json`)

### Firefox

1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## Usage

### Cookie Banner Removal
- The extension automatically hides cookie banners and accepts necessary cookies
- Click the ⛔ button in the popup to whitelist a site (disable auto-removal)

### Cookie Management
- Click the extension icon to open the cookie manager
- **Search**: Filter cookies by name or value
- **Edit/Create**: Edit existing cookies with prefilled form, then save or cancel
- **Export**: Download all cookies as JSON
- **Import**: Load cookies from a JSON file
- **Refresh**: Reload the cookie list
- **Action status**: Inline success/error feedback is shown for save/delete actions
- **Removal telemetry**: Removed tab shows total removals, failed removals, and retry recoveries

### Managing Approved Suppliers
- Click "Manage Approved Suppliers" in the popup
- Add domains where cookies should **not** be deleted when the tab closes
- Supports wildcards: `*.github.com` matches `docs.github.com` and `api.github.com`
- Default approved suppliers:
  - `*.github.com`
  - `*.gmail.com`
  - `*.chatgpt.com`
  - `*.mksmad.org`
  - `*.riverlan.com`
  - `*.luisriverag.com`
  - `*.amazon.es`
  - `*.printables.com`
  - `192.168.1.*`
  - `*.aliexpress.com`
  - `*.archive.today`
  - `*.archive.ph`
  - `*.archive.is`

## How It Works

### Cookie Banner Removal
1. When a page loads, the extension injects CSS to hide known cookie banners
2. JavaScript finds and clicks "Accept Necessary" buttons from popular consent platforms
3. Site-specific rules handle complex scenarios (Google, Facebook, etc.)

### Auto-Delete Cookies
1. When you close a tab, the extension checks if the domain is an "approved supplier"
2. If **not** approved, all cookies for that domain are deleted
3. If approved, cookies persist (useful for sites you want to stay logged in)
4. Removal telemetry tracks both success and failed deletion attempts for diagnostics

## Technical Details

See [SPEC.md](SPEC.md) for comprehensive technical documentation.

### Architecture
- **Background Service Worker**: Manages tab events, cookie operations, and banner removal
- **Content Scripts**: CSS and JS injected into pages to handle cookie banners
- **Popup UI**: Plain JavaScript interface for cookie management
- **Popup assets**: Includes `interface/popup/favicon.png` for browser-tab branding
- **Storage**: Uses `chrome.storage.local` for settings and whitelists

## Development

```bash
# Clone the repository
git clone https://github.com/luisriverag/NoBadCookies.git
cd NoBadCookies

# Make changes
# Reload extension in browser to test
```

### Running Tests
```bash
npm install
npm test
```

### Coverage Note
The current test suite focuses primarily on behavior and message flows. Jest coverage reporting is configured, but some extension scripts are dynamically loaded/mocked in tests, so the coverage table can appear lower than expected even when core behavior is tested.

## Based On

This extension combines the best of both worlds:
- [I-Still-Dont-Care-About-Cookies](https://github.com/OhMyGuus/I-Still-Dont-Care-About-Cookies) - Cookie banner removal
- [Cookie-Editor](https://github.com/MasterMind2k/cookie-editor) - Cookie management UI

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Issues

Report bugs or request features on the [GitHub Issues](https://github.com/luisriverag/NoBadCookies/issues) page.
