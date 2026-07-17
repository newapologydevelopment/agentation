# Pinpoint Studio Feedback Chrome Extension

This Manifest V3 extension injects the existing Agentation toolbar without changing the package or companion server. The toolbar stays dormant until you enable the current site from the extension popup.

## Build

```bash
pnpm install
cd extension
npm install
npm run build
```

Run `pnpm install` from the repository root. The extension build compiles the existing Agentation package before bundling it, but does not modify its source.

The unpacked extension is written to `extension/dist`.

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/dist` directory.
5. Pin **Pinpoint Studio Feedback** to the Chrome toolbar.

## Use

1. Start the companion server. It defaults to `http://localhost:4747`.
2. Open the extension on the page you want to review.
3. Enable the current site.
4. Close the popup and use the floating Pinpoint toolbar.
5. Add feedback, then use the **N** action to select a Notion page and export.

The popup stores enabled origins and the companion-server URL in Chrome sync storage. Notion and OpenRouter credentials remain on the server.

## Package

```bash
npm run package
```

This creates `extension/pinpoint-studio-feedback.zip` for distribution or manual installation tooling.
