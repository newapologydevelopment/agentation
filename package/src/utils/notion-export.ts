import type { Annotation } from "../types";
import { capturePinnedScreenshot } from "./screenshot";

export type NotionPage = {
  id: string;
  title: string;
  url?: string;
  icon?: string;
};

export type IntegrationStatus = {
  connected: boolean;
  connectionMethod?: "oauth" | "token";
  canConnect: boolean;
  workspaceName?: string;
  openRouterConfigured: boolean;
  openRouterModel?: string;
};

export type NotionExportResult = {
  success: boolean;
  pageId: string;
  pageUrl?: string;
  exported: number;
  enriched: number;
};

function baseUrl(endpoint: string): string {
  return endpoint.replace(/\/$/, "");
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export function getIntegrationStatus(endpoint: string): Promise<IntegrationStatus> {
  return request(`${baseUrl(endpoint)}/integrations/notion/status`);
}

export async function searchNotionPages(endpoint: string, query = ""): Promise<NotionPage[]> {
  const data = await request<{ pages: NotionPage[] }>(
    `${baseUrl(endpoint)}/integrations/notion/pages?query=${encodeURIComponent(query)}`,
  );
  return data.pages;
}

export function getNotionConnectUrl(endpoint: string): string {
  return `${baseUrl(endpoint)}/integrations/notion/connect`;
}

export async function exportAnnotationsToNotion(options: {
  endpoint: string;
  pageId: string;
  annotations: Annotation[];
  pageTitle: string;
  pageUrl: string;
  enrichWithOpenRouter: boolean;
  accentColor?: string;
}): Promise<NotionExportResult> {
  const screenshots = await Promise.all(
    options.annotations.map((annotation, index) =>
      capturePinnedScreenshot(annotation, index + 1, options.accentColor),
    ),
  );

  const missingScreenshot = screenshots.findIndex((screenshot) => !screenshot);
  if (missingScreenshot !== -1) {
    throw new Error(
      `Could not capture screenshot for note ${missingScreenshot + 1}. Install modern-screenshot and retry.`,
    );
  }

  return request(`${baseUrl(options.endpoint)}/integrations/notion/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pageId: options.pageId,
      pageTitle: options.pageTitle,
      pageUrl: options.pageUrl,
      enrichWithOpenRouter: options.enrichWithOpenRouter,
      annotations: options.annotations.map((annotation, index) => ({
        annotation,
        screenshot: screenshots[index],
      })),
    }),
  });
}
