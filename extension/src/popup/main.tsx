import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_SETTINGS,
  isSupportedPage,
  readSettings,
  type ExtensionSettings,
  writeSettings,
} from "../settings";
import "./styles.css";

type ConnectionState = "idle" | "checking" | "connected" | "offline";

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [tabUrl, setTabUrl] = useState<string>();
  const [tabId, setTabId] = useState<number>();
  const [ready, setReady] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(DEFAULT_SETTINGS.serverEndpoint);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [message, setMessage] = useState("");

  const supported = isSupportedPage(tabUrl);
  const origin = useMemo(() => supported ? new URL(tabUrl).origin : "", [supported, tabUrl]);
  const hostname = useMemo(() => supported ? new URL(tabUrl).hostname : "This page", [supported, tabUrl]);
  const enabled = supported && settings.enabledOrigins[origin] === true;

  useEffect(() => {
    Promise.all([
      readSettings(),
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]).then(([stored, tabs]) => {
      setSettings(stored);
      setEndpointDraft(stored.serverEndpoint);
      setTabUrl(tabs[0]?.url);
      setTabId(tabs[0]?.id);
      setReady(true);
      void checkConnection(stored.serverEndpoint);
    });
  }, []);

  async function checkConnection(endpoint: string): Promise<void> {
    setConnection("checking");
    try {
      const response = await fetch(`${normalizeEndpoint(endpoint)}/integrations/notion/status`, {
        signal: AbortSignal.timeout(2500),
      });
      setConnection(response.ok ? "connected" : "offline");
    } catch {
      setConnection("offline");
    }
  }

  async function toggleSite(): Promise<void> {
    if (!supported) return;
    const next: ExtensionSettings = {
      ...settings,
      enabledOrigins: { ...settings.enabledOrigins, [origin]: !enabled },
    };
    setSettings(next);
    await writeSettings(next);
    if (!enabled && tabId !== undefined) {
      try {
        const files = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.js ?? []) ?? [];
        if (files.length > 0) {
          await chrome.scripting.executeScript({ target: { tabId }, files });
        }
        setMessage("Toolbar is ready on this page.");
      } catch {
        setMessage("Toolbar enabled. Reload this page once to show it.");
      }
    } else {
      setMessage("Toolbar hidden on this site.");
    }
  }

  async function saveEndpoint(): Promise<void> {
    const endpoint = normalizeEndpoint(endpointDraft);
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      setMessage("Enter a valid HTTP or HTTPS server URL.");
      return;
    }
    const next = { ...settings, serverEndpoint: endpoint };
    setSettings(next);
    setEndpointDraft(endpoint);
    await writeSettings(next);
    setMessage("Server URL saved.");
    await checkConnection(endpoint);
  }

  if (!ready) return <main className="loading">Loading…</main>;

  return (
    <main>
      <header>
        <div className="brand-mark">P</div>
        <div>
          <p className="eyebrow">Studio feedback</p>
          <h1>Pinpoint</h1>
        </div>
      </header>

      <section className="site-card">
        <div className="site-copy">
          <span className={`status-dot ${enabled ? "active" : ""}`} />
          <div>
            <strong>{hostname}</strong>
            <small>{supported ? (enabled ? "Annotation toolbar is enabled" : "Toolbar is off for this site") : "Chrome blocks extensions on this page"}</small>
          </div>
        </div>
        <button className={`toggle ${enabled ? "on" : ""}`} type="button" onClick={toggleSite} disabled={!supported} aria-label={`${enabled ? "Disable" : "Enable"} Pinpoint on ${hostname}`}>
          <span />
        </button>
      </section>

      <section className="server-card">
        <div className="section-heading">
          <span>Companion server</span>
          <span className={`connection ${connection}`}>{connection === "connected" ? "Connected" : connection === "checking" ? "Checking" : "Offline"}</span>
        </div>
        <div className="endpoint-row">
          <input
            aria-label="Companion server URL"
            value={endpointDraft}
            onChange={(event) => setEndpointDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void saveEndpoint(); }}
            spellCheck={false}
          />
          <button type="button" onClick={saveEndpoint}>Save</button>
        </div>
        <p>Notion and OpenRouter credentials stay on this server.</p>
      </section>

      {message && <p className="message" role="status">{message}</p>}

      <footer>
        <span>Enable this site, then close the popup. The toolbar appears at the bottom-right.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
