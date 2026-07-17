const NOTION_API = "https://api.notion.com/v1";
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const NOTION_VERSION = process.env.NOTION_API_VERSION || "2026-03-11";
const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";

type Annotation = {
  comment: string;
  element?: string;
  elementPath?: string;
  selectedText?: string;
  nearbyText?: string;
  accessibility?: string;
  reactComponents?: string;
  sourceFile?: string;
};

type ExportInput = {
  pageId: string;
  pageTitle?: string;
  pageUrl: string;
  enrichWithOpenRouter?: boolean;
  annotations: Array<{ annotation: Annotation; screenshot: string }>;
};

type PinContext = {
  target: string;
  pinLocation: string;
  guidance: string;
  clarification: string | null;
};

function notionToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not configured");
  return token;
}

async function notionRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionToken()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message || `Notion request failed (${response.status})`);
  }
  return payload as T;
}

export function integrationStatus() {
  return {
    connected: !!process.env.NOTION_TOKEN,
    connectionMethod: process.env.NOTION_TOKEN ? "token" : undefined,
    canConnect: false,
    workspaceName: process.env.NOTION_WORKSPACE_NAME,
    openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
  };
}

function titleOf(page: Record<string, unknown>): string {
  const properties = page.properties as Record<string, { type?: string; title?: Array<{ plain_text?: string }> }> | undefined;
  for (const property of Object.values(properties || {})) {
    if (property.type === "title") {
      const title = property.title?.map((part) => part.plain_text || "").join("");
      if (title) return title;
    }
  }
  return "Untitled page";
}

export async function searchPages(query = "") {
  const result = await notionRequest<{ results: Array<Record<string, unknown>> }>("/search", {
    method: "POST",
    body: JSON.stringify({
      query: query || undefined,
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 50,
    }),
  });
  return result.results.map((page) => {
    const icon = page.icon as { type?: string; emoji?: string } | undefined;
    return {
      id: String(page.id),
      title: titleOf(page),
      url: typeof page.url === "string" ? page.url : undefined,
      icon: icon?.type === "emoji" ? icon.emoji : undefined,
    };
  });
}

async function interpretPin(annotation: Annotation, pageUrl: string, screenshot: string): Promise<PinContext | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL || FALLBACK_MODEL;
  const models = primary === fallback ? [primary] : [primary, fallback];
  let failure = "OpenRouter could not interpret the pin";

  for (const model of models) {
    const response = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": pageUrl,
        "X-Title": "Pinpoint Studio Feedback",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Read one design comment and its pinned screenshot. Locate the numbered pin and identify the exact UI target beneath it. Return compact JSON only: {\"target\":string,\"pinLocation\":string,\"guidance\":string,\"clarification\":string|null}. Preserve the author's intent. Add clarification only for genuine ambiguity. Do not repeat the comment or add generic advice.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  comment: annotation.comment,
                  pageUrl,
                  capturedElement: annotation.element,
                  elementPath: annotation.elementPath,
                  selectedText: annotation.selectedText,
                  nearbyText: annotation.nearbyText?.slice(0, 900),
                  accessibility: annotation.accessibility,
                  reactComponents: annotation.reactComponents,
                  sourceFile: annotation.sourceFile,
                }),
              },
              { type: "image_url", image_url: { url: screenshot, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      failure = `${model} failed (${response.status})`;
      continue;
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as PinContext;
      if (!parsed.target || !parsed.pinLocation || !parsed.guidance) continue;
      return {
        target: String(parsed.target).trim().slice(0, 300),
        pinLocation: String(parsed.pinLocation).trim().slice(0, 300),
        guidance: String(parsed.guidance).trim().slice(0, 700),
        clarification: parsed.clarification ? String(parsed.clarification).trim().slice(0, 400) : null,
      };
    } catch {
      failure = `${model} returned invalid JSON`;
    }
  }
  throw new Error(failure);
}

async function uploadImage(dataUrl: string, filename: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) throw new Error("Screenshot must be a PNG or JPEG data URL");
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  const upload = await notionRequest<{ id: string; upload_url: string }>("/file_uploads", {
    method: "POST",
    body: JSON.stringify({ mode: "single_part", filename, content_type: contentType }),
  });
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), filename);
  const response = await fetch(upload.upload_url, {
    method: "POST",
    headers: { Authorization: `Bearer ${notionToken()}`, "Notion-Version": NOTION_VERSION },
    body: form,
  });
  if (!response.ok) throw new Error(`Notion screenshot upload failed (${response.status})`);
  return upload.id;
}

function richText(content: string) {
  return [{ type: "text", text: { content: content.slice(0, 2000) } }];
}

function paragraph(content: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText(content) } };
}

async function appendBlocks(pageId: string, children: unknown[]) {
  for (let index = 0; index < children.length; index += 100) {
    await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(index, index + 100) }),
    });
  }
}

export async function exportReview(input: ExportInput) {
  if (!input.pageId || !input.pageUrl || !input.annotations?.length) {
    throw new Error("pageId, pageUrl, and at least one annotation are required");
  }
  const blocks: unknown[] = [
    { object: "block", type: "divider", divider: {} },
    { object: "block", type: "heading_1", heading_1: { rich_text: richText(`Design feedback — ${input.pageTitle || input.pageUrl}`) } },
    paragraph(`Reviewed page: ${input.pageUrl}`),
    paragraph(`Exported ${new Date().toISOString()} · ${input.annotations.length} ${input.annotations.length === 1 ? "note" : "notes"}`),
  ];
  let enriched = 0;

  for (let index = 0; index < input.annotations.length; index++) {
    const { annotation, screenshot } = input.annotations[index];
    if (!annotation?.comment || !screenshot) throw new Error(`Note ${index + 1} is incomplete`);
    const uploadId = await uploadImage(screenshot, `feedback-${index + 1}.jpg`);
    const context = input.enrichWithOpenRouter ? await interpretPin(annotation, input.pageUrl, screenshot) : null;
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
        { object: "block", type: "heading_3", heading_3: { rich_text: richText("Pin context") } },
        paragraph(`Target: ${context.target}`),
        paragraph(`Pin location: ${context.pinLocation}`),
        paragraph(`Action: ${context.guidance}`),
      );
      if (context.clarification) blocks.push(paragraph(`Clarify: ${context.clarification}`));
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
