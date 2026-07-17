import { createRoot, type Root } from "react-dom/client";
import { Agentation } from "agentation-src";
import { isOriginEnabled, readSettings, STORAGE_KEY } from "./settings";

const MOUNT_ID = "pinpoint-studio-feedback-extension";
const TOOLBAR_HIDDEN_SESSION_KEY = "agentation-session-toolbar-hidden";
type PinpointRuntime = {
  root: Root | null;
  mountNode: HTMLDivElement | null;
  storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0];
  pageShowListener: () => void;
  messageListener: Parameters<typeof chrome.runtime.onMessage.addListener>[0];
};

const runtimeHost = globalThis as typeof globalThis & {
  __pinpointStudioFeedbackRuntime__?: PinpointRuntime;
};

const previous = runtimeHost.__pinpointStudioFeedbackRuntime__;
if (previous) {
  try { chrome.storage.onChanged.removeListener(previous.storageListener); } catch { /* Extension was reloaded. */ }
  try { chrome.runtime.onMessage.removeListener(previous.messageListener); } catch { /* Extension was reloaded. */ }
  window.removeEventListener("pageshow", previous.pageShowListener);
  previous.root?.unmount();
  previous.mountNode?.remove();
}

const state: PinpointRuntime = {
  root: null,
  mountNode: null,
  storageListener: () => undefined,
  pageShowListener: () => undefined,
  messageListener: () => undefined,
};
runtimeHost.__pinpointStudioFeedbackRuntime__ = state;

function unmount(): void {
  state.root?.unmount();
  state.root = null;
  state.mountNode?.remove();
  state.mountNode = null;
}

async function syncToolbar(): Promise<void> {
  const settings = await readSettings();
  const enabled = isOriginEnabled(settings, window.location.origin);

  if (!enabled) {
    unmount();
    return;
  }

  if (!state.mountNode) {
    document.getElementById(MOUNT_ID)?.remove();
    state.mountNode = document.createElement("div");
    state.mountNode.id = MOUNT_ID;
    state.mountNode.dataset.pinpointExtensionRoot = "";
    document.documentElement.appendChild(state.mountNode);
    state.root = createRoot(state.mountNode);
  }

  state.root?.render(
    <Agentation
      key={settings.serverEndpoint}
      notionEndpoint={settings.serverEndpoint}
    />,
  );
}

function clearHiddenState(): void {
  try { sessionStorage.removeItem(TOOLBAR_HIDDEN_SESSION_KEY); } catch { /* Storage may be blocked. */ }
}

async function showToolbar(): Promise<boolean> {
  clearHiddenState();
  unmount();
  await syncToolbar();

  for (let frame = 0; frame < 20; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const toolbar = document.querySelector<HTMLElement>("[data-agentation-toolbar]");
    if (!toolbar) continue;
    const activator = toolbar.querySelector<HTMLElement>('[role="button"][title="Start feedback mode"]');
    activator?.click();
    return true;
  }
  return false;
}

state.storageListener = (changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) void syncToolbar();
};
state.pageShowListener = () => void syncToolbar();
state.messageListener = (message, _sender, sendResponse) => {
  if (message?.type !== "PINPOINT_STATUS" && message?.type !== "PINPOINT_SHOW") return;
  void showToolbar()
    .then((mounted) => sendResponse({ mounted }))
    .catch((error) => sendResponse({ mounted: false, error: error instanceof Error ? error.message : "Mount failed" }));
  return true;
};

chrome.storage.onChanged.addListener(state.storageListener);
chrome.runtime.onMessage.addListener(state.messageListener);
window.addEventListener("pageshow", state.pageShowListener);

void showToolbar();
