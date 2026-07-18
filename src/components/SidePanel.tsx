"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "./AppProvider";

const TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  tweet: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  video: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  repo: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
  podcast: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
  other: "bg-surface-hover text-ink-muted",
};

function relationshipLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function SidePanel() {
  const {
    selectedResource,
    selectResource,
    clearSelection,
    refreshGraph,
    addToast,
  } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedResource) {
        clearSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedResource, clearSelection]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedResource?.id]);

  const handleArchive = useCallback(async () => {
    if (!selectedResource) return;
    try {
      const res = await fetch(`/api/resources/${selectedResource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (res.ok) {
        addToast("Resource archived", "success");
        clearSelection();
        await refreshGraph();
      }
    } catch {
      addToast("Failed to archive", "error");
    }
  }, [selectedResource, clearSelection, refreshGraph, addToast]);

  const handleDelete = useCallback(async () => {
    if (!selectedResource) return;
    try {
      const res = await fetch(`/api/resources/${selectedResource.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast("Resource deleted", "success");
        clearSelection();
        await refreshGraph();
      }
    } catch {
      addToast("Failed to delete", "error");
    }
  }, [selectedResource, clearSelection, refreshGraph, addToast]);

  if (!selectedResource) return null;

  const typeClass = TYPE_COLORS[selectedResource.type] || TYPE_COLORS.other;
  const domain = (() => {
    try {
      return new URL(selectedResource.url).hostname.replace(/^www\./, "");
    } catch {
      return selectedResource.source;
    }
  })();

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={clearSelection} />

      <div className="fixed top-0 right-0 h-full w-full max-w-md z-40 bg-page/95 backdrop-blur-md border-l border-edge shadow-2xl animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-page/90 backdrop-blur-sm border-b border-edge px-6 py-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-ink leading-tight">
              {selectedResource.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${typeClass}`}>
                {selectedResource.type}
              </span>
              <span className="text-xs text-ink-faint">{domain}</span>
              {selectedResource.author && (
                <span className="text-xs text-ink-faint">
                  by {selectedResource.author}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={clearSelection}
            className="ml-4 text-ink-faint hover:text-ink transition-colors text-xl leading-none shrink-0 mt-1"
            aria-label="Close panel"
          >
            x
          </button>
        </div>

        {/* Link */}
        <div className="px-6 py-3 border-b border-edge">
          <a
            href={selectedResource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 dark:text-blue-400 hover:underline break-all flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {selectedResource.url}
          </a>
        </div>

        {/* Summary */}
        {selectedResource.summary && (
          <div className="px-6 py-4 border-b border-edge">
            <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Summary</h3>
            <p className="text-sm text-ink-secondary leading-relaxed">
              {selectedResource.summary}
            </p>
          </div>
        )}

        {/* Topics */}
        {selectedResource.topics.length > 0 && (
          <div className="px-6 py-4 border-b border-edge">
            <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Topics</h3>
            <div className="flex flex-wrap gap-2">
              {selectedResource.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-xs px-2.5 py-1 rounded-full bg-surface border border-edge text-ink-secondary"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedResource.connections.length > 0 && (
          <div className="px-6 py-4 border-b border-edge">
            <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">
              Connections
            </h3>
            <div className="space-y-3">
              {selectedResource.connections.map((connection) => (
                <button
                  key={connection.resourceId}
                  type="button"
                  className="w-full text-left rounded-lg border border-edge-subtle bg-surface px-3 py-2.5 hover:bg-surface-hover transition-colors"
                  onClick={() => selectResource(connection.resourceId)}
                >
                  <span className="block text-sm font-medium text-ink-secondary">
                    {connection.name}
                  </span>
                  <span className="mt-1 block text-xs capitalize text-ink-faint">
                    {relationshipLabel(connection.relationship)}
                    {" · "}
                    {Math.round(connection.confidence * 100)}%
                  </span>
                  {connection.reason && (
                    <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                      {connection.reason}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="px-6 py-4 border-b border-edge">
          <h3 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Saved</h3>
          <p className="text-sm text-ink-faint">
            {new Date(selectedResource.savedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleArchive}
              className="flex-1 h-9 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-sm text-ink-secondary hover:text-ink transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 h-9 rounded-lg bg-surface hover:bg-red-500/10 border border-edge hover:border-red-500/30 text-sm text-ink-secondary hover:text-red-500 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            ) : (
              <button
                onClick={handleDelete}
                className="flex-1 h-9 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-500 font-medium transition-colors flex items-center justify-center gap-2"
              >
                Confirm delete
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
