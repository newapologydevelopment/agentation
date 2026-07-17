import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { Annotation } from "../types.js";

const NOTION_API = "https://api.notion.com/v1";
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const notionVersion = process.env.NOTION_API_VERSION || "2025-09-03";

type SavedNotionConnection = {
  accessToken: string;
  workspaceName?: string;
  workspaceId?: string;
};

type OAuthState = { createdAt: number };
const oauthStates = new Map<string, OAuthState>();
let oauthConnection: SavedNotionConnection | null | undefined;

function configPath(): string {
  const directory = process.env.AGENTATION_CONFIG_DIR || join(homedir(), ".agentation");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return join(directory, "notion.json");
}

function loadSavedConnection(): SavedNotionConnection | null {
  if (oauthConnection !== undefined) return oauthConnection;
  try {
    const path = configPath();
    oauthConnection = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as SavedNotionConnection)
      : null;
  } catch {
    oauthConnection = null;
  }
  return oauthConnection;
}

function saveConnection(connection: SavedNotionConnection): void {
  oauthConnection = connection;
  writeFileSync(configPath(), JSON.stringify(connection, null, 2), { mode: 0o600 });
}

function getToken(): { token: string; method: "oauth" | "token"; workspaceName?: string } | null {
  const envToken = process.env.NOTION_TOKEN;
  if (envToken) return { token: envToken, method: "token", workspaceName: process.env.NOTION_WORKSPACE_NAME };
  const saved = loadSavedConnection();
  return saved ? { token: saved.accessToken, method: "oauth", workspaceName: saved.workspaceName } : null;
}

async function notionRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const connection = getToken();
  if (!connection) throw new Error("Notion is not connected");
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { message?: string }).message || `Notion request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function getNotionStatus() {
  const connection = getToken();
  return {
    connected: !!connection,
    connectionMethod: connection?.method,
    canConnect: !!process.env.NOTION_TOKEN || !!(
      process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET && process.env.NOTION_REDIRECT_URI
    ),
    workspaceName: connection?.workspaceName,
    openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  };
}

export function createNotionOAuthUrl(): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !process.env.NOTION_CLIENT_SECRET || !redirectUri) {
    throw new Error("Notion OAuth is not configured on the server");
  }
  const state = randomUUID();
  oauthStates.set(state, { createdAt: Date.now() });
  for (const [key, value] of oauthStates) {
    if (Date.now() - value.createdAt > 10 * 60 * 1000) oauthStates.delete(key);
  }
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completeNotionOAuth(code: string, state: string): Promise<void> {
  const savedState = oauthStates.get(state);
  if (!savedState || Date.now() - savedState.createdAt > 10 * 60 * 1000) {
    throw new Error("Invalid or expired OAuth state");
  }
  oauthStates.delete(state);

  const clientId = process.env.NOTION_CLIENT_ID!;
  const clientSecret = process.env.NOTION_CLIENT_SECRET!;
  const response = await fetch(`${NOTION_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.NOTION_REDIRECT_URI,
    }),
  });
  const payload = await response.json() as {
    access_token?: string;
    workspace_name?: string;
    workspace_id?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || "Notion authorization failed");
  }
  saveConnection({
    accessToken: payload.access_token,
    workspaceName: payload.workspace_name,
    workspaceId: payload.workspace_id,
  });
}

function pageTitle(page: Record<string, any>): string {
  const properties = page.properties || {};
  for (const property of Object.values(properties) as any[]) {
    if (property?.type === "title" && Array.isArray(property.title)) {
      const title = property.title.map((part: any) => part.plain_text || part.text?.content || "").join("");
      if (title) return title;
    }
  }
  return "Untitled page";
}

export async function searchNotionPages(query = "") {
  const result = await notionRequest<{ results: Array<Record<string, any>> }>("/search", {
    method: "POST",
    body: JSON.stringify({
      query: query || undefined,
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 50,
    }),
  });
  return result.results.map((page) => ({
    id: page.id,
    title: pageTitle(page),
    url: page.url,
    icon: page.icon?.type === "emoji" ? page.icon.emoji : undefined,
  }));
}

type Enrichment = { summary: string; rationale: string; acceptanceCriteria: string[] };

async function enrichAnnotation(annotation: Annotation, pageUrl: string): Promise<Enrichment | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const response = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": pageUrl,
      "X-Title": "Agentation Design Feedback",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You clarify meticulous human design feedback without inventing requirements. Return JSON with summary, rationale, and acceptanceCriteria (string array). Preserve the author's intent and call out uncertainty.",
        },
        {
          role: "user",
          content: JSON.stringify({
            feedback: annotation.comment,
            pageUrl,
            element: annotation.element,
            elementPath: annotation.elementPath,
            selectedText: annotation.selectedText,
            nearbyText: annotation.nearbyText?.slice(0, 1200),
            accessibility: annotation.accessibility,
            reactComponents: annotation.reactComponents,
            sourceFile: (annotation as Annotation & { sourceFile?: string }).sourceFile,
          }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter enrichment failed (${response.status})`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Enrichment;
    return {
      summary: String(parsed.summary || ""),
      rationale: String(parsed.rationale || ""),
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria)
        ? parsed.acceptanceCriteria.map(String).slice(0, 8)
        : [],
    };
  } catch {
    throw new Error("OpenRouter returned invalid structured context");
  }
}

async function uploadScreenshot(dataUrl: string, filename: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) throw new Error("Screenshot must be a PNG or JPEG data URL");
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  const created = await notionRequest<{ id: string; upload_url: string }>("/file_uploads", {
    method: "POST",
    body: JSON.stringify({ mode: "single_part", filename, content_type: contentType }),
  });

  const connection = getToken()!;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  const response = await fetch(created.upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Notion-Version": notionVersion,
    },
    body: form,
  });
  if (!response.ok) throw new Error(`Notion screenshot upload failed (${response.status})`);
  return created.id;
}

function richText(content: string, options: { bold?: boolean; italic?: boolean } = {}) {
  return [{
    type: "text",
    text: { content: content.slice(0, 2000) },
    annotations: { bold: !!options.bold, italic: !!options.italic },
  }];
}

function paragraph(content: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(content) } };
}

async function appendBlocks(pageId: string, children: unknown[]): Promise<void> {
  for (let index = 0; index < children.length; index += 100) {
    await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(index, index + 100) }),
    });
  }
}

export async function exportToNotion(input: {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  enrichWithOpenRouter?: boolean;
  annotations: Array<{ annotation: Annotation; screenshot: string }>;
}) {
  if (!input.pageId || !input.pageUrl || !Array.isArray(input.annotations) || input.annotations.length === 0) {
    throw new Error("pageId, pageUrl, and at least one annotation are required");
  }

  const blocks: any[] = [
    { object: "block", type: "divider", divider: {} },
    { object: "block", type: "heading_1", heading_1: { rich_text: richText(`Design feedback — ${input.pageTitle || input.pageUrl}`) } },
    paragraph(`Reviewed page: ${input.pageUrl}`),
    paragraph(`Exported ${new Date().toLocaleString()} · ${input.annotations.length} ${input.annotations.length === 1 ? "note" : "notes"}`),
  ];

  let enriched = 0;
  for (let index = 0; index < input.annotations.length; index++) {
    const { annotation, screenshot } = input.annotations[index];
    if (!annotation?.comment || !screenshot) throw new Error(`Note ${index + 1} is incomplete`);
    const uploadId = await uploadScreenshot(screenshot, `feedback-${index + 1}.jpg`);
    const context = input.enrichWithOpenRouter
      ? await enrichAnnotation(annotation, input.pageUrl)
      : null;
    if (context) enriched++;

    blocks.push(
      { object: "block", type: "divider", divider: {} },
      { object: "block", type: "heading_2", heading_2: { rich_text: richText(`${index + 1}. ${annotation.element || "Page feedback"}`) } },
      { object: "block", type: "image", image: { type: "file_upload", file_upload: { id: uploadId }, caption: richText(`Pin ${index + 1} — ${annotation.element || "annotated area"}`) } },
      { object: "block", type: "callout", callout: { icon: { type: "emoji", emoji: "💬" }, rich_text: richText(annotation.comment) } },
      paragraph(`Location: ${annotation.elementPath || "Page area"}`),
    );
    if (annotation.selectedText) blocks.push(paragraph(`Selected text: “${annotation.selectedText}”`));
    if (annotation.nearbyText && !annotation.selectedText) blocks.push(paragraph(`Nearby content: ${annotation.nearbyText.slice(0, 1200)}`));
    if (context) {
      blocks.push(
        { object: "block", type: "heading_3", heading_3: { rich_text: richText("Implementation context") } },
        paragraph(context.summary),
        paragraph(`Why this matters: ${context.rationale}`),
        ...context.acceptanceCriteria.map((criterion) => ({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: richText(criterion) },
        })),
      );
    }
  }

  await appendBlocks(input.pageId, blocks);
  return {
    success: true,
    pageId: input.pageId,
    pageUrl: `https://www.notion.so/${input.pageId.replace(/-/g, "")}`,
    exported: input.annotations.length,
    enriched,
  };
}
