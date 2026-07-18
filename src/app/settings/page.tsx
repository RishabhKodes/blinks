"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  provider: string;
  claudeModel: string;
  openaiModel: string;
  ollamaModel: string;
  ollamaBaseUrl: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  isOllamaReachable: boolean;
  storagePath: string;
}

interface ConnectionStats {
  resourceCount: number;
  connectionCount: number;
  generatedConnectionCount: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMessage, setRebuildMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data as Settings);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/graph/rebuild")
      .then((res) => res.json())
      .then((data) => setConnectionStats(data as ConnectionStats))
      .catch(() => {});
  }, []);

  async function rebuildConnections() {
    setRebuilding(true);
    setRebuildMessage("");
    try {
      const response = await fetch("/api/graph/rebuild", { method: "POST" });
      const data = await response.json() as {
        error?: string;
        resourceCount?: number;
        connectionCount?: number;
        generatedConnectionCount?: number;
      };
      if (!response.ok) {
        throw new Error(data.error || "Connection rebuild failed");
      }
      setConnectionStats((current) => ({
        resourceCount: data.resourceCount ?? current?.resourceCount ?? 0,
        connectionCount: data.connectionCount ?? current?.connectionCount ?? 0,
        generatedConnectionCount: data.generatedConnectionCount ?? 0,
      }));
      setRebuildMessage(
        `Rebuilt ${data.generatedConnectionCount ?? 0} semantic connections across ${data.resourceCount ?? 0} resources.`
      );
    } catch (error) {
      setRebuildMessage(
        error instanceof Error ? error.message : "Connection rebuild failed"
      );
    } finally {
      setRebuilding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-edge border-t-ink-muted rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <Link
            href="/"
            className="text-base text-ink-muted hover:text-ink-secondary transition-colors"
          >
            Back to graph
          </Link>
        </div>

        {/* LLM Provider */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            LLM Provider
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
              <div>
                <p className="text-base font-medium">Current Provider</p>
                <p className="text-sm text-ink-muted mt-0.5">
                  Set via LLM_PROVIDER in .env or .env.local
                </p>
              </div>
              <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                {settings?.provider || "openai"}
              </span>
            </div>

            {settings?.provider === "claude" && (
              <>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">Claude Model</p>
                    <p className="text-sm text-ink-muted mt-0.5">CLAUDE_MODEL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.claudeModel}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">API Key</p>
                    <p className="text-sm text-ink-muted mt-0.5">ANTHROPIC_API_KEY</p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded ${
                      settings.hasAnthropicKey
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {settings.hasAnthropicKey ? "Configured" : "Missing"}
                  </span>
                </div>
              </>
            )}

            {settings?.provider === "openai" && (
              <>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">OpenAI Model</p>
                    <p className="text-sm text-ink-muted mt-0.5">OPENAI_MODEL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.openaiModel}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">API Key</p>
                    <p className="text-sm text-ink-muted mt-0.5">OPENAI_API_KEY</p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded ${
                      settings.hasOpenaiKey
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {settings.hasOpenaiKey ? "Configured" : "Missing"}
                  </span>
                </div>
              </>
            )}

            {settings?.provider === "ollama" && (
              <>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">Ollama Model</p>
                    <p className="text-sm text-ink-muted mt-0.5">OLLAMA_MODEL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.ollamaModel}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">Base URL</p>
                    <p className="text-sm text-ink-muted mt-0.5">OLLAMA_BASE_URL</p>
                  </div>
                  <span className="text-sm font-mono bg-surface-hover px-3 py-1 rounded">
                    {settings.ollamaBaseUrl}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface border border-edge rounded-lg">
                  <div>
                    <p className="text-base font-medium">Server Status</p>
                    <p className="text-sm text-ink-muted mt-0.5">Ollama API reachability</p>
                  </div>
                  <span
                    className={`text-sm px-3 py-1 rounded ${
                      settings.isOllamaReachable
                        ? "bg-emerald-900/50 text-emerald-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {settings.isOllamaReachable ? "Connected" : "Unreachable"}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Storage Info */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            Storage
          </h2>
          <div className="p-4 bg-surface border border-edge rounded-lg">
            <div>
              <p className="text-base font-medium">Database Binding</p>
              <p className="text-sm text-ink-muted mt-0.5">
                Local and deployed data are stored in Cloudflare D1
              </p>
            </div>
            <p className="text-sm font-mono text-ink-muted mt-2 break-all">
              {settings?.storagePath || "d1://blinks-db"}
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            Knowledge Graph
          </h2>
          <div className="p-4 bg-surface border border-edge rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-medium">Semantic Connections</p>
                <p className="text-sm text-ink-muted mt-0.5">
                  Re-evaluate direct relationships without changing resources,
                  tags, archives, or saved node positions.
                </p>
                {connectionStats && (
                  <p className="text-xs text-ink-faint mt-2">
                    {connectionStats.resourceCount} resources,{" "}
                    {connectionStats.connectionCount} stored connections
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={rebuilding}
                onClick={rebuildConnections}
                className="shrink-0 rounded-lg border border-edge bg-surface-hover px-3 py-2 text-sm text-ink-secondary hover:text-ink disabled:cursor-wait disabled:opacity-60"
              >
                {rebuilding ? "Rebuilding..." : "Rebuild"}
              </button>
            </div>
            {rebuildMessage && (
              <p className="mt-3 text-sm text-ink-muted">{rebuildMessage}</p>
            )}
          </div>
        </section>

        {/* Config instructions */}
        <section>
          <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-4">
            Configuration
          </h2>
          <div className="p-4 bg-surface border border-edge rounded-lg text-base text-ink-muted space-y-2">
            <p>
              All settings are configured via environment variables in{" "}
              <code className="text-ink-secondary bg-surface-hover px-1.5 py-0.5 rounded">
                .env.local
              </code>
            </p>
            <p>
              See{" "}
              <code className="text-ink-secondary bg-surface-hover px-1.5 py-0.5 rounded">
                .env.example
              </code>{" "}
              for all available options.
            </p>
            <p>Restart the dev server after changing env variables.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
