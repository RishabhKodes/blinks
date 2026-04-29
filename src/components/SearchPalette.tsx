"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "./AppProvider";

interface SearchResource {
  id: string;
  title: string;
  url: string;
  type: string;
  source: string;
  summary: string;
  topics: string[];
}

interface SearchResults {
  topics: { id: string; name: string; description: string }[];
  resources: SearchResource[];
}

type SearchItem =
  | { type: "topic"; data: { id: string; name: string; description: string } }
  | { type: "resource"; data: SearchResource };

export function SearchPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { selectResource } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    topics: [],
    resources: [],
  });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ topics: [], resources: [] });
      setSelectedIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ topics: [], resources: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(0);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 200);
    },
    [search]
  );

  // Flatten results: topics first, then resources
  const allItems: SearchItem[] = [
    ...results.topics.map((t) => ({ type: "topic" as const, data: t })),
    ...results.resources.map((r) => ({ type: "resource" as const, data: r })),
  ];

  const handleSelectItem = useCallback(
    (item: SearchItem) => {
      if (item.type === "resource") {
        selectResource(item.data.id);
      }
      // Topic results don't navigate anywhere in resource-centric graph
      onClose();
    },
    [selectResource, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && allItems[selectedIndex]) {
        e.preventDefault();
        handleSelectItem(allItems[selectedIndex]);
      }
    },
    [allItems, selectedIndex, handleSelectItem]
  );

  if (!open) return null;

  const hasResults = allItems.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl animate-fade-in">
        <div className="bg-surface border border-edge rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-5 border-b border-edge-subtle">
            <span className="text-ink-muted text-base mr-2">
              /
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search topics and resources..."
              className="flex-1 bg-transparent py-4 text-base text-ink placeholder-ink-faint focus:outline-none"
            />
            {loading && (
              <div className="w-5 h-5 border-2 border-edge border-t-ink-muted rounded-full animate-spin" />
            )}
          </div>

          {/* Results */}
          {hasQuery && (
            <div className="max-h-80 overflow-y-auto">
              {!hasResults && !loading && (
                <p className="px-5 py-8 text-base text-ink-faint text-center">
                  No results found
                </p>
              )}

              {results.topics.length > 0 && (
                <div>
                  <p className="px-5 pt-3 pb-1 text-xs text-ink-faint uppercase tracking-wider">Topics</p>
                  {results.topics.map((topic, i) => (
                    <button
                      key={topic.id}
                      onClick={() => handleSelectItem({ type: "topic", data: topic })}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                        selectedIndex === i ? "bg-surface-hover" : "hover:bg-surface-hover/50"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full border border-edge flex items-center justify-center text-xs text-ink-faint shrink-0">
                        T
                      </span>
                      <div className="min-w-0">
                        <p className="text-base text-ink truncate">{topic.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.resources.length > 0 && (
                <div>
                  <p className="px-5 pt-3 pb-1 text-xs text-ink-faint uppercase tracking-wider">Resources</p>
                  {results.resources.map((resource, i) => {
                    const globalIndex = results.topics.length + i;
                    return (
                      <button
                        key={resource.id}
                        onClick={() => handleSelectItem({ type: "resource", data: resource })}
                        className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${
                          selectedIndex === globalIndex ? "bg-surface-hover" : "hover:bg-surface-hover/50"
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full border border-edge flex items-center justify-center text-xs text-ink-faint shrink-0">
                          R
                        </span>
                        <div className="min-w-0">
                          <p className="text-base text-ink truncate">{resource.title}</p>
                          <p className="text-sm text-ink-muted truncate">{resource.source || resource.type}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-5 py-2.5 border-t border-edge-subtle flex items-center gap-4 text-xs text-ink-faint">
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-ink-muted">up/down</kbd>{" "}navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-ink-muted">enter</kbd>{" "}select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface-hover rounded text-ink-muted">esc</kbd>{" "}close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
