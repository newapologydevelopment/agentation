export const STORAGE_KEY = "pinpointStudioFeedback";
export const DEFAULT_SERVER_ENDPOINT =
  import.meta.env.VITE_PINPOINT_ENDPOINT || "http://localhost:4747";

export type ExtensionSettings = {
  enabledOrigins: Record<string, boolean>;
  serverEndpoint: string;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabledOrigins: {},
  serverEndpoint: DEFAULT_SERVER_ENDPOINT,
};

export function isOriginEnabled(settings: ExtensionSettings, origin: string): boolean {
  return settings.enabledOrigins[origin] !== false;
}

export async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  return {
    enabledOrigins: value?.enabledOrigins ?? {},
    serverEndpoint: value?.serverEndpoint?.trim() || DEFAULT_SERVER_ENDPOINT,
  };
}

export async function writeSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

export function isSupportedPage(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
