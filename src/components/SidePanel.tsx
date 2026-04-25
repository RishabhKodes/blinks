"use client";

import { useEffect } from "react";
import { useApp } from "./AppProvider";

const TYPE_COLORS: Record<string, string> = {
  article: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  tweet: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  video: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  repo: "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300",
  podcast: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
  other: "bg-surface-hover text-ink-muted",
};

export function SidePanel() {
  const { selectedTopic, clearSelection } = useApp();

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedTopic) {
        clearSelection();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTopic, clearSelection]);

  if (!selectedTopic) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={clearSelection}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-40 bg-page/95 backdrop-blur-md border-l border-edge shadow-2xl animate-slide-in-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-page/90 backdrop-blur-sm border-b border-edge px-6 py-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-ink leading-tight">
              {selectedTopic.name}
            </h2>
            <p className="text-sm text-ink-faint mt-1">
              {selectedTopic.resources.length} resource{selectedTopic.resources.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={clearSelection}
            className="ml-4 text-ink-faint hover:text-ink transition-colors text-xl leading-none shrink-0 mt-1"
            aria-label="Close panel"
          >
            x
          </button>
        </div>

        {/* Resources */}
        <div className="px-6 py-4">
          {selectedTopic.resources.length === 0 && (
            <p className="text-base text-ink-faint py-8 text-center">
              No resources in this topic yet.
            </p>
          )}

          <div className="space-y-3">
            {selectedTopic.resources.map((resource) => {
              const typeClass = TYPE_COLORS[resource.type] || TYPE_COLORS.other;

              return (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border border-edge hover:border-ink-faint/40 bg-surface hover:bg-surface-hover transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-ink group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors leading-snug">
                        {resource.title}
                      </p>
                      {resource.summary && (
                        <p className="text-sm text-ink-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {resource.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeClass}`}>
                          {resource.type}
                        </span>
                        {resource.author && (
                          <span className="text-xs text-ink-faint">
                            {resource.author}
                          </span>
                        )}
                        {resource.source && (
                          <span className="text-xs text-ink-faint">
                            {resource.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-ink-faint group-hover:text-ink-muted shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
