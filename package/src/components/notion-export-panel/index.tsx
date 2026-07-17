"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Annotation } from "../../types";
import {
  exportAnnotationsToNotion,
  getIntegrationStatus,
  getNotionConnectUrl,
  searchNotionPages,
  type IntegrationStatus,
  type NotionPage,
} from "../../utils/notion-export";
import styles from "./styles.module.scss";

export type NotionExportPanelProps = {
  endpoint: string;
  annotations: Annotation[];
  pageTitle: string;
  pageUrl: string;
  accentColor: string;
  lightMode?: boolean;
  onClose: () => void;
  onExported?: () => void;
};

export function NotionExportPanel({
  endpoint,
  annotations,
  pageTitle,
  pageUrl,
  accentColor,
  lightMode = false,
  onClose,
  onExported,
}: NotionExportPanelProps) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [enrich, setEnrich] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextStatus = await getIntegrationStatus(endpoint);
      setStatus(nextStatus);
      if (nextStatus.connected) {
        const nextPages = await searchNotionPages(endpoint);
        setPages(nextPages);
        setSelectedPageId((current) => current || nextPages[0]?.id || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the export server.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status?.connected) return;
    const timer = window.setTimeout(async () => {
      try {
        const nextPages = await searchNotionPages(endpoint, query);
        setPages(nextPages);
        if (!nextPages.some((page) => page.id === selectedPageId)) {
          setSelectedPageId(nextPages[0]?.id || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not search Notion pages.");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [endpoint, query, selectedPageId, status?.connected]);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId),
    [pages, selectedPageId],
  );

  const connect = () => {
    const popup = window.open(getNotionConnectUrl(endpoint), "notion-connect", "width=620,height=760");
    if (!popup) {
      setError("Allow popups to connect Notion, then try again.");
      return;
    }
    const interval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(interval);
        refresh();
      }
    }, 500);
  };

  const handleExport = async () => {
    if (!selectedPageId || exporting) return;
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const result = await exportAnnotationsToNotion({
        endpoint,
        pageId: selectedPageId,
        annotations,
        pageTitle,
        pageUrl,
        enrichWithOpenRouter: enrich,
        accentColor,
      });
      setSuccess(
        `${result.exported} ${result.exported === 1 ? "note" : "notes"} exported${selectedPage ? ` to ${selectedPage.title}` : ""}.`,
      );
      onExported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`${styles.backdrop} ${lightMode ? styles.light : ""}`} onMouseDown={onClose}>
      <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()} aria-label="Export feedback to Notion">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Destination</p>
            <h2>Export to Notion</h2>
          </div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close export panel">×</button>
        </header>

        {loading ? (
          <div className={styles.loading}>Checking Notion connection…</div>
        ) : !status?.connected ? (
          <div className={styles.connectState}>
            <div className={styles.notionMark}>N</div>
            <h3>Connect your studio workspace</h3>
            <p>Authorize once. The connection stays on the local companion server, never in the reviewed page.</p>
            <button className={styles.primary} type="button" onClick={connect} disabled={!status?.canConnect}>
              Connect Notion
            </button>
            {!status?.canConnect && (
              <p className={styles.hint}>Add NOTION_TOKEN, or configure NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI on the server.</p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.connectionRow}>
              <span className={styles.connectedDot} />
              <span>{status.workspaceName || "Notion connected"}</span>
              <span className={styles.connectionMethod}>{status.connectionMethod === "oauth" ? "OAuth" : "Integration token"}</span>
            </div>

            <label className={styles.field}>
              <span>Destination page</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages…" />
            </label>

            <div className={styles.pageList} role="listbox" aria-label="Notion destination page">
              {pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  role="option"
                  aria-selected={selectedPageId === page.id}
                  className={`${styles.pageOption} ${selectedPageId === page.id ? styles.selected : ""}`}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <span className={styles.pageIcon}>{page.icon || "▤"}</span>
                  <span>{page.title}</span>
                  {selectedPageId === page.id && <span className={styles.check}>✓</span>}
                </button>
              ))}
              {pages.length === 0 && <p className={styles.empty}>No shared pages found.</p>}
            </div>

            <label className={`${styles.enrichRow} ${!status.openRouterConfigured ? styles.disabled : ""}`}>
              <input
                type="checkbox"
                checked={enrich}
                onChange={(event) => setEnrich(event.target.checked)}
                disabled={!status.openRouterConfigured}
              />
              <span>
                <strong>Add implementation context</strong>
                <small>
                  {status.openRouterConfigured
                    ? `${status.openRouterModel || "OpenRouter"} adds rationale and acceptance criteria from note metadata.`
                    : "Optional — set OPENROUTER_API_KEY on the server."}
                </small>
              </span>
            </label>

            <div className={styles.summary}>
              <strong>{annotations.length}</strong> {annotations.length === 1 ? "note" : "notes"} · each with a pinned screenshot
            </div>

            <button
              className={styles.primary}
              style={{ backgroundColor: accentColor }}
              type="button"
              onClick={handleExport}
              disabled={!selectedPageId || annotations.length === 0 || exporting}
            >
              {exporting ? "Capturing and exporting…" : `Export ${annotations.length || ""} ${annotations.length === 1 ? "note" : "notes"}`}
            </button>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </section>
    </div>
  );
}
