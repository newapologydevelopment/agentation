import { createRoot, type Root } from "react-dom/client";
import { Agentation } from "agentation-src";
import { readSettings, STORAGE_KEY } from "./settings";

const MOUNT_ID = "pinpoint-studio-feedback-extension";
const runtime = globalThis as typeof globalThis & { __pinpointStudioFeedbackLoaded__?: boolean };
let root: Root | null = null;
let mountNode: HTMLDivElement | null = null;

function unmount(): void {
  root?.unmount();
  root = null;
  mountNode?.remove();
  mountNode = null;
}

async function syncToolbar(): Promise<void> {
  const settings = await readSettings();
  const enabled = settings.enabledOrigins[window.location.origin] === true;

  if (!enabled) {
    unmount();
    return;
  }

  if (!mountNode) {
    mountNode = document.createElement("div");
    mountNode.id = MOUNT_ID;
    mountNode.dataset.pinpointExtensionRoot = "";
    document.documentElement.appendChild(mountNode);
    root = createRoot(mountNode);
  }

  root?.render(
    <Agentation
      key={settings.serverEndpoint}
      notionEndpoint={settings.serverEndpoint}
    />,
  );
}

if (!runtime.__pinpointStudioFeedbackLoaded__) {
  runtime.__pinpointStudioFeedbackLoaded__ = true;
  void syncToolbar();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) void syncToolbar();
  });

  window.addEventListener("pageshow", () => void syncToolbar());
}
