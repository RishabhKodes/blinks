"use client";

import { useState } from "react";

interface LintResult {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  topicId: string | null;
  suggestion: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
};

const TYPE_LABELS: Record<string, string> = {
  inconsistency: "Inconsistency",
  missing_connection: "Missing Connection",
  suggested_topic: "Suggested Topic",
  data_quality: "Data Quality",
};

export function LintPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [results, setResults] = useState<LintResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  async function loadExisting() {
    try {
      const res = await fetch("/api/lint");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setResults(data);
          setHasRun(true);
        }
      }
    } catch { /* ignore */ }
  }

  async function runLint() {
    setLoading(true);
    try {
      const res = await fetch("/api/lint", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setHasRun(true);
      } else {
        const err = await res.json();
        setResults([]);
        setHasRun(true);
        alert(err.error || "Health check failed");
      }
    } catch {
      alert("Health check failed");
    }
    setLoading(false);
  }

  // Load existing results when panel opens
  if (open && !hasRun && !loading) {
    loadExisting();
  }

  if (!open) return null;

  const grouped = {
    error: results.filter((r) => r.severity === "error"),
    warning: results.filter((r) => r.severity === "warning"),
    info: results.filter((r) => r.severity === "info"),
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 bg-page border border-edge rounded-xl shadow-2xl animate-fade-in flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-edge flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Knowledge Base Health Check</h2>
            <p className="text-sm text-ink-faint mt-1">
              {hasRun
                ? `${results.length} finding${results.length !== 1 ? "s" : ""}`
                : "Run a health check to analyze your knowledge base"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runLint}
              disabled={loading}
              className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-ink-on-accent text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Run Check"}
            </button>
            <button
              onClick={onClose}
              className="text-ink-faint hover:text-ink transition-colors text-xl leading-none"
              aria-label="Close"
            >
              x
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="text-center py-12">
              <p className="text-ink-faint text-sm">Analyzing your knowledge base with LLM...</p>
              <div className="mt-3 w-8 h-8 border-2 border-edge border-t-ink-muted rounded-full animate-spin mx-auto" />
            </div>
          )}

          {!loading && hasRun && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-lg text-ink-secondary">All clear</p>
              <p className="text-sm text-ink-faint mt-1">No issues found in your knowledge base.</p>
            </div>
          )}

          {!loading && hasRun && results.length > 0 && (
            <div className="space-y-6">
              {(["error", "warning", "info"] as const).map((severity) => {
                const items = grouped[severity];
                if (items.length === 0) return null;
                return (
                  <div key={severity}>
                    <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-3">
                      {severity === "error" ? "Errors" : severity === "warning" ? "Warnings" : "Info"} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((result) => (
                        <div key={result.id} className="p-4 rounded-lg border border-edge bg-surface">
                          <div className="flex items-start gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${SEVERITY_STYLES[result.severity] || SEVERITY_STYLES.info}`}>
                              {TYPE_LABELS[result.type] || result.type}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">{result.title}</p>
                              <p className="text-sm text-ink-muted mt-1">{result.description}</p>
                              {result.suggestion && (
                                <p className="text-sm text-ink-faint mt-2 italic">
                                  Suggestion: {result.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !hasRun && (
            <div className="text-center py-12">
              <p className="text-ink-faint text-sm">
                Click "Run Check" to analyze your knowledge base for inconsistencies, missing connections, and improvement opportunities.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
