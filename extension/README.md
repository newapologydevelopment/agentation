# Pinpoint Studio Feedback Chrome Extension

This Manifest V3 extension injects the existing Agentation toolbar without changing the package or companion server. The expanded toolbar appears automatically on regular HTTP and HTTPS pages.

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

1. Open or reload the page you want to review.
2. Click the Pinpoint extension icon whenever you want to show or hide the floating toolbar.
3. Add feedback, then use the **Notes** tab to review, edit, or delete notes saved on the current site.
4. Use the **N** action to select a Notion page and export.

The toolbar still appears immediately the first time the extension runs on a site. After that, every extension-icon click toggles the toolbar in place; it never opens an intermediate popup. Companion-server settings remain available from the extension's **Options** entry in Chrome.

The source build defaults to a local companion at `http://localhost:4747`. A hosted endpoint can be embedded at build time with `VITE_PINPOINT_ENDPOINT`.

The extension stores enabled origins and the companion-server URL in Chrome sync storage. Notion and OpenRouter credentials remain on the server.

## Package

```bash
npm run package
```

This creates `extension/pinpoint-studio-feedback.zip` for distribution or manual installation tooling.
