import type { ExtensionSettings } from "./settings";

const SHOW_MESSAGE = { type: "PINPOINT_SHOW" };

function isWebPage(url: string | undefined): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

async function showToolbar(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined || !isWebPage(tab.url)) return;

  const origin = new URL(tab.url).origin;
  const stored = await chrome.storage.sync.get("pinpointStudioFeedback");
  const settings = (stored.pinpointStudioFeedback ?? {}) as Partial<ExtensionSettings>;
  await chrome.storage.sync.set({
    pinpointStudioFeedback: {
      ...settings,
      enabledOrigins: { ...(settings.enabledOrigins ?? {}), [origin]: true },
    },
  });

  try {
    await chrome.tabs.sendMessage(tab.id, SHOW_MESSAGE);
    return;
  } catch {
    const files = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.js ?? []) ?? [];
    if (files.length === 0) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await chrome.tabs.sendMessage(tab.id, SHOW_MESSAGE).catch(() => undefined);
  }
}

chrome.action.onClicked.addListener((tab) => void showToolbar(tab));
