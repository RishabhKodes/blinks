"use client";

import { useState, useEffect } from "react";
import { useApp } from "./AppProvider";

interface FileOutputModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
}

interface TopicOption {
  id: string;
  name: string;
}

export function FileOutputModal({ open, onClose, content }: FileOutputModalProps) {
  const { addToast, refreshGraph } = useApp();
  const [action, setAction] = useState<"enhance_topic" | "new_resource">("enhance_topic");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/topics")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTopics(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
            if (data.length > 0 && !topicId) {
              setTopicId(data[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [open, topicId]);

  async function handleSubmit() {
    if (!topicId || saving) return;
    setSaving(true);

    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title: action === "new_resource" ? title || "Q&A Note" : undefined,
          action,
          topicId,
        }),
      });

      if (res.ok) {
        addToast(
          action === "enhance_topic"
            ? "Answer filed to topic"
            : "Answer saved as resource",
          "success"
        );
        refreshGraph();
        onClose();
      } else {
        const err = await res.json();
        addToast(err.error || "Failed to file", "error");
      }
    } catch {
      addToast("Failed to file", "error");
    }

    setSaving(false);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-page border border-edge rounded-xl shadow-2xl animate-fade-in">
        <div className="px-6 py-5 border-b border-edge flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">File to Knowledge Base</h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink transition-colors text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Preview */}
          <div>
            <label className="block text-sm text-ink-muted mb-1">Content preview</label>
            <div className="text-sm text-ink-secondary bg-surface border border-edge-subtle rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {content.slice(0, 500)}{content.length > 500 ? "..." : ""}
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm text-ink-muted mb-2">Action</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAction("enhance_topic")}
                className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-all ${
                  action === "enhance_topic"
                    ? "border-ink-muted bg-surface-hover text-ink"
                    : "border-edge-subtle text-ink-muted hover:border-edge"
                }`}
              >
                Enhance topic
              </button>
              <button
                onClick={() => setAction("new_resource")}
                className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-all ${
                  action === "new_resource"
                    ? "border-ink-muted bg-surface-hover text-ink"
                    : "border-edge-subtle text-ink-muted hover:border-edge"
                }`}
              >
                Save as resource
              </button>
            </div>
          </div>

          {/* Topic selector */}
          <div>
            <label className="block text-sm text-ink-muted mb-1">Topic</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-lg border border-edge bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink-faint transition-colors"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title (for new resource) */}
          {action === "new_resource" && (
            <div>
              <label className="block text-sm text-ink-muted mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q&A Note"
                className="w-full rounded-lg border border-edge bg-input px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-ink-faint transition-colors"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-edge flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-edge hover:bg-surface-hover text-sm text-ink-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!topicId || saving}
            className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-ink-on-accent text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "File"}
          </button>
        </div>
      </div>
    </>
  );
}
