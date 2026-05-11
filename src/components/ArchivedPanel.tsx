"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "./AppProvider";

interface ArchivedResource {
  id: string;
  title: string;
  url: string;
  type: string;
  source: string;
  summary: string;
  savedAt: string;
  archivedAt: string;
  topics: string[];
}

const TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  tweet: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  video: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  repo: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
  podcast: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
  other: "bg-surface-hover text-ink-muted",
};

export function ArchivedPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refreshGraph, addToast } = useApp();
  const [resources, setResources] = useState<ArchivedResource[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resources/archived");
      if (res.ok) {
        setResources(await res.json() as ArchivedResource[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchArchived();
  }, [open, fetchArchived]);

  const handleUnarchive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/resources/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unarchive" }),
        });
        if (res.ok) {
          addToast("Resource restored", "success");
          setResources((prev) => prev.filter((r) => r.id !== id));
          await refreshGraph();
        }
      } catch {
        addToast("Failed to restore", "error");
      }
    },
    [refreshGraph, addToast]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
        if (res.ok) {
          addToast("Resource permanently deleted", "success");
          setResources((prev) => prev.filter((r) => r.id !== id));
        }
      } catch {
        addToast("Failed to delete", "error");
      }
    },
    [addToast]
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="fixed top-0 left-0 h-full w-full max-w-md z-40 bg-page/95 backdrop-blur-md border-r border-edge shadow-2xl animate-slide-in-left overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-page/90 backdrop-blur-sm border-b border-edge px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Archive</h2>
            <p className="text-xs text-ink-faint mt-1">
              {resources.length} archived resource{resources.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink transition-colors text-xl leading-none"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Content */}
        {loading && resources.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="w-6 h-6 border-2 border-edge border-t-ink-muted rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && resources.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-ink-faint text-sm">No archived resources</p>
          </div>
        )}

        <div className="divide-y divide-edge-subtle">
          {resources.map((r) => {
            const typeClass = TYPE_COLORS[r.type] || TYPE_COLORS.other;
            return (
              <div key={r.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {r.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeClass}`}>
                        {r.type}
                      </span>
                      <span className="text-xs text-ink-faint truncate">
                        {r.source}
                      </span>
                    </div>
                    {r.summary && (
                      <p className="text-xs text-ink-muted mt-2 line-clamp-2">
                        {r.summary}
                      </p>
                    )}
                    <p className="text-xs text-ink-faint mt-1">
                      Archived {new Date(r.archivedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleUnarchive(r.id)}
                    className="h-8 px-3 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-xs text-ink-secondary hover:text-ink transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="h-8 px-3 rounded-lg bg-surface hover:bg-red-500/10 border border-edge hover:border-red-500/30 text-xs text-ink-secondary hover:text-red-500 transition-colors"
                  >
                    Delete forever
                  </button>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto h-8 px-3 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-xs text-ink-faint hover:text-ink-secondary transition-colors flex items-center gap-1"
                  >
                    Open link
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
