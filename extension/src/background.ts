const SHOW_MESSAGE = { type: "PINPOINT_SHOW" };
const TOGGLE_MESSAGE = { type: "PINPOINT_TOGGLE" };

function isWebPage(url: string | undefined): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

async function toggleToolbar(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined || !isWebPage(tab.url)) return;

  try {
    await chrome.tabs.sendMessage(tab.id, TOGGLE_MESSAGE);
    return;
  } catch {
    const files = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.js ?? []) ?? [];
    if (files.length === 0) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await chrome.tabs.sendMessage(tab.id, SHOW_MESSAGE).catch(() => undefined);
  }
}

chrome.action.onClicked.addListener((tab) => void toggleToolbar(tab));
