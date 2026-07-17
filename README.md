<picture>
  <source media="(prefers-color-scheme: dark)" srcset="package/logo-dark.svg">
  <img src="package/logo.svg" alt="Agentation" width="200">
</picture>

<br>

[![npm version](https://img.shields.io/npm/v/agentation)](https://www.npmjs.com/package/agentation)
[![downloads](https://img.shields.io/npm/dm/agentation)](https://www.npmjs.com/package/agentation)

This fork adapts **[Agentation](https://agentation.com)** for meticulous, human-authored design-studio feedback. Click an element, write a note, and export the review to a specific Notion page. Every exported note includes readable page context and its own page screenshot with a numbered pin on the exact target.

## Install

```bash
npm install agentation -D
```

## Usage

```tsx
import { Agentation } from 'agentation';

function App() {
  return (
    <>
      <YourApp />
      <Agentation />
    </>
  );
}
```

The toolbar appears in the bottom-right corner. Click to activate, then click any element to annotate it.

## Features

- **Click to annotate** – Click any element with automatic selector identification
- **Text selection** – Select text to annotate specific content
- **Multi-select** – Drag to select multiple elements at once
- **Area selection** – Drag to annotate any region, even empty space
- **Animation pause** – Freeze all animations (CSS, JS, videos) to capture specific states
- **Structured output** – Copy markdown with selectors, positions, and context
- **Pinned screenshots** – Capture a contextual page image for every note, with a numbered target pin
- **Notion destination picker** – Search and select the exact page before exporting
- **One-click Notion export** – Upload screenshots and append the complete review to the chosen page
- **Optional OpenRouter context** – Read the comment and pinned screenshot to identify the exact target and required action
- **Dark/light mode** – Matches your preference or set manually
- **Zero dependencies** – Pure CSS animations, no runtime libraries

## How it works

Agentation captures class names, selectors, and element positions so AI agents can `grep` for the exact code you're referring to. Instead of describing "the blue button in the sidebar," you give the agent `.sidebar > button.primary` and your feedback.

## Requirements

- React 18+
- Desktop browser (mobile not supported)

## Notion export setup

Run the companion server alongside the app:

```bash
pnpm --filter agentation-mcp start
```

Then choose one Notion connection method.

### Fastest: internal integration token

1. Create a Notion integration with **Read content** and **Insert content** capabilities.
2. Share the destination pages with that integration.
3. Start the server with `NOTION_TOKEN`:

```bash
NOTION_TOKEN=secret_... pnpm --filter agentation-mcp start
```

The toolbar defaults to `http://localhost:4747`. Override it when needed:

```tsx
<Agentation notionEndpoint="https://feedback.example.com" />
```

### OAuth connection

For a reusable studio-wide connection, configure a public Notion integration and its callback URL:

```bash
NOTION_CLIENT_ID=... \
NOTION_CLIENT_SECRET=... \
NOTION_REDIRECT_URI=http://localhost:4747/integrations/notion/callback \
pnpm --filter agentation-mcp start
```

The **Connect Notion** button opens the authorization window. The resulting access token is stored in `~/.agentation/notion.json` with owner-only file permissions; it is never sent to the reviewed page.

The page selector only lists pages that the integration can access. If a page is missing, share it with the integration in Notion and search again.

## Optional OpenRouter context

OpenRouter runs between screenshot capture and Notion block creation. It is off by default for every export. When a reviewer enables **Add implementation context**, the companion server sends the model:

- the original human note;
- the pinned screenshot;
- reviewed page URL;
- element name and DOM path;
- selected or nearby text;
- accessibility, React component, and source-file metadata when available.

The model locates the numbered pin, identifies the UI element or region beneath it, and connects that target to the comment. It returns four compact fields: target, pin location, action, and an optional clarification. The server appends those fields beneath the unchanged human note.

The model does not receive page HTML, the Notion token, or the OpenRouter key.

Configure it only on the server:

```bash
OPENROUTER_API_KEY=sk-or-... \
pnpm --filter agentation-mcp start
```

The default model is `google/gemma-4-26b-a4b-it:free`, the lowest-cost suitable vision model in OpenRouter's current catalog. The server falls back to `google/gemini-2.5-flash-lite` if the free route has no capacity. Override either choice with `OPENROUTER_MODEL` or `OPENROUTER_FALLBACK_MODEL`.

## Export flow

1. Add human feedback pins to the page.
2. Click the **N** button in the toolbar.
3. Connect Notion once, then search for and select the exact destination page.
4. Optionally enable OpenRouter context.
5. Export. The browser captures one pinned screenshot per note; the server uploads those images and appends the review to Notion.

The existing **Copy feedback** action remains available for copying the whole Markdown output.

## Docs

Full documentation at [agentation.com](https://agentation.com)

## License

© 2026 Benji Taylor

Licensed under PolyForm Shield 1.0.0
