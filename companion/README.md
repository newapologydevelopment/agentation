# Pinpoint Companion for Vercel

Serverless Notion export and optional OpenRouter pin interpretation for the Chrome extension.

## Environment variables

- `PINPOINT_ACCESS_PATH`: required random URL segment used by the extension.
- `NOTION_TOKEN`: Notion internal integration token.
- `NOTION_WORKSPACE_NAME`: optional label shown in the extension.
- `NOTION_API_VERSION`: optional override; defaults to `2026-03-11`.
- `OPENROUTER_API_KEY`: optional. Enables screenshot interpretation.
- `OPENROUTER_MODEL`: optional primary model override.
- `OPENROUTER_FALLBACK_MODEL`: optional fallback override.

Share each destination page with the Notion integration. The hosted endpoint has this shape:

```text
https://your-project.vercel.app/api/<PINPOINT_ACCESS_PATH>
```

The access path belongs in the private extension build, not Git history.
