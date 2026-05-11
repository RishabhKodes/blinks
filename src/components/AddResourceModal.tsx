"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "./AppProvider";

export function AddResourceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addToast, refreshGraph } = useApp();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to let the modal render
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;

      setSubmitting(true);
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl, notes: notes.trim() || undefined }),
        });

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          const resource = data.resource as Record<string, unknown> | undefined;
          const title = resource?.title || data.title || "Resource";
          const topicList = (resource?.topics || data.topics || []) as string[];
          const topics =
            topicList.length > 0
              ? topicList.join(", ")
              : "your library";
          addToast(`Saved '${title}' to ${topics}`, "success");
          await refreshGraph();
          setUrl("");
          setNotes("");
          onClose();
        } else {
          const errData = await res.json().catch(() => null) as Record<string, unknown> | null;
          const msg = (errData?.error as string) || `Failed to save (${res.status})`;
          addToast(msg, "error");
        }
      } catch {
        addToast("Network error. Please try again.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [url, notes, addToast, refreshGraph, onClose]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-surface border border-edge rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-xl font-semibold text-ink mb-5">
                Add Resource
              </h2>

              {/* URL input */}
              <div className="mb-4">
                <label
                  htmlFor="resource-url"
                  className="block text-sm font-medium text-ink-muted uppercase tracking-wider mb-2"
                >
                  URL
                </label>
                <input
                  ref={inputRef}
                  id="resource-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  disabled={submitting}
                  className="w-full bg-input border border-edge rounded-lg px-4 py-3 text-base text-ink placeholder-ink-faint focus:outline-none focus:border-ink-muted focus:ring-1 focus:ring-ink-muted disabled:opacity-50 transition-colors"
                />
              </div>

              {/* Notes textarea */}
              <div>
                <label
                  htmlFor="resource-notes"
                  className="block text-sm font-medium text-ink-muted uppercase tracking-wider mb-2"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="resource-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any context or notes..."
                  rows={3}
                  disabled={submitting}
                  className="w-full bg-input border border-edge rounded-lg px-4 py-3 text-base text-ink placeholder-ink-faint focus:outline-none focus:border-ink-muted focus:ring-1 focus:ring-ink-muted disabled:opacity-50 resize-none transition-colors"
                />
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 text-base text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !url.trim()}
                className="px-6 py-2.5 text-base font-medium bg-accent text-ink-on-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && (
                  <div className="w-4 h-4 border-2 border-ink-on-accent/40 border-t-ink-on-accent rounded-full animate-spin" />
                )}
                {submitting ? "Processing..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
